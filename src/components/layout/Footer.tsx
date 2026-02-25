import { Link } from "react-router-dom";
import { Plane, Mail, Phone, MapPin, Facebook, Instagram, Youtube, Twitter } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-[hsl(220_25%_10%)] text-white">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl hero-gradient flex items-center justify-center">
                <Plane className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-extrabold">TravelHub</span>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed">
              Your trusted travel partner for flights, hotels, visa and holiday packages. Best prices guaranteed with 24/7 customer support.
            </p>
            <div className="flex gap-2.5">
              {[Facebook, Instagram, Twitter, Youtube].map((Icon, i) => (
                <a key={i} href="#" className="w-9 h-9 rounded-lg bg-white/8 hover:bg-primary flex items-center justify-center transition-colors">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-bold text-sm mb-4 uppercase tracking-wider text-white/80">Services</h4>
            <ul className="space-y-2.5 text-sm text-white/50">
              {[
                { label: "Flight Booking", href: "/flights" },
                { label: "Hotel Reservation", href: "/hotels" },
                { label: "Visa Processing", href: "/visa" },
                { label: "Holiday Packages", href: "/holidays" },
                { label: "Travel Insurance", href: "#" },
              ].map((item) => (
                <li key={item.label}>
                  <Link to={item.href} className="hover:text-white transition-colors">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-sm mb-4 uppercase tracking-wider text-white/80">Company</h4>
            <ul className="space-y-2.5 text-sm text-white/50">
              {["About Us", "Contact", "Blog", "Careers", "Terms & Conditions", "Privacy Policy", "Refund Policy"].map((item) => (
                <li key={item}>
                  <Link to="#" className="hover:text-white transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-sm mb-4 uppercase tracking-wider text-white/80">Contact Us</h4>
            <ul className="space-y-3 text-sm text-white/50">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-white/40" />
                <span>123 Travel Street, Dhaka 1205, Bangladesh</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 shrink-0 text-white/40" />
                <span>+880 1234-567890</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 shrink-0 text-white/40" />
                <span>support@travelhub.com</span>
              </li>
            </ul>

            <div className="mt-6">
              <h5 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2.5">We Accept</h5>
              <div className="flex flex-wrap gap-1.5">
                {["bKash", "Nagad", "VISA", "Master", "AMEX"].map((m) => (
                  <span key={m} className="px-2 py-1 bg-white/8 rounded text-[10px] font-semibold text-white/60">{m}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/8">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] text-white/30">
          <p>© {new Date().getFullYear()} TravelHub. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>IATA Accredited</span>
            <span>•</span>
            <span>ATAB Member</span>
            <span>•</span>
            <span>Superbrands Award</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
