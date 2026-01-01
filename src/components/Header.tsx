import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { TrendingUp, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/learn", label: "Free Guide" },
    { href: "/consult", label: "Consult" },
    { href: "/automation", label: "Automation" },
    { href: "/calculator", label: "Calculator" },
    { href: "/brokers", label: "Brokers" },
    { href: "/faq", label: "FAQ" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  return (
    <header className="bg-background border-b border-primary/20 sticky top-0 z-40 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-primary flex items-center gap-2 hover:opacity-80 transition-opacity">
            <TrendingUp className="w-8 h-8" />
            <span>HedgeEdge</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`transition-colors ${
                  link.href === "/automation"
                    ? "text-secondary font-semibold"
                    : link.href === "/consult"
                    ? "text-[hsl(200,100%,60%)] font-semibold"
                    : link.href === "/calculator"
                    ? "text-[#39FF14] font-semibold"
                    : isActive(link.href)
                    ? "text-primary font-semibold"
                    : "text-foreground hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        {mobileMenuOpen && (
          <nav className="md:hidden flex flex-col gap-3 mt-4 pb-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`transition-colors ${
                  link.href === "/automation"
                    ? "text-secondary font-semibold"
                    : link.href === "/consult"
                    ? "text-[hsl(200,100%,60%)] font-semibold"
                    : link.href === "/calculator"
                    ? "text-[#39FF14] font-semibold"
                    : isActive(link.href)
                    ? "text-primary font-semibold"
                    : "text-foreground hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
};
