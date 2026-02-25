import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import {
  Plane, Building2, FileText, Palmtree, ShoppingBag, Stethoscope, Car,
  Smartphone, PhoneCall, Receipt, ArrowLeftRight, Search, Users, CalendarDays,
  MapPin, Globe, ChevronDown
} from "lucide-react";

const tabs = [
  { id: "flight", label: "Flight", icon: Plane },
  { id: "hotel", label: "Hotel", icon: Building2 },
  { id: "holiday", label: "Holiday", icon: Palmtree },
  { id: "visa", label: "Visa", icon: FileText },
  { id: "medical", label: "Medical", icon: Stethoscope },
  { id: "cars", label: "Cars", icon: Car },
  { id: "esim", label: "eSIM", icon: Smartphone },
  { id: "recharge", label: "Recharge", icon: PhoneCall },
  { id: "paybill", label: "Pay Bill", icon: Receipt },
];

const SearchWidget = () => {
  const [activeTab, setActiveTab] = useState("flight");
  const [tripType, setTripType] = useState("roundtrip");
  const [departDate, setDepartDate] = useState<Date>();
  const [returnDate, setReturnDate] = useState<Date>();
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [travelDate, setTravelDate] = useState<Date>();
  const [passengers, setPassengers] = useState({ adults: 1, children: 0, infants: 0 });
  const [cabinClass, setCabinClass] = useState("economy");
  const [fareType, setFareType] = useState("regular");

  const totalPax = passengers.adults + passengers.children + passengers.infants;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-0 px-2 pt-2 overflow-x-auto scrollbar-none border-b border-border/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`search-tab whitespace-nowrap shrink-0 ${
              activeTab === tab.id ? "search-tab-active" : ""
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 md:p-5">
        {activeTab === "flight" && (
          <div className="space-y-4">
            {/* Trip type + fare */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <RadioGroup value={tripType} onValueChange={setTripType} className="flex gap-1">
                {[
                  { value: "oneway", label: "One Way" },
                  { value: "roundtrip", label: "Round Trip" },
                  { value: "multicity", label: "Multi City" },
                ].map((t) => (
                  <label
                    key={t.value}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all border ${
                      tripType === t.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    <RadioGroupItem value={t.value} className="sr-only" />
                    {t.label}
                  </label>
                ))}
              </RadioGroup>

              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {totalPax} Traveller{totalPax > 1 ? "s" : ""}
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="end">
                    <div className="space-y-3">
                      {[
                        { key: "adults" as const, label: "Adults", desc: "12+ years" },
                        { key: "children" as const, label: "Children", desc: "2-11 years" },
                        { key: "infants" as const, label: "Infants", desc: "Under 2" },
                      ].map((p) => (
                        <div key={p.key} className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{p.label}</div>
                            <div className="text-xs text-muted-foreground">{p.desc}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-7 w-7 text-xs"
                              onClick={() => setPassengers(prev => ({ ...prev, [p.key]: Math.max(p.key === "adults" ? 1 : 0, prev[p.key] - 1) }))}>−</Button>
                            <span className="w-5 text-center text-sm font-semibold">{passengers[p.key]}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7 text-xs"
                              onClick={() => setPassengers(prev => ({ ...prev, [p.key]: prev[p.key] + 1 }))}>+</Button>
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-border">
                        <Select value={cabinClass} onValueChange={setCabinClass}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Economy", "Premium Economy", "Business", "First"].map(c => (
                              <SelectItem key={c} value={c.toLowerCase().replace(" ", "-")}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Select value={cabinClass} onValueChange={setCabinClass}>
                  <SelectTrigger className="h-9 w-auto text-xs border gap-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Economy", "Premium Economy", "Business", "First"].map(c => (
                      <SelectItem key={c} value={c.toLowerCase().replace(" ", "-")}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Search Fields - ShareTrip style inline */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-0 border border-border rounded-xl overflow-hidden bg-background">
              {/* From */}
              <div className="md:col-span-3 search-field border-b md:border-b-0 flex-col items-start">
                <div className="flex items-center gap-2 w-full">
                  <span className="text-lg font-bold text-primary">DAC</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">Dhaka</div>
                    <div className="text-[11px] text-muted-foreground truncate">Hazrat Shahjalal Intl Airport</div>
                  </div>
                </div>
              </div>

              {/* Swap */}
              <div className="hidden md:flex items-center justify-center -mx-4 z-10">
                <button className="w-9 h-9 rounded-full bg-card border-2 border-primary/30 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-sm">
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
              </div>

              {/* To */}
              <div className="md:col-span-3 search-field border-b md:border-b-0 flex-col items-start">
                <div className="flex items-center gap-2 w-full">
                  <span className="text-lg font-bold text-primary">CXB</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">Cox's Bazar</div>
                    <div className="text-[11px] text-muted-foreground truncate">Cox's Bazar Airport</div>
                  </div>
                </div>
              </div>

              {/* Depart */}
              <div className="md:col-span-2 search-field border-b md:border-b-0 flex-col items-start">
                <Popover>
                  <PopoverTrigger className="w-full text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{departDate ? format(departDate, "dd") : "26"}</span>
                      <div>
                        <div className="text-sm font-semibold">{departDate ? format(departDate, "MMMM") : "February"}</div>
                        <div className="text-[11px] text-muted-foreground">{departDate ? format(departDate, "EEEE, yyyy") : "Thursday, 2026"}</div>
                      </div>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={departDate} onSelect={setDepartDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Return */}
              {tripType === "roundtrip" && (
                <div className="md:col-span-2 search-field border-b md:border-b-0 flex-col items-start">
                  <Popover>
                    <PopoverTrigger className="w-full text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{returnDate ? format(returnDate, "dd") : "28"}</span>
                        <div>
                          <div className="text-sm font-semibold">{returnDate ? format(returnDate, "MMMM") : "February"}</div>
                          <div className="text-[11px] text-muted-foreground">{returnDate ? format(returnDate, "EEEE, yyyy") : "Saturday, 2026"}</div>
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={returnDate} onSelect={setReturnDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Search Button */}
              <div className={`${tripType === "roundtrip" ? "md:col-span-2" : "md:col-span-4"} flex items-center justify-center p-2`}>
                <Button className="w-full h-full min-h-[52px] rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 text-base font-bold shadow-lg shadow-secondary/20">
                  <Search className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Fare Type */}
            <div className="flex gap-4">
              {["Regular", "Student", "Umrah"].map((f) => (
                <label key={f} className="flex items-center gap-2 cursor-pointer text-sm">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    fareType === f.toLowerCase() ? "border-primary" : "border-muted-foreground/40"
                  }`}>
                    {fareType === f.toLowerCase() && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <span className={fareType === f.toLowerCase() ? "font-semibold text-foreground" : "text-muted-foreground"}>
                    {f} Fare
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTab === "hotel" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-0 border border-border rounded-xl overflow-hidden bg-background">
            <div className="md:col-span-4 search-field border-b md:border-b-0 flex-col items-start">
              <div className="flex items-center gap-2 w-full">
                <MapPin className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">Cox's Bazar</div>
                  <div className="text-[11px] text-muted-foreground">Cox's Bazar, Bangladesh</div>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 search-field border-b md:border-b-0 flex-col items-start">
              <Popover>
                <PopoverTrigger className="w-full text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{checkIn ? format(checkIn, "dd") : "27"}</span>
                    <div>
                      <div className="text-sm font-semibold">{checkIn ? format(checkIn, "MMMM, EEEE") : "February, Friday"}</div>
                      <div className="text-[11px] text-muted-foreground">Check-in</div>
                    </div>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={checkIn} onSelect={setCheckIn} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="md:col-span-2 search-field border-b md:border-b-0 flex-col items-start">
              <Popover>
                <PopoverTrigger className="w-full text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{checkOut ? format(checkOut, "dd") : "01"}</span>
                    <div>
                      <div className="text-sm font-semibold">{checkOut ? format(checkOut, "MMMM, EEEE") : "March, Sunday"}</div>
                      <div className="text-[11px] text-muted-foreground">Check-out</div>
                    </div>
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={checkOut} onSelect={setCheckOut} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="md:col-span-2 search-field border-b md:border-b-0 flex-col items-start">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">02</span>
                <div>
                  <div className="text-sm font-semibold">Guests</div>
                  <div className="text-[11px] text-muted-foreground">1 Room</div>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 flex items-center justify-center p-2">
              <Button className="w-full h-full min-h-[52px] rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 text-base font-bold shadow-lg shadow-secondary/20">
                <Search className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {activeTab === "visa" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-0 border border-border rounded-xl overflow-hidden bg-background">
            <div className="md:col-span-3 search-field border-b md:border-b-0 flex-col items-start">
              <div className="flex items-center gap-2 w-full">
                <span className="text-lg font-bold text-primary">TH</span>
                <div>
                  <div className="text-sm font-semibold">Thailand</div>
                  <div className="text-[11px] text-muted-foreground">Country</div>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 search-field border-b md:border-b-0 flex-col items-start">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">09</span>
                <div>
                  <div className="text-sm font-semibold">March</div>
                  <div className="text-[11px] text-muted-foreground">Monday, 2026</div>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 search-field border-b md:border-b-0 flex-col items-start">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">08</span>
                <div>
                  <div className="text-sm font-semibold">April</div>
                  <div className="text-[11px] text-muted-foreground">Wednesday, 2026</div>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 search-field border-b md:border-b-0 flex-col items-start">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">01</span>
                <div>
                  <div className="text-sm font-semibold">Traveller</div>
                  <div className="text-[11px] text-muted-foreground">Bangladeshi</div>
                </div>
              </div>
            </div>
            <div className="md:col-span-3 flex items-center justify-center p-2">
              <Button className="w-full h-full min-h-[52px] rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 text-base font-bold shadow-lg shadow-secondary/20">
                <Search className="w-5 h-5 mr-2" /> Search
              </Button>
            </div>
          </div>
        )}

        {activeTab === "holiday" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-0 border border-border rounded-xl overflow-hidden bg-background">
              <div className="md:col-span-5 search-field border-b md:border-b-0 flex-col items-start">
                <div className="flex items-center gap-2 w-full">
                  <span className="text-lg font-bold text-primary">BD</span>
                  <div>
                    <div className="text-sm font-semibold">Cox's Bazar</div>
                    <div className="text-[11px] text-muted-foreground">Destination</div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-4 search-field border-b md:border-b-0 flex-col items-start">
                <Popover>
                  <PopoverTrigger className="w-full text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{travelDate ? format(travelDate, "dd") : "25"}</span>
                      <div>
                        <div className="text-sm font-semibold">{travelDate ? format(travelDate, "MMMM") : "February"}</div>
                        <div className="text-[11px] text-muted-foreground">{travelDate ? format(travelDate, "EEEE, yyyy") : "Wednesday, 2026"}</div>
                      </div>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={travelDate} onSelect={setTravelDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="md:col-span-3 flex items-center justify-center p-2">
                <Button className="w-full h-full min-h-[52px] rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 text-base font-bold shadow-lg shadow-secondary/20">
                  <Search className="w-5 h-5 mr-2" /> Search
                </Button>
              </div>
            </div>
            <button className="text-sm text-primary font-medium hover:underline">+ Add another city</button>
          </div>
        )}

        {/* Other tabs - coming soon */}
        {!["flight", "hotel", "visa", "holiday"].includes(activeTab) && (
          <div className="py-10 text-center text-muted-foreground">
            <p className="text-lg font-semibold mb-1">{tabs.find(t => t.id === activeTab)?.label}</p>
            <p className="text-sm">Coming soon — this service will be available shortly.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchWidget;
