import { CheckCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Consult() {
  const { toast } = useToast();

  const handleBooking = () => {
    toast({
      title: "Booking Consultation",
      description: "In production: Redirect to Stripe checkout → then Calendly booking",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-16 px-4">
      <div className="container max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">
            <span className="text-secondary">1-on-1</span> Strategy Consultation
          </h1>
          <p className="text-foreground/70 text-xl">
            Get personalized guidance from an experienced prop trader
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-card border border-primary/30 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-primary mb-6">What's Included</h2>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
                <span>Full 60-minute video call</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
                <span>Custom hedge strategy review</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
                <span>Broker selection guidance</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
                <span>Risk management analysis</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
                <span>Prop firm rule optimization</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
                <span>7-day email follow-up support</span>
              </li>
            </ul>
          </div>

          <div className="bg-card border-2 border-secondary/50 rounded-xl p-8 flex flex-col">
            <div className="text-center mb-8">
              <div className="text-5xl font-bold text-secondary mb-2">$99</div>
              <p className="text-muted-foreground">One-time payment</p>
            </div>

            <Button
              onClick={handleBooking}
              className="w-full bg-secondary text-primary-foreground hover:bg-secondary/90 mb-4"
              size="lg"
            >
              <Calendar className="inline w-5 h-5 mr-2" />
              Book Consultation Now
            </Button>

            <p className="text-muted-foreground text-sm text-center">
              Payment via Stripe, then instant Calendly access
            </p>
          </div>
        </div>

        <div className="bg-muted border border-primary/20 rounded-xl p-6">
          <h3 className="text-secondary font-bold mb-2">Who This Is For</h3>
          <p className="text-foreground/80">
            Ideal for traders who understand prop firms and hedging basics but need expert guidance
            to refine approach, select brokers, and optimize risk.
          </p>
        </div>
      </div>
    </div>
  );
}
