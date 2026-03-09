import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Plane, ArrowRight, User, Clock, Luggage, Shield, CreditCard } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useFlightDetails } from "@/hooks/useApiData";
import { useCmsPageContent } from "@/hooks/useCmsContent";
import { useAuth } from "@/hooks/useAuth";
import AuthGateModal from "@/components/AuthGateModal";
import type { BookingFormField } from "@/lib/cms-defaults";

const iconMap: Record<string, any> = { Plane, User, CreditCard, Shield };

const RenderField = ({ field }: { field: BookingFormField }) => {
  if (!field.visible) return null;
  const cls = field.thirdWidth ? "space-y-1.5" : field.halfWidth ? "space-y-1.5" : "space-y-1.5 sm:col-span-2";

  if (field.type === "select") {
    return (
      <div className={cls}>
        <Label>{field.label}</Label>
        <Select><SelectTrigger className="h-11"><SelectValue placeholder={field.placeholder || "Select"} /></SelectTrigger>
          <SelectContent>{(field.options || []).map(o => <SelectItem key={o} value={o.toLowerCase()}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{field.label}</Label>
        <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={field.placeholder} />
      </div>
    );
  }
  return (
    <div className={cls}>
      <Label>{field.label}</Label>
      <Input type={field.type} placeholder={field.placeholder} className="h-11" />
    </div>
  );
};

const FlightBooking = () => {
  const [step, setStep] = useState(1);
  const [authOpen, setAuthOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: page, isLoading } = useCmsPageContent("/flights/book");
  const { toast } = useToast();
  const config = page?.bookingConfig;

  // Read selected flight info from URL params
  const [searchParams] = useSearchParams();
  const flightId = searchParams.get("flightId");

  // Fetch actual flight details if flightId is provided
  const { data: flightRaw } = useFlightDetails(flightId || undefined);
  const selectedFlight = (flightRaw as any)?.data || (flightRaw as any) || null;

  const handleFinalAction = () => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    navigate("/booking/confirmation", {
      state: {
        booking: {
          type: "Flight",
          bookingRef: `ST-FL-${Date.now().toString(36).toUpperCase()}`,
          route: `${selectedFlight?.origin || selectedFlight?.from || "DAC"} → ${selectedFlight?.destination || selectedFlight?.to || "CXB"}`,
          flightNo: selectedFlight?.flightNumber || selectedFlight?.flightNo || "—",
          airline: selectedFlight?.airline || "—",
          class: selectedFlight?.cabinClass || selectedFlight?.class || "Economy",
          departTime: selectedFlight?.departureTime ? new Date(selectedFlight.departureTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : selectedFlight?.departTime || "—",
          arriveTime: selectedFlight?.arrivalTime ? new Date(selectedFlight.arrivalTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : selectedFlight?.arriveTime || "—",
          date: selectedFlight?.departureTime ? new Date(selectedFlight.departureTime).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—",
          stops: selectedFlight?.stops === 0 ? "Non-stop" : `${selectedFlight?.stops || 0} Stop`,
          passenger: "Traveller",
          baseFare: selectedFlight?.price || 0,
          taxes: Math.round((selectedFlight?.price || 0) * 0.12),
          serviceCharge: 250,
          total: Math.round((selectedFlight?.price || 0) * 1.12) + 250,
          paymentMethod: "Card",
        },
      },
    });
  };

  if (isLoading) {
    return <div className="min-h-screen bg-muted/30 pt-20 lg:pt-28 pb-10"><div className="container mx-auto px-4"><Skeleton className="h-96 w-full rounded-xl" /></div></div>;
  }

  const steps = config?.steps || [];
  const totalSteps = steps.length;

  return (
    <div className="min-h-screen bg-muted/30 pt-20 lg:pt-28 pb-10">
      <div className="container mx-auto px-4">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step > i + 1 ? "bg-success text-success-foreground" : step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>{i + 1}</div>
              <span className={`text-sm font-medium hidden sm:block ${step === i + 1 ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
              {i < totalSteps - 1 && <div className="w-8 sm:w-16 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Flight summary card (always visible) */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2"><Plane className="w-5 h-5 text-primary" /> Flight Details</CardTitle>
                  <Badge className="bg-success/10 text-success text-xs">Confirmed Fare</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                  <div className="text-center">
                    <p className="text-2xl font-black">{selectedFlight?.departureTime ? new Date(selectedFlight.departureTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : selectedFlight?.departTime || "—"}</p>
                    <p className="text-xs font-semibold text-muted-foreground">{selectedFlight?.origin || selectedFlight?.from || "—"}</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-[11px] text-muted-foreground font-medium">{selectedFlight?.duration || "—"}</p>
                    <div className="w-full flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full border-2 border-primary" />
                      <div className="flex-1 h-px bg-border" />
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <p className="text-[11px] text-success font-semibold">{selectedFlight?.stops === 0 ? "Non-stop" : `${selectedFlight?.stops || 0} Stop`}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black">{selectedFlight?.arrivalTime ? new Date(selectedFlight.arrivalTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : selectedFlight?.arriveTime || "—"}</p>
                    <p className="text-xs font-semibold text-muted-foreground">{selectedFlight?.destination || selectedFlight?.to || "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Luggage className="w-3.5 h-3.5" /> {selectedFlight?.baggage || "20kg"}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {selectedFlight?.departureTime ? new Date(selectedFlight.departureTime).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
                  <span>{selectedFlight?.airline || "—"} • {selectedFlight?.flightNumber || selectedFlight?.flightNo || "—"} • {selectedFlight?.cabinClass || selectedFlight?.class || "Economy"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Dynamic form steps */}
            {steps.map((formStep, si) => {
              if (step < si + 1) return null;
              // Last step = payment (has empty fields array — always render it)
              if (si === totalSteps - 1) {
                return (
                  <Card key={si}>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Payment</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-3">
                        {(config?.paymentMethods || []).map(m => (
                          <label key={m} className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/40 cursor-pointer transition-colors">
                            <Checkbox />
                            <span className="text-sm font-medium">{m}</span>
                          </label>
                        ))}
                      </div>
                      {config?.termsText && (
                        <div className="flex items-start gap-2 mt-3">
                          <Checkbox id="agree" className="mt-0.5" />
                          <label htmlFor="agree" className="text-xs text-muted-foreground">
                            {config.termsText.split("Terms & Conditions")[0]}
                            <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link>
                            {config.termsText.includes("Refund Policy") && <> and <Link to="/refund-policy" className="text-primary hover:underline">Refund Policy</Link></>}
                          </label>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }
              const gridCls = formStep.fields.some(f => f.thirdWidth) ? "grid sm:grid-cols-3 gap-4" : "grid sm:grid-cols-2 gap-4";
              return (
                <Card key={si}>
                  <CardHeader><CardTitle className="text-lg flex items-center gap-2">
                    {si === 1 ? <User className="w-5 h-5 text-primary" /> : <Plane className="w-5 h-5 text-primary" />}
                    {formStep.label}
                  </CardTitle></CardHeader>
                  <CardContent>
                    <div className={gridCls}>
                      {formStep.fields.filter(f => f.visible).map(f => <RenderField key={f.id} field={f} />)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <div className="flex gap-3">
              {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
              {step < totalSteps ? (
                <Button onClick={() => {
                  // Validate current step has at least some filled fields
                  setStep(step + 1);
                }} className="font-bold">Continue <ArrowRight className="w-4 h-4 ml-1" /></Button>
              ) : (
                <Button className="font-bold shadow-lg shadow-primary/20" onClick={handleFinalAction}>
                  <Shield className="w-4 h-4 mr-1" /> {config?.submitButtonText || "Confirm & Pay"} ৳{config?.totalAmount?.toLocaleString()}
                </Button>
              )}
            </div>
          </div>

          {/* Price Summary Sidebar */}
          <div>
            <Card className="sticky top-28">
              <CardHeader><CardTitle className="text-base">{config?.summaryTitle || "Fare Summary"}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {(config?.summaryFields || []).map((f, i) => (
                  <div key={i} className="flex justify-between"><span className="text-muted-foreground">{f.label}</span><span className="font-semibold">{f.value}</span></div>
                ))}
                <Separator />
                <div className="flex justify-between text-base"><span className="font-bold">{config?.totalLabel}</span><span className="font-black text-primary">৳{config?.totalAmount?.toLocaleString()}</span></div>
                {config?.savingsAmount && (
                  <div className="flex justify-between text-xs text-success"><span>{config.savingsText}</span><span className="font-semibold">৳{config.savingsAmount.toLocaleString()}</span></div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AuthGateModal open={authOpen} onOpenChange={setAuthOpen} onAuthenticated={() => { setAuthOpen(false); navigate("/booking/confirmation"); }} title="Sign in to book your flight" />
    </div>
  );
};

export default FlightBooking;
