import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  XCircle, RotateCcw, DollarSign, ArrowLeftRight, Plane, AlertTriangle,
  CheckCircle2, Loader2, FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface BookingActionsProps {
  booking: {
    rawId: string;
    id: string;
    pnr: string;
    status: string;
    airlineCode: string;
    flightNumber: string;
    origin: string;
    destination: string;
    departureTime: string;
    ticketNo?: string;
    refundable?: boolean;
    passengers?: any[];
  };
  isAdmin?: boolean;
  onActionComplete?: () => void;
}

type ActionType = "void" | "refund" | "exchange" | null;

const BookingActions = ({ booking, isAdmin = false, onActionComplete }: BookingActionsProps) => {
  const { toast } = useToast();
  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Refund state
  const [refundStep, setRefundStep] = useState<"quote" | "confirm">("quote");
  const [refundQuote, setRefundQuote] = useState<any>(null);

  // Exchange state
  const [newDate, setNewDate] = useState("");
  const [exchangeReason, setExchangeReason] = useState("");

  const canVoid = ["confirmed", "ticketed"].includes(booking.status) && (isAdmin || booking.status === "ticketed");
  const canRefund = ["confirmed", "ticketed"].includes(booking.status);
  const canExchange = ["confirmed", "ticketed"].includes(booking.status);
  const hasPnr = booking.pnr && booking.pnr !== "—";

  const handleVoid = async () => {
    setLoading(true);
    try {
      const res = await api.post<any>("/flights/void", {
        pnr: booking.pnr,
        tickets: booking.ticketNo && booking.ticketNo !== "—" ? [booking.ticketNo] : undefined,
      });
      setResult(res);
      toast({
        title: res.success ? "Ticket Voided" : "Void Failed",
        description: res.success ? `PNR ${booking.pnr} voided successfully` : (res.error || "Could not void ticket"),
        variant: res.success ? "default" : "destructive",
      });
      if (res.success) onActionComplete?.();
    } catch (err: any) {
      toast({ title: "Void Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRefundQuote = async () => {
    setLoading(true);
    try {
      const paxData = (booking.passengers || []).map((p: any, i: number) => ({
        id: `PAX-${i + 1}`,
        nameNumber: `0${i + 1}.01`,
        givenName: `${(p.firstName || "").toUpperCase()} ${(p.title || "MR").toUpperCase()}`,
        surname: (p.lastName || "").toUpperCase(),
        typeCode: p.type || "ADT",
      }));
      const res = await api.post<any>("/flights/refund/price", {
        pnr: booking.pnr,
        passengers: paxData,
        refundDocuments: [{
          passengerReferenceId: "PAX-1",
          document: {
            number: booking.ticketNo && booking.ticketNo !== "—" ? booking.ticketNo : "0000000000000",
            isFlightDocument: true,
          },
        }],
      });
      setRefundQuote(res);
      setRefundStep("confirm");
    } catch (err: any) {
      toast({ title: "Refund Quote Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRefundFulfill = async () => {
    setLoading(true);
    try {
      const res = await api.post<any>("/flights/refund/fulfill", {
        pnr: booking.pnr,
        passengers: refundQuote?.passengers || [],
        refundDocuments: refundQuote?.refundDocuments || [],
        formsOfRefund: [{ type: "ORIGINAL_FOP" }],
      });
      setResult(res);
      toast({
        title: res.success ? "Refund Processed" : "Refund Failed",
        description: res.success ? `Refund for PNR ${booking.pnr} processed` : (res.error || "Refund failed"),
        variant: res.success ? "default" : "destructive",
      });
      if (res.success) onActionComplete?.();
    } catch (err: any) {
      toast({ title: "Refund Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleExchange = async () => {
    if (!newDate) {
      toast({ title: "Date Required", description: "Please select a new travel date", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const depTime = booking.departureTime ? new Date(booking.departureTime).toTimeString().slice(0, 5) : "12:00";
      const res = await api.post<any>("/flights/exchange", {
        pnr: booking.pnr,
        originalTicketNumber: booking.ticketNo && booking.ticketNo !== "—" ? booking.ticketNo : undefined,
        newSegments: [{
          origin: booking.origin,
          destination: booking.destination,
          departureTime: `${newDate}T${depTime}:00`,
          arrivalTime: `${newDate}T23:59:00`,
          airlineCode: booking.airlineCode,
          flightNumber: booking.flightNumber,
          bookingClass: "Y",
        }],
      });
      setResult(res);
      toast({
        title: res.success ? "Exchange Processed" : "Exchange Failed",
        description: res.success ? `New PNR: ${res.pnr || "pending"}` : (res.error || "Exchange failed"),
        variant: res.success ? "default" : "destructive",
      });
      if (res.success) onActionComplete?.();
    } catch (err: any) {
      toast({ title: "Exchange Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!hasPnr) return null;

  return (
    <>
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {canVoid && (
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setActiveAction("void")}>
            <XCircle className="w-3.5 h-3.5" /> {isAdmin ? "Void Ticket" : "Request Void"}
          </Button>
        )}
        {canRefund && (
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1 text-warning border-warning/30 hover:bg-warning/10"
            onClick={() => { setActiveAction("refund"); setRefundStep("quote"); setRefundQuote(null); }}>
            <DollarSign className="w-3.5 h-3.5" /> {isAdmin ? "Process Refund" : "Request Refund"}
          </Button>
        )}
        {canExchange && (
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1 text-primary border-primary/30 hover:bg-primary/10"
            onClick={() => { setActiveAction("exchange"); setNewDate(""); }}>
            <ArrowLeftRight className="w-3.5 h-3.5" /> {isAdmin ? "Exchange Ticket" : "Request Exchange"}
          </Button>
        )}
      </div>

      {/* Void Dialog */}
      <Dialog open={activeAction === "void"} onOpenChange={(o) => !o && setActiveAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" /> Void Ticket
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-sm">
              <p className="font-semibold text-destructive">⚠️ Void is irreversible</p>
              <p className="text-xs text-muted-foreground mt-1">
                Voiding cancels the ticket within 24 hours of issuance without penalty. After 24h, use Refund instead.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground text-xs">PNR</span><p className="font-mono font-bold">{booking.pnr}</p></div>
              <div><span className="text-muted-foreground text-xs">Ticket</span><p className="font-mono font-bold">{booking.ticketNo || "—"}</p></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Voiding...</> : "Confirm Void"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={activeAction === "refund"} onOpenChange={(o) => !o && setActiveAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-warning" /> {refundStep === "quote" ? "Refund Quote" : "Confirm Refund"}
            </DialogTitle>
          </DialogHeader>
          {refundStep === "quote" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Get a refund quote for PNR <strong className="font-mono">{booking.pnr}</strong>. Penalties may apply based on fare rules.
              </p>
              {!booking.refundable && (
                <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 text-sm">
                  <p className="font-semibold text-warning flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Non-Refundable Fare</p>
                  <p className="text-xs text-muted-foreground mt-1">This fare may not be eligible for refund. A quote will confirm.</p>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setActiveAction(null)}>Cancel</Button>
                <Button onClick={handleRefundQuote} disabled={loading} className="bg-warning text-warning-foreground hover:bg-warning/90">
                  {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Getting Quote...</> : "Get Refund Quote"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              {refundQuote?.success ? (
                <>
                  <Badge className="bg-accent/10 text-accent border-0">Quote Available</Badge>
                  <p className="text-sm">Refund amount and penalties have been calculated by the airline.</p>
                  {isAdmin ? (
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRefundStep("quote")}>Back</Button>
                      <Button onClick={handleRefundFulfill} disabled={loading}>
                        {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Processing...</> : "Execute Refund"}
                      </Button>
                    </DialogFooter>
                  ) : (
                    <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 text-sm">
                      <p className="font-semibold text-accent flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Quote Received</p>
                      <p className="text-xs text-muted-foreground mt-1">Your refund request has been submitted. Our team will process it within 24-48 hours.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-sm">
                  <p className="text-destructive font-semibold">Quote Failed</p>
                  <p className="text-xs text-muted-foreground mt-1">{refundQuote?.error || "Unable to get refund quote. Contact support."}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Exchange Dialog */}
      <Dialog open={activeAction === "exchange"} onOpenChange={(o) => !o && setActiveAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-primary" /> Exchange / Date Change
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Change your travel date for {booking.airlineCode}{booking.flightNumber} ({booking.origin} → {booking.destination}).
              Exchange fees may apply.
            </p>
            <div className="space-y-2">
              <Label className="text-xs font-bold">New Travel Date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]} />
            </div>
            <Textarea placeholder="Reason for change (optional)" value={exchangeReason}
              onChange={(e) => setExchangeReason(e.target.value)} className="h-20" />
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-primary">Note</p>
              <p>Exchange availability and pricing depend on the airline. A fare difference may apply.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button onClick={handleExchange} disabled={loading || !newDate}>
              {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Processing...</> : isAdmin ? "Execute Exchange" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BookingActions;
