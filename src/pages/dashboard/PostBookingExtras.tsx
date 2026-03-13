import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, UtensilsCrossed, Luggage, Package, AlertCircle, CheckCircle2, ShoppingCart, Plane, Info } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import SeatMap from "@/components/flights/SeatMap";

interface AncillaryItem {
  id: string;
  code?: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
  weight?: string;
  currency?: string;
}

const PostBookingExtras = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMeals, setSelectedMeals] = useState<string[]>([]);
  const [selectedBaggage, setSelectedBaggage] = useState<string[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Record<number, string>>({});
  const [seatPrices, setSeatPrices] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await api.get<any>(`/dashboard/bookings/${id}/ancillaries`);
        setData(result);
        if (!result.available) {
          setError("No ancillary add-ons are currently available for this booking from the airline.");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load ancillary offers");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const meals: AncillaryItem[] = data?.meals || [];
  const baggage: AncillaryItem[] = data?.baggage || [];
  const seatMapData = data?.seatMap || null;
  const flightInfo = data?.flightInfo || {};

  const toggleMeal = (mealId: string) => {
    setSelectedMeals(prev => prev.includes(mealId) ? prev.filter(m => m !== mealId) : [...prev, mealId]);
  };
  const toggleBaggage = (bagId: string) => {
    setSelectedBaggage(prev => prev.includes(bagId) ? prev.filter(b => b !== bagId) : [...prev, bagId]);
  };

  const handleSeatSelect = (paxIndex: number, seatId: string, price: number) => {
    setSelectedSeats(prev => ({ ...prev, [paxIndex]: seatId }));
    setSeatPrices(prev => ({ ...prev, [paxIndex]: price }));
  };
  const handleSeatDeselect = (paxIndex: number) => {
    setSelectedSeats(prev => { const n = { ...prev }; delete n[paxIndex]; return n; });
    setSeatPrices(prev => { const n = { ...prev }; delete n[paxIndex]; return n; });
  };

  const totalSeatCost = Object.values(seatPrices).reduce((sum, p) => sum + p, 0);
  const totalCost = [
    ...selectedMeals.map(id => meals.find(m => m.id === id)?.price || 0),
    ...selectedBaggage.map(id => baggage.find(b => b.id === id)?.price || 0),
  ].reduce((s, p) => s + p, 0) + totalSeatCost;

  const handlePurchase = () => {
    toast({ title: "Coming Soon", description: "Post-booking ancillary purchase will be processed via your payment method on file." });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const hasSeatMap = seatMapData?.available && seatMapData?.layout;
  const hasAnything = meals.length > 0 || baggage.length > 0 || hasSeatMap;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-xl font-bold">Post-Booking Extras</h1>
          <p className="text-sm text-muted-foreground">
            PNR: <code className="bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold">{data?.pnr || "—"}</code>
            {flightInfo.airline && <span className="ml-2">· {flightInfo.airline} {flightInfo.flightNumber}</span>}
            {flightInfo.origin && <span className="ml-1">({flightInfo.origin}→{flightInfo.destination})</span>}
            {data?.source && data.source !== 'none' && <span className="ml-2">· Source: {data.source}</span>}
          </p>
        </div>
      </div>

      {error && !hasAnything && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Seat Map Section */}
      {hasSeatMap && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Plane className="w-5 h-5 text-accent" /> Seat Selection</CardTitle>
            <CardDescription>Choose your preferred seats for this flight</CardDescription>
          </CardHeader>
          <CardContent>
            <SeatMap
              flightNumber={flightInfo.flightNumber || ""}
              aircraft=""
              cabinClass="Economy"
              passengers={[{ firstName: "Passenger", lastName: "1", title: "Mr" }]}
              selectedSeats={selectedSeats}
              onSeatSelect={handleSeatSelect}
              onSeatDeselect={handleSeatDeselect}
              seatMapData={seatMapData}
              seatMapSource={seatMapData?.source || "none"}
              seatMapLoading={false}
            />
            <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Seat selection is subject to airline confirmation. Final seat assignments will be confirmed at check-in. Seat prices are per passenger per segment.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasSeatMap && (
        <Card className="border-dashed">
          <CardContent className="text-center py-8">
            <Plane className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Seat Selection Not Available</p>
            <p className="text-xs text-muted-foreground mt-1">Real-time seat map data is not available for this airline. Seats will be assigned at check-in.</p>
          </CardContent>
        </Card>
      )}

      {meals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><UtensilsCrossed className="w-5 h-5 text-accent" /> Meals</CardTitle>
            <CardDescription>Select meal preferences for your journey</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {meals.map(meal => {
              const selected = selectedMeals.includes(meal.id);
              return (
                <button key={meal.id} onClick={() => toggleMeal(meal.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${selected ? "border-accent bg-accent/5" : "border-border hover:border-accent/30"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{meal.name}</p>
                      {meal.description && <p className="text-xs text-muted-foreground mt-0.5">{meal.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-bold">৳{meal.price.toLocaleString()}</Badge>
                      {selected && <CheckCircle2 className="w-4 h-4 text-accent" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {baggage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Luggage className="w-5 h-5 text-accent" /> Extra Baggage</CardTitle>
            <CardDescription>Add extra checked baggage to your booking</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {baggage.map(bag => {
              const selected = selectedBaggage.includes(bag.id);
              return (
                <button key={bag.id} onClick={() => toggleBaggage(bag.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${selected ? "border-accent bg-accent/5" : "border-border hover:border-accent/30"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{bag.name}</p>
                      {bag.weight && <p className="text-xs text-muted-foreground">{bag.weight}</p>}
                      {bag.description && <p className="text-xs text-muted-foreground mt-0.5">{bag.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-bold">৳{bag.price.toLocaleString()}</Badge>
                      {selected && <CheckCircle2 className="w-4 h-4 text-accent" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {(selectedMeals.length > 0 || selectedBaggage.length > 0 || Object.keys(selectedSeats).length > 0) && (
        <>
          <Separator />
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-accent" />
                <div>
                  <p className="font-bold">
                    {selectedMeals.length + selectedBaggage.length + Object.keys(selectedSeats).length} item{selectedMeals.length + selectedBaggage.length + Object.keys(selectedSeats).length > 1 ? "s" : ""} selected
                  </p>
                  <p className="text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">৳{totalCost.toLocaleString()}</span></p>
                </div>
              </div>
              <Button onClick={handlePurchase} className="font-bold">
                <Package className="w-4 h-4 mr-1.5" /> Purchase Add-ons
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {!hasAnything && !error && (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">No ancillary add-ons available</p>
            <p className="text-xs text-muted-foreground mt-1">The airline hasn't provided any purchasable extras for this booking</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PostBookingExtras;
