import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { automationFeatures } from "@/data/siteData";

export default function Automation() {
  const { toast } = useToast();

  const handleStart = () => {
    toast({
      title: "Starting Automation Setup",
      description: "In production: Redirect to Stripe checkout → then intake form",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-16 px-4">
      <div className="container max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">
            <span className="text-primary">Full Automation</span> Setup
          </h1>
          <p className="text-foreground/70 text-xl">
            We handle everything—from setup to ongoing optimization
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-card border border-primary/30 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-primary mb-6">Complete Package</h2>
            <ul className="space-y-4">
              {automationFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-card border-2 border-primary/50 rounded-xl p-8 flex flex-col">
            <div className="text-center mb-8">
              <div className="text-5xl font-bold text-primary mb-2">$599</div>
              <p className="text-muted-foreground">One-time setup fee</p>
            </div>

            <Button
              onClick={handleStart}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mb-4"
              size="lg"
            >
              <Zap className="inline w-5 h-5 mr-2" />
              Start Automation Setup
            </Button>

            <p className="text-muted-foreground text-sm text-center mb-6">
              Payment via Stripe, then complete detailed intake form
            </p>

            <div className="bg-muted border border-secondary/30 rounded-lg p-4">
              <p className="text-secondary font-semibold text-sm mb-1">Setup Timeline</p>
              <p className="text-foreground/70 text-sm">7–10 business days from intake completion</p>
            </div>
          </div>
        </div>

        <div className="bg-muted border border-primary/20 rounded-xl p-6">
          <h3 className="text-secondary font-bold mb-2">Important Note</h3>
          <p className="text-foreground/80">
            Automation requires active prop accounts and API access. Results depend on firm rules,
            market conditions, and your capital allocation. Execution risk remains with you.
          </p>
        </div>
      </div>
    </div>
  );
}
