/**
 * Search Existing Passenger Modal — UIUX spec page 15
 * Search saved travellers and auto-fill passenger form
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Mail, Phone, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

interface Traveller {
  id: string;
  title?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  passport?: string;
  dob?: string;
  nationality?: string;
  gender?: string;
  documentCountry?: string;
  passportExpiry?: string;
}

interface SearchPassengerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (traveller: Traveller) => void;
}

const SearchPassengerModal = ({ open, onOpenChange, onSelect }: SearchPassengerModalProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Traveller[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Load saved travellers on open
    const loadTravellers = async () => {
      setLoading(true);
      try {
        const data = await api.get<any>("/dashboard/travellers");
        const travellers = data?.data || data?.travellers || [];
        setResults(travellers.map((t: any) => ({
          id: t.id,
          title: t.title || "",
          firstName: t.first_name || t.firstName || "",
          lastName: t.last_name || t.lastName || "",
          email: t.email || "",
          phone: t.phone || "",
          passport: t.passport_number || t.passport || "",
          dob: t.date_of_birth || t.dob || "",
          nationality: t.nationality || "",
          gender: t.gender || "",
          documentCountry: t.document_country || t.documentCountry || "BD",
          passportExpiry: t.passport_expiry || t.passportExpiry || "",
        })));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    };
    loadTravellers();
  }, [open]);

  const filtered = query.trim()
    ? results.filter(t => {
        const q = query.toLowerCase();
        return (
          t.firstName?.toLowerCase().includes(q) ||
          t.lastName?.toLowerCase().includes(q) ||
          t.email?.toLowerCase().includes(q) ||
          t.phone?.includes(q)
        );
      })
    : results;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Search className="w-5 h-5 text-accent" />
            Search Existing Passenger
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Type name, email, or phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading saved travellers...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{query ? "No matching passengers found" : "No saved travellers"}</p>
            </div>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => { onSelect(t); onOpenChange(false); }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-accent/40 hover:bg-accent/5 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">
                    {t.title} {t.firstName} {t.lastName}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {t.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" /> {t.email}</span>}
                    {t.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {t.phone}</span>}
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchPassengerModal;
