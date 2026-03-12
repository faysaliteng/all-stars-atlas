/**
 * Travel Document Verification Modal
 * Shows passport + visa upload for each passenger on international bookings.
 * Auto-runs OCR on passport to extract MRZ data, auto-corrects passenger info,
 * then allows proceeding to payment.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield, Upload, FileText, X, AlertTriangle, CheckCircle2,
  ScanLine, Loader2, User, ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface Passenger {
  firstName: string;
  lastName: string;
  title?: string;
  dob?: string;
  passport?: string;
  passportExpiry?: string;
  nationality?: string;
  gender?: string;
}

interface TravelDocVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (updatedPassengers: Passenger[]) => void;
  passengers: Passenger[];
  bookingRef: string;
  bookingId?: string;
}

interface DocState {
  file: File;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
}

interface MrzResult {
  verified: boolean;
  corrections: { field: string; old: string; new: string }[];
  confidence: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const TravelDocVerificationModal = ({
  open, onOpenChange, onVerified, passengers, bookingRef, bookingId,
}: TravelDocVerificationModalProps) => {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Record<string, DocState>>({});
  const [mrzResults, setMrzResults] = useState<Record<number, MrzResult>>({});
  const [verifying, setVerifying] = useState<Record<number, boolean>>({});
  const [updatedPassengers, setUpdatedPassengers] = useState<Passenger[]>(passengers);
  const [allVerified, setAllVerified] = useState(false);

  const totalPax = passengers.length;

  const handleFileSelect = async (key: string, file: File, paxIndex: number, docType: "passport" | "visa") => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: "Invalid File", description: "Only JPG, PNG, WebP, and PDF files are accepted.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File Too Large", description: "Maximum file size is 10MB.", variant: "destructive" });
      return;
    }

    setDocs(prev => ({ ...prev, [key]: { file, uploading: true, uploaded: false } }));

    try {
      // Upload the document
      const formData = new FormData();
      formData.append(key, file);
      if (bookingId) formData.append("bookingId", bookingId);
      const result = await api.upload<any>("/flights/upload-travel-docs", formData);
      const docUrl = result.documents?.[0]?.url;

      setDocs(prev => ({ ...prev, [key]: { file, uploading: false, uploaded: true, url: docUrl } }));

      // For passport uploads, auto-run OCR/MRZ verification
      if (docType === "passport") {
        await runMrzVerification(paxIndex, file);
      }
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message || "Could not upload document.", variant: "destructive" });
      setDocs(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const runMrzVerification = async (paxIndex: number, file: File) => {
    setVerifying(prev => ({ ...prev, [paxIndex]: true }));
    try {
      // Convert file to base64 for OCR
      const base64 = await fileToBase64(file);
      const ocrResult = await api.post<any>("/passport/ocr", { image: base64 });

      if (ocrResult?.extracted) {
        const extracted = ocrResult.extracted;
        const pax = updatedPassengers[paxIndex];
        const corrections: { field: string; old: string; new: string }[] = [];

        // Auto-correct passenger data from MRZ (trusted source)
        const newPax = { ...pax };

        if (extracted.firstName && extracted.firstName.toUpperCase() !== pax.firstName?.toUpperCase()) {
          corrections.push({ field: "First Name", old: pax.firstName || "", new: extracted.firstName });
          newPax.firstName = extracted.firstName;
        }
        if (extracted.lastName && extracted.lastName.toUpperCase() !== pax.lastName?.toUpperCase()) {
          corrections.push({ field: "Last Name", old: pax.lastName || "", new: extracted.lastName });
          newPax.lastName = extracted.lastName;
        }
        if (extracted.passportNumber && extracted.passportNumber !== pax.passport) {
          corrections.push({ field: "Passport No.", old: pax.passport || "", new: extracted.passportNumber });
          newPax.passport = extracted.passportNumber;
        }
        if (extracted.expiryDate && extracted.expiryDate !== pax.passportExpiry) {
          corrections.push({ field: "Passport Expiry", old: pax.passportExpiry || "", new: extracted.expiryDate });
          newPax.passportExpiry = extracted.expiryDate;
        }
        if (extracted.birthDate && extracted.birthDate !== pax.dob) {
          corrections.push({ field: "Date of Birth", old: pax.dob || "", new: extracted.birthDate });
          newPax.dob = extracted.birthDate;
        }
        if (extracted.gender && extracted.gender !== pax.gender) {
          corrections.push({ field: "Gender", old: pax.gender || "", new: extracted.gender });
          newPax.gender = extracted.gender;
        }
        if (extracted.nationality && extracted.nationality !== pax.nationality) {
          corrections.push({ field: "Nationality", old: pax.nationality || "", new: extracted.nationality });
          newPax.nationality = extracted.nationality;
        }

        // Update passenger data
        const newPassengers = [...updatedPassengers];
        newPassengers[paxIndex] = newPax;
        setUpdatedPassengers(newPassengers);

        const confidence = ocrResult.confidence || 0;
        setMrzResults(prev => ({
          ...prev,
          [paxIndex]: {
            verified: confidence >= 0.5,
            corrections,
            confidence: Math.round(confidence * 100),
          },
        }));

        if (corrections.length > 0) {
          toast({
            title: "Passenger Data Auto-Updated",
            description: `${corrections.length} field(s) corrected from passport MRZ for ${newPax.firstName} ${newPax.lastName}.`,
          });
        } else {
          toast({ title: "MRZ Verified ✓", description: `Passport data matches for ${pax.firstName} ${pax.lastName}.` });
        }
      }
    } catch (err: any) {
      // OCR failed — still allow manual verification
      setMrzResults(prev => ({
        ...prev,
        [paxIndex]: { verified: false, corrections: [], confidence: 0 },
      }));
      toast({
        title: "Auto-Verification Unavailable",
        description: "Could not read MRZ data. Documents will be manually verified by our team.",
        variant: "destructive",
      });
    } finally {
      setVerifying(prev => ({ ...prev, [paxIndex]: false }));
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(",")[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeDoc = (key: string) => {
    setDocs(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  // Check if all documents are uploaded
  const checkAllComplete = () => {
    for (let pi = 0; pi < totalPax; pi++) {
      if (!docs[`passport_${pi}`]?.uploaded) return false;
      if (!docs[`visa_${pi}`]?.uploaded) return false;
    }
    return true;
  };

  const isComplete = checkAllComplete();

  const handleProceed = () => {
    if (!isComplete) {
      toast({ title: "Documents Missing", description: "Please upload passport and visa copies for all passengers.", variant: "destructive" });
      return;
    }
    onVerified(updatedPassengers);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            Travel Document Verification
          </DialogTitle>
          <DialogDescription>
            Upload passport and visa copies for all passengers. Passport MRZ data will be automatically verified and passenger information will be updated if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <ScanLine className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong>Automatic MRZ Verification:</strong> When you upload a passport, our system reads the Machine Readable Zone (MRZ) and auto-verifies passenger data. Any mismatches are automatically corrected from the passport (trusted source).
          </p>
        </div>

        <div className="space-y-5">
          {passengers.map((pax, pi) => {
            const passportKey = `passport_${pi}`;
            const visaKey = `visa_${pi}`;
            const mrzResult = mrzResults[pi];
            const isVerifyingPax = verifying[pi];

            return (
              <div key={pi} className="space-y-3 p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-accent" />
                  <span className="text-sm font-semibold">{pax.title} {pax.firstName} {pax.lastName}</span>
                  {mrzResult?.verified && (
                    <Badge className="bg-accent/10 text-accent border-0 text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> MRZ Verified
                    </Badge>
                  )}
                  {mrzResult && !mrzResult.verified && (
                    <Badge className="bg-warning/10 text-warning border-0 text-[10px]">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Manual Review
                    </Badge>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {/* Passport Copy */}
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">Passport Copy *</Label>
                    {docs[passportKey] ? (
                      <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                        docs[passportKey].uploading ? "border-warning/30 bg-warning/5" : "border-accent/30 bg-accent/5"
                      }`}>
                        <FileText className="w-4 h-4 text-accent shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{docs[passportKey].file.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {docs[passportKey].uploading ? "Uploading..." : isVerifyingPax ? "Verifying MRZ..." : "✓ Uploaded & Verified"}
                          </p>
                        </div>
                        {isVerifyingPax && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeDoc(passportKey)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors hover:border-accent/40 hover:bg-accent/5 border-border">
                        <Upload className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Choose passport file</span>
                        <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf"
                          onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(passportKey, e.target.files[0], pi, "passport"); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>

                  {/* Visa Copy */}
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">Visa Copy *</Label>
                    {docs[visaKey] ? (
                      <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                        docs[visaKey].uploading ? "border-warning/30 bg-warning/5" : "border-accent/30 bg-accent/5"
                      }`}>
                        <FileText className="w-4 h-4 text-accent shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{docs[visaKey].file.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {docs[visaKey].uploading ? "Uploading..." : "✓ Uploaded"}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeDoc(visaKey)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors hover:border-accent/40 hover:bg-accent/5 border-border">
                        <Upload className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Choose visa file</span>
                        <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf"
                          onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(visaKey, e.target.files[0], pi, "visa"); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                </div>

                {/* MRZ Verification Results */}
                {mrzResult && mrzResult.corrections.length > 0 && (
                  <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5 text-accent">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Corrected from Passport MRZ ({mrzResult.confidence}% confidence)
                    </p>
                    <div className="space-y-1">
                      {mrzResult.corrections.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground w-24 shrink-0">{c.field}:</span>
                          <span className="line-through text-destructive/70">{c.old || "—"}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-accent">{c.new}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mrzResult && mrzResult.corrections.length === 0 && mrzResult.verified && (
                  <div className="bg-accent/5 border border-accent/20 rounded-lg p-2.5">
                    <p className="text-xs text-accent flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> All passenger data matches passport MRZ ({mrzResult.confidence}% confidence)
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {isComplete
              ? "✓ All documents uploaded. You can now proceed to payment."
              : `${Object.values(docs).filter(d => d.uploaded).length} / ${totalPax * 2} documents uploaded`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={handleProceed}
              disabled={!isComplete || Object.values(verifying).some(v => v)}
              className="font-bold bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {Object.values(verifying).some(v => v) ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Verifying...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Proceed to Payment</>
              )}
            </Button>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" /> Documents are encrypted and securely stored. MRZ verification uses ICAO 9303 standards.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default TravelDocVerificationModal;
