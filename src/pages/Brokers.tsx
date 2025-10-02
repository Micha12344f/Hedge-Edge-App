import { AlertCircle, ArrowUpRight } from "lucide-react";

import blackbullBanner from "@/assets/blackbull-banner.png";

const BLACKBULL_REFERRAL_URL =
  "https://blackbull.com/en/live-account/?cmp=5p0z2d3q&refid=6478";

export default function Brokers() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-16 px-4">
      <div className="container mx-auto">
        <h1 className="text-5xl font-bold mb-4 text-center">
          Our Preferred <span className="text-primary">Broker</span>
        </h1>
        <p className="text-foreground/70 text-xl text-center mb-12 max-w-3xl mx-auto">
          We now focus exclusively on BlackBull Markets for their blend of deep liquidity, tight spreads,
          and responsive support tailored to prop traders.
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

        <div className="bg-card border border-primary/40 rounded-2xl p-8 md:p-10 shadow-xl shadow-primary/5">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="text-left space-y-6">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-primary/70">Preferred Partner</p>
                <h2 className="text-4xl font-bold text-white mt-2">BlackBull Markets</h2>
              </div>
              <p className="text-foreground/80 text-lg leading-relaxed">
                Access institutional-grade liquidity, ultra-fast execution, and tight spreads with our go-to
                brokerage partner for challenge hedging and long-term trading.
              </p>
              <ul className="space-y-3 text-foreground/80">
                <li className="flex items-center gap-3">
                  <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  <span>Deep ECN liquidity with Equinix NY4 &amp; LD4 infrastructure</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  <span>Multi-platform support (MT4, MT5, TradingView) with raw or standard accounts</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  <span>Custom rebate structure for HedgeEdge members to offset challenge fees</span>
                </li>
              </ul>
              <a
                href={BLACKBULL_REFERRAL_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground text-lg font-semibold shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02]"
              >
                Start live trading
                <ArrowUpRight className="w-5 h-5" />
              </a>
            </div>
            <a
              href={BLACKBULL_REFERRAL_URL}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-2xl border border-primary/30 bg-background"
            >
              <img
                src={blackbullBanner}
                alt="BlackBull Markets banner"
                className="w-full h-auto object-cover"
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
