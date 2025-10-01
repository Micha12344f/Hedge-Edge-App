import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PricingCardProps {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  ctaLink: string;
  popular?: boolean;
}

export const PricingCard = ({
  name,
  price,
  description,
  features,
  cta,
  ctaLink,
  popular,
}: PricingCardProps) => {
  return (
    <div
      className={`relative bg-card border-2 rounded-xl p-6 transition-all hover:scale-105 ${
        popular
          ? "border-secondary shadow-xl shadow-secondary/20"
          : "border-primary/30"
      }`}
    >
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold">
          MOST POPULAR
        </div>
      )}
      <h3 className="text-2xl font-bold text-primary mb-2">{name}</h3>
      <div className="text-4xl font-bold mb-2">{price}</div>
      <p className="text-muted-foreground mb-6">{description}</p>
      <ul className="space-y-3 mb-8">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <span className="text-foreground/90">{feature}</span>
          </li>
        ))}
      </ul>
      <Button
        asChild
        className={`w-full ${
          popular
            ? "bg-secondary text-primary-foreground hover:bg-secondary/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        <Link to={ctaLink}>{cta}</Link>
      </Button>
    </div>
  );
};
