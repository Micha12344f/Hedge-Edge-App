import { Link } from "react-router-dom";
import { BookOpen, Shield, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingCard } from "@/components/PricingCard";
import { tiersData } from "@/data/siteData";
import cert5percenters from "@/assets/cert-5percenters.png";
import certFtmo from "@/assets/cert-ftmo.png";
import certTopstep from "@/assets/cert-topstep.png";
import certAtf from "@/assets/cert-atf.png";
import blackbullLogo from "@/assets/blackbull-logo.png";

const BLACKBULL_REFERRAL_URL =
  "https://blackbull.com/en/live-account/?cmp=5p0z2d3q&refid=6478";

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

      {/* Brokers We Use Section */}
      <section className="py-12 px-4 bg-muted/50 overflow-hidden">
        <div className="container mx-auto">
          <div className="relative">
            <div className="flex animate-marquee">
              {[...Array(8)].map((_, i) => (
                <a
                  key={i}
                  href={BLACKBULL_REFERRAL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-shrink-0 mx-8 opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0"
                >
                  <img
                    src={blackbullLogo}
                    alt="BlackBull Markets"
                    className="h-12 w-auto"
                  />
                </a>
              ))}
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
            You can successfully pass with 100% win rate evaluations with top prop firms
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Certificate 1 - The 5%ers */}
            <div className="relative group hover:scale-105 transition-all duration-300">
              <img
                src={cert5percenters}
                alt="The 5%ers Funded Certificate - You"
                className="w-full h-auto rounded-xl shadow-lg border border-secondary/30"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-end justify-center pb-4">
                <span className="text-secondary font-bold text-sm">The 5%ers Funded</span>
              </div>
            </div>

            {/* Certificate 2 - FTMO */}
            <div className="relative group hover:scale-105 transition-all duration-300">
              <img
                src={certFtmo}
                alt="FTMO Passed Verification Certificate - You"
                className="w-full h-auto rounded-xl shadow-lg border border-primary/30"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-end justify-center pb-4">
                <span className="text-primary font-bold text-sm">FTMO Verification</span>
              </div>
            </div>

            {/* Certificate 3 - TopStep */}
            <div className="relative group hover:scale-105 transition-all duration-300">
              <img
                src={certTopstep}
                alt="TopStep Certified Funded Trader - You"
                className="w-full h-auto rounded-xl shadow-lg border border-secondary/30"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-end justify-center pb-4">
                <span className="text-secondary font-bold text-sm">TopStep Funded</span>
              </div>
            </div>

            {/* Certificate 4 - ATF */}
            <div className="relative group hover:scale-105 transition-all duration-300">
              <img
                src={certAtf}
                alt="Apex Trader Funding Certificate - You"
                className="w-full h-auto rounded-xl shadow-lg border border-secondary/30"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-end justify-center pb-4">
                <span className="text-secondary font-bold text-sm">ATF Best Award</span>
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
