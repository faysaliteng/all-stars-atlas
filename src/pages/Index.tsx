import { motion } from "framer-motion";
import type { Easing } from "framer-motion";
import { ArrowRight, Star, MapPin, Shield, Headphones, BadgePercent, Smartphone, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import SearchWidget from "@/components/search/SearchWidget";

// --- Data ---
const offers = [
  { title: "Exclusive Fares on Int'l Flights", discount: "Up to 16% OFF", desc: "International flights with partner bank cards", gradient: "from-blue-600 to-blue-800" },
  { title: "Domestic Flight Deals", discount: "৳1,000 OFF", desc: "Save on domestic routes with credit cards", gradient: "from-emerald-500 to-emerald-700" },
  { title: "Student Fare Special", discount: "Extra Baggage", desc: "Affordable flights with extra luggage for students", gradient: "from-orange-500 to-orange-700" },
];

const exploreBD = [
  { name: "Cox's Bazar", hotels: 97, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Cox%27s_Bazar.jpg" },
  { name: "Sylhet", hotels: 44, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/AzOSQlJV2UD8QhKVOKLteYWlrI9brl.png" },
  { name: "Chittagong", hotels: 36, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/8gohsAnVmFQmPRtUKSrdpIMi1SlE16.gif" },
  { name: "Dhaka", hotels: 43, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/XjOR77hq4zWYqqMRK8yI2uRfemtbgg.png" },
  { name: "Sreemangal", hotels: 6, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/wcmMawEQourNqilRyE2GOHHv0tYzVP.png" },
  { name: "Gazipur", hotels: 12, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/TdXdFC08piA8Csi3X8qqreie9UUzif.png" },
];

const airlines = [
  { name: "Biman Bangladesh", code: "BG" }, { name: "US-Bangla", code: "BS" },
  { name: "NOVOAIR", code: "VQ" }, { name: "Air Astra", code: "2A" },
  { name: "Emirates", code: "EK" }, { name: "Singapore Airlines", code: "SQ" },
  { name: "Malaysia Airlines", code: "MH" }, { name: "Qatar Airways", code: "QR" },
  { name: "Saudia", code: "SV" }, { name: "Turkish Airlines", code: "TK" },
  { name: "Thai Airways", code: "TG" }, { name: "IndiGo", code: "6E" },
];

const intlDestinations = [
  { name: "Kathmandu", hotels: "1,152", img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Kathamandu.jpg" },
  { name: "Bangkok", hotels: "4,351", img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Bangkok.jpg" },
  { name: "Singapore", hotels: "813", img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Singapore.jpg" },
  { name: "Kuala Lumpur", hotels: "2,464", img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Kuala_Lumpur.jpg" },
  { name: "Maldives", hotels: "36", img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Maafushi.jpg" },
  { name: "Kolkata", hotels: "1,319", img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Kolkata.jpg" },
];

const bestHotels = [
  { name: "Sea Pearl Beach Resort & Spa", location: "Cox's Bazar", rating: 5, reviews: 431, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/agoda-2564409-60592569-839740.jpg" },
  { name: "Bhawal Resort & Spa", location: "Gazipur", rating: 5, reviews: 264, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/bhawal-resort-spa-20210907174024.jpg" },
  { name: "Grand Sylhet Hotel & Resort", location: "Sylhet", rating: 5, reviews: 159, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/267736179_149939317369872_2872125975221274736_n.jpg" },
  { name: "Sayeman Beach Resort", location: "Cox's Bazar", rating: 5, reviews: 453, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/sayeman_-1.PNG" },
];

const tourPackages = [
  { name: "Bangkok", rating: 5, reviews: 57, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Bangkok.jpg" },
  { name: "Maldives", rating: 5, reviews: 29, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Maafushi.jpg" },
  { name: "Kolkata", rating: 4.5, reviews: 97, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Kolkata.jpg" },
  { name: "Kuala Lumpur", rating: 5, reviews: 68, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Kuala_Lumpur.jpg" },
  { name: "Singapore", rating: 5, reviews: 33, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Singapore.jpg" },
  { name: "Dubai", rating: 5, reviews: 36, img: "https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/promotion/Dubai.jpg" },
];

const domesticRoutes = [
  { from: "Dhaka", fromAirport: "Hazrat Shahjalal Intl Airport", to: "Cox's Bazar", toAirport: "Cox's Bazar Airport" },
  { from: "Dhaka", fromAirport: "Hazrat Shahjalal Intl Airport", to: "Jashore", toAirport: "Jashore Airport" },
  { from: "Dhaka", fromAirport: "Hazrat Shahjalal Intl Airport", to: "Chattogram", toAirport: "Shah Amanat Intl Airport" },
  { from: "Dhaka", fromAirport: "Hazrat Shahjalal Intl Airport", to: "Sylhet", toAirport: "Osmany Intl Airport" },
  { from: "Dhaka", fromAirport: "Hazrat Shahjalal Intl Airport", to: "Barisal", toAirport: "Barisal Airport" },
  { from: "Dhaka", fromAirport: "Hazrat Shahjalal Intl Airport", to: "Saidpur", toAirport: "Saidpur Airport" },
];

const features = [
  { icon: Shield, title: "Secure Booking", desc: "100% data protection & secure payments" },
  { icon: BadgePercent, title: "Best Price Guarantee", desc: "We match any lower price you find" },
  { icon: Headphones, title: "24/7 Support", desc: "Round-the-clock customer assistance" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5, ease: [0, 0, 0.2, 1] as const } }),
};

const Index = () => {
  return (
    <div className="overflow-hidden">
      {/* ===== HERO ===== */}
      <section className="relative min-h-[520px] md:min-h-[580px]">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />

        <div className="relative container mx-auto px-4 pt-28 md:pt-32 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl md:text-5xl lg:text-[56px] font-extrabold text-white mb-3 leading-tight tracking-tight">
              Welcome to <span className="text-secondary">TravelHub!</span>
            </h1>
            <p className="text-base md:text-lg text-white/75 font-medium">
              Find Flights, Hotels, Visa & Holidays
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="max-w-[1100px] mx-auto"
          >
            <SearchWidget />
          </motion.div>
        </div>
      </section>

      {/* ===== FEATURES STRIP ===== */}
      <section className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">{f.title}</h4>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== EXCLUSIVE OFFERS ===== */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-7">
            <h2 className="section-title">Exclusive Offers</h2>
            <Button variant="ghost" className="text-primary font-semibold hidden md:flex">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {offers.map((offer, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className={`offer-card bg-gradient-to-br ${offer.gradient} p-6 text-white min-h-[180px] flex flex-col justify-between`}
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
                <div className="relative z-10">
                  <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold mb-3">
                    {offer.discount}
                  </span>
                  <h3 className="text-lg font-bold mb-1">{offer.title}</h3>
                  <p className="text-sm text-white/75">{offer.desc}</p>
                </div>
                <Button size="sm" variant="secondary" className="relative z-10 w-fit mt-4 group-hover:translate-x-1 transition-transform">
                  Book Now <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== EXPLORE BANGLADESH ===== */}
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="section-title">Explore Bangladesh</h2>
            <p className="text-muted-foreground mt-1.5 max-w-xl mx-auto text-sm">
              Experience rich culture and majestic beauty. Plan your trip now!
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {exploreBD.map((dest, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="destination-card"
              >
                <div className="aspect-[4/5] relative">
                  <img src={dest.img} alt={dest.name} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h4 className="font-bold text-white text-sm">{dest.name}</h4>
                    <p className="text-[11px] text-white/70">{dest.hotels} Hotels Available</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TOP AIRLINES ===== */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="section-title">Search Top Airlines</h2>
            <p className="text-muted-foreground mt-1.5 text-sm max-w-xl mx-auto">
              Connect to top airlines instantly. Enjoy comfortable, hassle-free journeys.
            </p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-3">
            {airlines.map((airline, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="airline-card"
              >
                <img
                  src={`https://tbbd-flight.s3.ap-southeast-1.amazonaws.com/airlines-logo/${airline.code}.png`}
                  alt={airline.name}
                  className="w-12 h-12 object-contain"
                  loading="lazy"
                />
                <span className="text-xs font-medium text-center leading-tight">{airline.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== POPULAR DESTINATIONS ===== */}
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="section-title">Most Popular Destinations</h2>
            <p className="text-muted-foreground mt-1.5 text-sm max-w-xl mx-auto">
              Explore the world — Asia, Europe, America and more.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {intlDestinations.map((dest, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="destination-card"
              >
                <div className="aspect-[4/5] relative">
                  <img src={dest.img} alt={dest.name} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h4 className="font-bold text-white text-sm">{dest.name}</h4>
                    <p className="text-[11px] text-white/70">{dest.hotels} Hotels Available</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== BEST HOTELS ===== */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="section-title">Best Hotels for Your Next Trip</h2>
            <p className="text-muted-foreground mt-1.5 text-sm max-w-xl mx-auto">
              Luxurious or budget-friendly — browse accommodations that meet your need.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {bestHotels.map((hotel, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="bg-card rounded-2xl overflow-hidden border border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer group"
              >
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={hotel.img} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
                <div className="p-4">
                  <h4 className="font-bold text-sm mb-1 truncate">{hotel.name}</h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                    <MapPin className="w-3 h-3" /> {hotel.location}
                  </p>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className={`w-3.5 h-3.5 ${j < hotel.rating ? "fill-warning text-warning" : "text-muted"}`} />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">({hotel.reviews})</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TOUR PACKAGES ===== */}
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="section-title">Our Tour Packages for You</h2>
            <p className="text-muted-foreground mt-1.5 text-sm max-w-xl mx-auto">
              Plan your dream getaway with our curated holiday packages.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {tourPackages.map((pkg, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="destination-card"
              >
                <div className="aspect-[4/5] relative">
                  <img src={pkg.img} alt={pkg.name} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h4 className="font-bold text-white text-sm">{pkg.name}</h4>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 fill-warning text-warning" />
                      <span className="text-[11px] text-white/80">{pkg.rating} ({pkg.reviews})</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TOP ROUTES ===== */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="section-title">Top Domestic & International Routes</h2>
            <p className="text-muted-foreground mt-1.5 text-sm max-w-xl mx-auto">
              Choose from hundreds of airlines for your next trip.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {domesticRoutes.map((route, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/20 transition-all cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold">{route.from}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{route.fromAirport}</div>
                </div>
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/8 flex items-center justify-center">
                  <ChevronRight className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="text-sm font-bold">{route.to}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{route.toAirport}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== APP DOWNLOAD ===== */}
      <section className="py-12 md:py-16 hero-gradient">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left max-w-lg">
              <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-3 tracking-tight">
                Your All-in-One Travel App
              </h2>
              <p className="text-white/70 mb-6 text-sm md:text-base">
                Get flights, hotels, holidays and visa assistance in just a few taps. Real-time updates, exclusive deals, and rewards.
              </p>
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <Button variant="secondary" size="lg" className="font-bold">
                  <Smartphone className="w-5 h-5 mr-2" />
                  Download App
                </Button>
              </div>
            </div>
            <div className="w-48 h-48 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-sm">
              <div className="text-center text-white/60">
                <Smartphone className="w-12 h-12 mx-auto mb-2 animate-float" />
                <span className="text-xs font-medium">Scan QR Code</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
