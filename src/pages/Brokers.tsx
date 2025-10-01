import { AlertCircle } from "lucide-react";
import { BrokerCard } from "@/components/BrokerCard";
import { brokersData } from "@/data/siteData";

export default function Brokers() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-16 px-4">
      <div className="container mx-auto">
        <h1 className="text-5xl font-bold mb-4 text-center">
          Vetted <span className="text-primary">Prop Brokers</span>
        </h1>
        <p className="text-foreground/70 text-xl text-center mb-12 max-w-3xl mx-auto">
          We've partnered with trusted prop trading firms to bring you competitive rates and
          reliable platforms.
        </p>

        <div className="bg-muted border border-secondary/30 rounded-xl p-6 mb-12">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-secondary flex-shrink-0" />
            <div>
              <h3 className="text-secondary font-bold mb-2">Transparency Disclosure</h3>
              <p className="text-foreground/80">
                We may receive per-lot rebates if you use our referral links. You pay nothing extra
                and often receive better rates than going direct. This helps us maintain free
                educational content.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {brokersData.map((broker) => (
            <BrokerCard key={broker.id} {...broker} />
          ))}
        </div>
      </div>
    </div>
  );
}
