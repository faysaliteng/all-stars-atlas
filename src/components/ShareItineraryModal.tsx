/**
 * Share Itinerary Modal — UIUX spec page 20
 * Share flight details via email or copy link
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Share2, Mail, Copy, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareItineraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingRef?: string;
  itinerarySummary?: string;
}

const ShareItineraryModal = ({ open, onOpenChange, bookingRef, itinerarySummary }: ShareItineraryModalProps) => {
  const { toast } = useToast();
  const [platform, setPlatform] = useState("email");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSend = () => {
    if (platform === "email" && !receiverEmail) {
      toast({ title: "Email Required", description: "Enter receiver email address.", variant: "destructive" });
      return;
    }
    toast({ title: "Itinerary Shared", description: `Sent to ${receiverEmail} via ${platform}` });
    onOpenChange(false);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/booking/confirmation?ref=${bookingRef || ""}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link Copied" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-accent" /> Share Itinerary
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {itinerarySummary && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">{itinerarySummary}</div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Enter your name</Label>
            <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Your Name" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Select Platform Type</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Enter Receiver {platform === "email" ? "Email" : "Number"}</Label>
            <Input
              type={platform === "email" ? "email" : "tel"}
              value={receiverEmail}
              onChange={(e) => setReceiverEmail(e.target.value)}
              placeholder={platform === "email" ? "email@example.com" : "+880 1XXX"}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCopyLink} className="flex-1">
            {copied ? <CheckCircle2 className="w-4 h-4 mr-1.5 text-accent" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copied ? "Copied!" : "Copy Link"}
          </Button>
          <Button onClick={handleSend} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
            <Mail className="w-4 h-4 mr-1.5" /> Send {platform === "email" ? "Email" : "Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareItineraryModal;
