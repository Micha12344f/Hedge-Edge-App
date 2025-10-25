import { Link } from "react-router-dom";
import { CheckCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  name: string;
  price: string;
  originalPrice?: string;
  description: string;
  features: string[];
  cta: string;
  ctaLink: string;
  popular?: boolean;
  locked?: boolean;
  status?: string;
}

export const PricingCard = ({
  name,
  price,
  originalPrice,
  description,
  features,
  cta,
  ctaLink,
  popular,
  locked,
  status,
}: PricingCardProps) => {
  const isLocked = Boolean(locked);
  const statusLabel = status ?? "Coming Soon";
  const cardClasses = cn(
    "relative border-2 rounded-xl p-6",
    isLocked
      ? "bg-muted/60 border-dashed border-muted-foreground/40 text-muted-foreground opacity-80 cursor-not-allowed"
      : "bg-card border-primary/30 transition-all hover:scale-105",
    !isLocked && popular && "border-secondary shadow-xl shadow-secondary/20"
  );

  return (
    <div className={cardClasses}>
      {!isLocked && popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold">
          MOST POPULAR
        </div>
      )}
      {isLocked && (
        <div className="absolute top-4 right-4 flex items-center gap-2 text-muted-foreground">
          <Lock className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">{statusLabel}</span>
        </div>
      )}
      <h3 className={`text-2xl font-bold mb-2 ${isLocked ? "text-muted-foreground" : "text-primary"}`}>
        {name}
      </h3>
      <div className="mb-2">
        {originalPrice && (
          <div className={`text-sm line-through ${isLocked ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
            Was {originalPrice}
          </div>
        )}
        <div className={`text-4xl font-bold ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
          {price}
        </div>
      </div>
      <p className="mb-6 text-muted-foreground">{description}</p>
      <ul className="space-y-3 mb-8">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <CheckCircle
              className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                isLocked ? "text-muted-foreground" : "text-primary"
              }`}
            />
            <span className={`${isLocked ? "text-muted-foreground" : "text-foreground/90"}`}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
      {isLocked ? (
        <Button
          className="w-full bg-muted text-muted-foreground cursor-not-allowed"
          disabled
        >
          <span className="flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            {statusLabel}
          </span>
        </Button>
      ) : (
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
      )}
    </div>
  );
};
