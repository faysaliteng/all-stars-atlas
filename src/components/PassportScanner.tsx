/**
 * Passport Scanner — Upload passport/NID image, extract data, auto-fill passenger form
 * Matches UIUX spec pages 13-14: Upload zone + Extracted Data panel
 */
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, FileText, ScanLine, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExtractedData {
  title: string;
  firstName: string;
  lastName: string;
  country: string;
  passportNumber: string;
  birthDate: string;
  birthPlace: string;
  gender: string;
  issuanceDate: string;
  expiryDate: string;
}

interface PassportScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: ExtractedData) => void;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Client-side MRZ-style extraction simulation.
 * In production, this would call an OCR API endpoint.
 * For now, it provides a realistic UX with editable extracted fields.
 */
function simulateOCR(fileName: string): ExtractedData {
  return {
    title: "",
    firstName: "",
    lastName: "",
    country: "",
    passportNumber: "",
    birthDate: "",
    birthPlace: "",
    gender: "",
    issuanceDate: "",
    expiryDate: "",
  };
}

const PassportScanner = ({ open, onOpenChange, onConfirm }: PassportScannerProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);

  const handleFile = (f: File) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast({ title: "Invalid File", description: "Upload JPG, PNG, WebP, or PDF only.", variant: "destructive" });
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast({ title: "File Too Large", description: "Max 10MB.", variant: "destructive" });
      return;
    }
    setFile(f);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
    // Auto-scan
    setScanning(true);
    setExtracted(null);
    setTimeout(() => {
      setExtracted(simulateOCR(f.name));
      setScanning(false);
    }, 1500);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleConfirm = () => {
    if (!extracted) return;
    onConfirm(extracted);
    onOpenChange(false);
    resetState();
    toast({ title: "Data Applied", description: "Passport data has been filled into the form." });
  };

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setExtracted(null);
    setScanning(false);
  };

  const updateField = (field: keyof ExtractedData, value: string) => {
    if (extracted) setExtracted({ ...extracted, [field]: value });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScanLine className="w-5 h-5 text-accent" />
            Passport Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Left: Upload / Preview */}
          <div className="p-5">
            {file && preview ? (
              <div className="relative">
                <img src={preview} alt="Passport" className="w-full rounded-lg border-2 border-dashed border-accent/40 object-contain max-h-[400px]" />
                <button onClick={() => { resetState(); }} className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
                {scanning && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center rounded-lg">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-2" />
                      <p className="text-sm font-medium">Scanning document...</p>
                    </div>
                  </div>
                )}
              </div>
            ) : file && !preview ? (
              <div className="border-2 border-dashed border-accent/40 rounded-lg p-8 text-center">
                <FileText className="w-12 h-12 text-accent mx-auto mb-3" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                {scanning && <Loader2 className="w-5 h-5 animate-spin text-accent mx-auto mt-3" />}
                <button onClick={resetState} className="text-xs text-destructive hover:underline mt-3">Remove</button>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-10 cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors min-h-[300px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Upload or drop your image right here</p>
                <p className="text-xs text-muted-foreground mt-1.5">JPG, PNG, PDF</p>
                <input ref={fileInputRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
            )}
          </div>

          {/* Right: Extracted Data */}
          <div className="p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">EXTRACTED DATA</h3>
            {extracted ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Title</Label>
                    <Input value={extracted.title} onChange={(e) => updateField("title", e.target.value)} placeholder="MR" className="h-9 bg-muted/30 border-accent/20 focus:border-accent" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">First Name</Label>
                    <Input value={extracted.firstName} onChange={(e) => updateField("firstName", e.target.value)} placeholder="" className="h-9 bg-muted/30 border-accent/20 focus:border-accent" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Last Name</Label>
                    <Input value={extracted.lastName} onChange={(e) => updateField("lastName", e.target.value)} placeholder="" className="h-9 bg-muted/30 border-accent/20 focus:border-accent" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Country</Label>
                    <Input value={extracted.country} onChange={(e) => updateField("country", e.target.value)} placeholder="BD" className="h-9 bg-muted/30 border-accent/20 focus:border-accent" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Passport Number</Label>
                    <Input value={extracted.passportNumber} onChange={(e) => updateField("passportNumber", e.target.value)} placeholder="" className="h-9 bg-muted/30 border-accent/20 focus:border-accent" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Birth Date</Label>
                    <Input type="date" value={extracted.birthDate} onChange={(e) => updateField("birthDate", e.target.value)} className="h-9 bg-muted/30 border-accent/20 focus:border-accent" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Birth Place</Label>
                    <Input value={extracted.birthPlace} onChange={(e) => updateField("birthPlace", e.target.value)} placeholder="" className="h-9 bg-muted/30 border-accent/20 focus:border-accent" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Gender</Label>
                    <Input value={extracted.gender} onChange={(e) => updateField("gender", e.target.value)} placeholder="MALE" className="h-9 bg-muted/30 border-accent/20 focus:border-accent" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Issuance Date</Label>
                    <Input type="date" value={extracted.issuanceDate} onChange={(e) => updateField("issuanceDate", e.target.value)} className="h-9 bg-muted/30 border-accent/20 focus:border-accent" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Expiry Date</Label>
                    <Input type="date" value={extracted.expiryDate} onChange={(e) => updateField("expiryDate", e.target.value)} className="h-9 bg-muted/30 border-accent/20 focus:border-accent" />
                  </div>
                </div>
                <Button onClick={handleConfirm} className="w-full mt-4 bg-accent text-accent-foreground hover:bg-accent/90 font-bold">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> CONFIRM
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
                <ScanLine className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Upload a passport or NID to extract data</p>
                <p className="text-xs mt-1">Fields will auto-populate after scanning</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PassportScanner;
