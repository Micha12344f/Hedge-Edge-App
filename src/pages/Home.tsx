import { Link } from "react-router-dom";
import { BookOpen, Shield, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingCard } from "@/components/PricingCard";
import { tiersData } from "@/data/siteData";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-muted to-background py-20 px-4">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary rounded-full blur-blob"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary rounded-full blur-blob"></div>
        </div>

        <div className="container max-w-3xl text-center relative z-10 mx-auto">
          <div className="inline-block mb-4 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full">
            <span className="text-primary font-semibold text-sm">🔒 Education & Tools Platform</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Master <span className="text-primary">Hedge Strategies</span> for Prop Trading
          </h1>
          <p className="text-xl text-foreground/80 mb-8">
            Learn proven hedging techniques, connect with vetted brokers, and optionally automate
            your strategy with expert guidance.
          </p>
          <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
            <Link to="/learn">Download Free Hedge Guide</Link>
          </Button>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 justify-center p-4 bg-card border border-primary/20 rounded-lg">
              <BookOpen className="w-5 h-5 text-secondary" />
              <span className="font-semibold">Free Education</span>
            </div>
            <div className="flex items-center gap-3 justify-center p-4 bg-card border border-primary/20 rounded-lg">
              <Shield className="w-5 h-5 text-secondary" />
              <span className="font-semibold">Vetted Brokers</span>
            </div>
            <div className="flex items-center gap-3 justify-center p-4 bg-card border border-primary/20 rounded-lg">
              <Zap className="w-5 h-5 text-secondary" />
              <span className="font-semibold">Automation Available</span>
            </div>
          </div>
        </div>
      </section>

      {/* Certificates Section */}
      <section className="py-16 px-4 bg-background">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">
            Join <span className="text-primary">Funded Traders</span> Worldwide
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Our students have successfully passed evaluations with top prop firms
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Certificate 1 - The 5%ers */}
            <div className="bg-gradient-to-br from-blue-950/50 to-blue-900/30 border border-secondary/30 rounded-xl p-6 hover:scale-105 transition-all shadow-lg">
              <div className="text-center mb-4">
                <div className="text-secondary text-sm font-semibold mb-2">The 5%ers</div>
                <h3 className="text-2xl font-bold mb-1">FUNDED</h3>
                <h3 className="text-xl font-bold">CERTIFICATE</h3>
              </div>
              <div className="border-t border-secondary/30 pt-4 mb-4">
                <p className="text-foreground/60 text-xs text-center mb-3">
                  Proudly presented to
                </p>
                <div className="bg-secondary/10 rounded px-3 py-2 text-center">
                  <span className="font-semibold">[Student Name]</span>
                </div>
              </div>
              <p className="text-foreground/50 text-xs text-center leading-relaxed">
                Successfully completed evaluation program and officially funded
              </p>
            </div>

            {/* Certificate 2 - FTMO */}
            <div className="bg-gradient-to-br from-cyan-950/50 to-cyan-900/30 border border-primary/30 rounded-xl p-6 hover:scale-105 transition-all shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-bl-full"></div>
              <div className="text-center mb-4">
                <div className="text-lg font-bold mb-2">◆ FTMO®</div>
                <h3 className="text-2xl font-bold mb-1">MAX</h3>
                <h3 className="text-xl font-bold">ALLOCATION</h3>
              </div>
              <div className="border-t border-primary/30 pt-4 mb-4">
                <p className="text-foreground/60 text-xs text-center mb-3">
                  Proudly presented to:
                </p>
                <div className="bg-primary/10 rounded px-3 py-2 text-center">
                  <span className="text-secondary font-bold text-lg">[Student Name]</span>
                </div>
              </div>
              <div className="flex justify-between text-xs text-foreground/50 mt-4">
                <span>Date: [XX/XX/XXXX]</span>
              </div>
            </div>

            {/* Certificate 3 - TopStep */}
            <div className="bg-white border-2 border-black rounded-xl overflow-hidden hover:scale-105 transition-all shadow-lg">
              <div className="bg-black text-white p-4 text-center">
                <h3 className="text-xs font-bold tracking-widest mb-1">CERTIFIED</h3>
                <h3 className="text-xl font-bold">FUNDED TRADER</h3>
              </div>
              <div className="p-6 bg-white">
                <div className="text-right mb-4">
                  <span className="text-black font-bold text-lg">TOPSTEP</span>
                </div>
                <p className="text-black text-xs text-center mb-3 uppercase">
                  This certificate is proudly presented to
                </p>
                <div className="border-2 border-black rounded px-3 py-2 text-center mb-4">
                  <span className="text-black font-bold">[Student Name]</span>
                </div>
                <p className="text-black/70 text-xs text-center leading-relaxed mb-4">
                  Successfully passed the Trading Combine™ and is officially a TopStep Funded
                  Trader
                </p>
                <div className="flex justify-center">
                  <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                    <span className="text-black font-bold text-xl">T</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Certificate 4 - My Funded Futures */}
            <div className="bg-gradient-to-br from-slate-950/50 to-slate-900/30 border border-secondary/30 rounded-xl p-6 hover:scale-105 transition-all shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-secondary rounded flex items-center justify-center">
                  <span className="text-primary-foreground font-bold">🛡</span>
                </div>
                <span className="font-semibold text-sm">My Funded Futures</span>
              </div>
              <div className="text-center mb-4">
                <h3 className="text-2xl font-bold mb-1">PASSING</h3>
                <h3 className="text-xl font-bold">CERTIFICATE</h3>
              </div>
              <div className="border-t border-secondary/30 pt-4 mb-4">
                <p className="text-foreground/60 text-xs text-center mb-3">awarded to</p>
                <div className="bg-secondary/10 rounded px-3 py-2 text-center mb-3">
                  <span className="text-secondary font-bold text-lg">[Student Name]</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-foreground/50">Date</p>
                  <p className="font-semibold">[XX/XX/XXXX]</p>
                </div>
                <div>
                  <p className="text-foreground/50">Account Size</p>
                  <p className="text-primary font-bold">$150,000</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground text-sm mb-4">
              Ready to join them? Start with our free guide
            </p>
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/learn">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="py-16 px-4 bg-muted">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">
            Choose Your <span className="text-primary">Learning Path</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Start with our free resources or accelerate your journey with personalized guidance
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {tiersData.map((tier) => (
              <PricingCard key={tier.name} {...tier} />
            ))}
          </div>
        </div>
      </section>

      {/* Broker Disclosure */}
      <section className="py-12 px-4 bg-background border-t border-b border-primary/20">
        <div className="container max-w-3xl mx-auto">
          <div className="flex items-start gap-4 bg-muted p-6 rounded-lg border border-secondary/30">
            <AlertCircle className="w-6 h-6 text-secondary flex-shrink-0" />
            <div>
              <h3 className="text-secondary font-bold text-lg mb-2">
                Broker Relationship Disclosure
              </h3>
              <p className="text-foreground/80 text-sm leading-relaxed">
                We may receive per-lot rebates from brokers when you use our referral links. This
                compensation helps us provide free educational content. You pay nothing extra—in
                fact, you often receive the same or better rates. We only recommend brokers we've
                thoroughly vetted.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
