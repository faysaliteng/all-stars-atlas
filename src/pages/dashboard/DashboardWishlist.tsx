import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Plane, Building2, Palmtree, Trash2, ArrowRight, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const mockWishlist = [
  { id: 1, type: "flight", title: "Dhaka → Bangkok", subtitle: "Round Trip • 2 Adults", price: "৳24,500", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400", rating: 4.7, saved: "2 days ago" },
  { id: 2, type: "hotel", title: "Royal Tulip Sea Pearl Beach", subtitle: "Cox's Bazar • 5 Star", price: "৳8,500/night", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400", rating: 4.8, saved: "1 week ago" },
  { id: 3, type: "holiday", title: "Maldives Dream Package", subtitle: "5 Days 4 Nights • All Inclusive", price: "৳89,000", image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400", rating: 4.9, saved: "3 days ago" },
  { id: 4, type: "flight", title: "Dhaka → Singapore", subtitle: "One Way • 1 Adult", price: "৳18,200", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400", rating: 4.6, saved: "5 days ago" },
  { id: 5, type: "hotel", title: "Pan Pacific Sonargaon", subtitle: "Dhaka • 5 Star", price: "৳12,000/night", image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400", rating: 4.5, saved: "1 day ago" },
];

const typeIcons: Record<string, typeof Plane> = { flight: Plane, hotel: Building2, holiday: Palmtree };
const typeColors: Record<string, string> = { flight: "bg-primary/10 text-primary", hotel: "bg-secondary/10 text-secondary", holiday: "bg-accent/10 text-accent" };

const DashboardWishlist = () => {
  const [items, setItems] = useState(mockWishlist);
  const { toast } = useToast();

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
    toast({ title: "Removed", description: "Item removed from wishlist" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">My Wishlist</h1>
        <p className="text-sm text-muted-foreground">{items.length} saved items</p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Heart className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-bold mb-2">Your wishlist is empty</h3>
            <p className="text-sm text-muted-foreground mb-4">Save flights, hotels, and packages you love for later</p>
            <Button asChild><Link to="/">Browse Services</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => {
            const Icon = typeIcons[item.type] || Plane;
            return (
              <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-all group">
                <div className="relative h-40 overflow-hidden">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <Badge className={`absolute top-3 left-3 text-[10px] ${typeColors[item.type]}`}>
                    <Icon className="w-3 h-3 mr-1" /> {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </Badge>
                  <button onClick={() => removeItem(item.id)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/80 backdrop-blur flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-bold">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs">
                    <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                    <span className="font-bold">{item.rating}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <p className="font-black text-primary">{item.price}</p>
                    <Button size="sm" className="text-xs font-bold">
                      Book <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">Saved {item.saved}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DashboardWishlist;
