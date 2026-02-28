import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Ticket, Download, Plane, Search, Eye, Printer, Calendar, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const mockTickets = [
  { id: "TKT-001", bookingRef: "BK-2026-0012", pnr: "ABC123", airline: "Biman Bangladesh", flightNo: "BG-435", from: "DAC", to: "CXB", date: "2026-02-26", time: "07:30", passenger: "John Doe", seat: "14A", status: "active", class: "Economy" },
  { id: "TKT-002", bookingRef: "BK-2026-0012", pnr: "ABC123", airline: "Biman Bangladesh", flightNo: "BG-436", from: "CXB", to: "DAC", date: "2026-02-28", time: "16:00", passenger: "John Doe", seat: "12B", status: "active", class: "Economy" },
  { id: "TKT-003", bookingRef: "BK-2026-0008", pnr: "XYZ789", airline: "US-Bangla Airlines", flightNo: "BS-141", from: "DAC", to: "CXB", date: "2026-01-15", time: "09:15", passenger: "Jane Doe", seat: "8C", status: "used", class: "Economy" },
  { id: "TKT-004", bookingRef: "BK-2026-0005", pnr: "DEF456", airline: "NOVOAIR", flightNo: "VQ-901", from: "DAC", to: "CGP", date: "2025-12-20", time: "11:45", passenger: "John Doe", seat: "5A", status: "expired", class: "Business" },
];

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success",
  used: "bg-muted text-muted-foreground",
  expired: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
};

const DashboardTickets = () => {
  const [search, setSearch] = useState("");
  const filtered = mockTickets.filter(t =>
    t.passenger.toLowerCase().includes(search.toLowerCase()) ||
    t.pnr.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">E-Tickets</h1>
          <p className="text-sm text-muted-foreground">Download and manage your e-tickets</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by PNR, ticket ID or name..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-semibold">No tickets found</p></CardContent></Card>
        ) : filtered.map(ticket => (
          <Card key={ticket.id} className="overflow-hidden hover:shadow-md transition-all">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row">
                <div className="flex-1 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Plane className="w-4 h-4 text-primary" />
                      <span className="text-sm font-bold">{ticket.airline}</span>
                      <span className="text-xs text-muted-foreground">{ticket.flightNo}</span>
                    </div>
                    <Badge className={`text-[10px] ${statusColors[ticket.status]}`}>
                      {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <div className="text-center">
                      <p className="text-xl font-black">{ticket.from}</p>
                      <p className="text-[10px] text-muted-foreground">{ticket.time}</p>
                    </div>
                    <div className="flex-1 h-px bg-border relative">
                      <Plane className="w-3.5 h-3.5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-black">{ticket.to}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {ticket.date}</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {ticket.passenger}</span>
                    <span>PNR: <strong className="text-foreground">{ticket.pnr}</strong></span>
                    <span>Seat: <strong className="text-foreground">{ticket.seat}</strong></span>
                    <span>{ticket.class}</span>
                  </div>
                </div>

                <div className="sm:w-44 border-t sm:border-t-0 sm:border-l border-border p-4 flex sm:flex-col items-center justify-center gap-2 bg-muted/30">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader><DialogTitle>E-Ticket — {ticket.id}</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="p-4 bg-muted/50 rounded-xl text-center">
                          <p className="text-sm text-muted-foreground">{ticket.airline} — {ticket.flightNo}</p>
                          <div className="flex items-center justify-center gap-6 my-3">
                            <div><p className="text-2xl font-black">{ticket.from}</p><p className="text-xs text-muted-foreground">{ticket.time}</p></div>
                            <Plane className="w-5 h-5 text-primary" />
                            <div><p className="text-2xl font-black">{ticket.to}</p></div>
                          </div>
                          <p className="text-sm font-semibold">{ticket.date}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div><p className="text-muted-foreground text-xs">Passenger</p><p className="font-bold">{ticket.passenger}</p></div>
                          <div><p className="text-muted-foreground text-xs">PNR</p><p className="font-bold">{ticket.pnr}</p></div>
                          <div><p className="text-muted-foreground text-xs">Seat</p><p className="font-bold">{ticket.seat}</p></div>
                          <div><p className="text-muted-foreground text-xs">Class</p><p className="font-bold">{ticket.class}</p></div>
                          <div><p className="text-muted-foreground text-xs">Booking Ref</p><p className="font-bold">{ticket.bookingRef}</p></div>
                          <div><p className="text-muted-foreground text-xs">Ticket ID</p><p className="font-bold">{ticket.id}</p></div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button className="flex-1 font-bold"><Download className="w-4 h-4 mr-1" /> Download PDF</Button>
                          <Button variant="outline" className="flex-1"><Printer className="w-4 h-4 mr-1" /> Print</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" className="text-xs gap-1.5 font-bold">
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DashboardTickets;
