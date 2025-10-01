import { Link } from "react-router-dom";
import { TrendingUp } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-background border-t border-primary/20 py-12 px-4">
      <div className="container mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-6 h-6 text-primary" />
              <span className="text-primary font-bold text-xl">HedgeEdge</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Educational resources and tools for prop trading success
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Services</h4>
            <div className="space-y-2">
              <Link to="/learn" className="block text-muted-foreground hover:text-primary text-sm transition-colors">
                Free Guide
              </Link>
              <Link to="/consult" className="block text-muted-foreground hover:text-primary text-sm transition-colors">
                Consultation
              </Link>
              <Link to="/automation" className="block text-muted-foreground hover:text-primary text-sm transition-colors">
                Automation
              </Link>
              <Link to="/brokers" className="block text-muted-foreground hover:text-primary text-sm transition-colors">
                Brokers
              </Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Resources</h4>
            <div className="space-y-2">
              <Link to="/faq" className="block text-muted-foreground hover:text-primary text-sm transition-colors">
                FAQ
              </Link>
              <Link to="/legal/terms" className="block text-muted-foreground hover:text-primary text-sm transition-colors">
                Terms of Service
              </Link>
              <Link to="/legal/privacy" className="block text-muted-foreground hover:text-primary text-sm transition-colors">
                Privacy Policy
              </Link>
              <Link to="/legal/risk" className="block text-muted-foreground hover:text-primary text-sm transition-colors">
                Risk Disclosure
              </Link>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Legal</h4>
            <div className="space-y-2">
              <Link to="/legal/cookies" className="block text-muted-foreground hover:text-primary text-sm transition-colors">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-primary/20 pt-8">
          <div className="bg-muted border border-secondary/30 rounded-lg p-4 mb-6">
            <p className="text-foreground/80 text-sm leading-relaxed">
              <strong className="text-secondary">Disclaimer:</strong> Education and tools only. Not
              investment advice. Prop trading outcomes depend on third-party rules, market
              conditions, and your execution. We may receive affiliate compensation from broker
              referrals at no cost to you. All trading involves substantial risk of loss.
            </p>
          </div>
          <p className="text-muted-foreground text-sm text-center">
            © 2025 HedgeEdge. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
