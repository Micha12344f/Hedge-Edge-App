import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrokerCardProps {
  name: string;
  logo: string;
  description: string;
  minDeposit: string;
  maxDrawdown: string;
  profitSplit: string;
  features: string[];
  hasRebate: boolean;
}

export const BrokerCard = ({
  name,
  logo,
  description,
  minDeposit,
  maxDrawdown,
  profitSplit,
  features,
  hasRebate,
}: BrokerCardProps) => {
  return (
    <div className="bg-card border border-primary/30 rounded-xl p-6 hover:border-primary transition-all">
      <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
        <span className="text-primary font-bold text-xl">{logo}</span>
      </div>
      <h3 className="text-2xl font-bold mb-2">{name}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Min Deposit:</span>
          <span className="font-semibold">{minDeposit}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Max Drawdown:</span>
          <span className="font-semibold">{maxDrawdown}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Profit Split:</span>
          <span className="text-primary font-semibold">{profitSplit}</span>
        </div>
      </div>

      <ul className="space-y-2 mb-4">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-primary" />
            <span className="text-foreground/80">{feature}</span>
          </li>
        ))}
      </ul>

      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        Learn More
      </Button>
      
      {hasRebate && (
        <p className="text-secondary text-xs text-center mt-3">⭐ Affiliate Partner</p>
      )}
    </div>
  );
};
