import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu, User, Plane, Building2, FileText, Palmtree,
  ChevronDown, Gift, ShoppingBag, Bus, MoreHorizontal, Phone
} from "lucide-react";

const mainNav = [
  { label: "Flight", href: "/flights", icon: Plane },
  { label: "Hotel", href: "/hotels", icon: Building2 },
  { label: "Holiday", href: "/holidays", icon: Palmtree },
];

const moreItems = [
  { label: "Visa", href: "/visa" },
  { label: "eSIM", href: "#" },
  { label: "Recharge", href: "#" },
  { label: "Pay Bill", href: "#" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const headerBg = isHome && !scrolled
    ? "bg-transparent"
    : "bg-card/98 backdrop-blur-xl shadow-sm border-b border-border/50";

  const textColor = isHome && !scrolled ? "text-white" : "text-foreground";
  const mutedColor = isHome && !scrolled ? "text-white/70" : "text-muted-foreground";

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBg}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-[68px]">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl hero-gradient flex items-center justify-center shadow-md">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <span className={`text-xl font-extrabold tracking-tight ${textColor}`}>
              TravelHub
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`px-4 py-2 rounded-lg text-[15px] font-semibold transition-colors ${mutedColor} hover:${textColor} ${
                  isHome && !scrolled ? "hover:bg-white/10" : "hover:bg-muted"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Visa dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className={`flex items-center gap-1 px-4 py-2 rounded-lg text-[15px] font-semibold transition-colors ${mutedColor} ${
                isHome && !scrolled ? "hover:bg-white/10" : "hover:bg-muted"
              }`}>
                Visa <ChevronDown className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem asChild><Link to="/visa">Visa Application</Link></DropdownMenuItem>
                <DropdownMenuItem>Visa Requirements</DropdownMenuItem>
                <DropdownMenuItem>Track Application</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Others dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className={`flex items-center gap-1 px-4 py-2 rounded-lg text-[15px] font-semibold transition-colors ${mutedColor} ${
                isHome && !scrolled ? "hover:bg-white/10" : "hover:bg-muted"
              }`}>
                Others <ChevronDown className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem>eSIM</DropdownMenuItem>
                <DropdownMenuItem>Recharge</DropdownMenuItem>
                <DropdownMenuItem>Pay Bill</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Right Side */}
          <div className="hidden lg:flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={`font-semibold ${mutedColor} ${isHome && !scrolled ? "hover:bg-white/10 hover:text-white" : ""}`}
            >
              <Link to="/auth/login">
                <User className="w-4 h-4 mr-1.5" />
                Login
              </Link>
            </Button>
          </div>

          {/* Mobile */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className={textColor}>
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <div className="flex flex-col h-full">
                <div className="p-5 border-b border-border">
                  <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                    <div className="w-9 h-9 rounded-xl hero-gradient flex items-center justify-center">
                      <Plane className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-extrabold">TravelHub</span>
                  </Link>
                </div>
                <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                  {[...mainNav, { label: "Visa", href: "/visa", icon: FileText }].map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-foreground hover:bg-muted transition-colors font-medium"
                    >
                      <item.icon className="w-5 h-5 text-primary" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <div className="p-4 border-t border-border space-y-2">
                  <Button className="w-full" asChild>
                    <Link to="/auth/login" onClick={() => setMobileOpen(false)}>Login</Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/auth/register" onClick={() => setMobileOpen(false)}>Create Account</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;
