import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const CONSENT_KEY = "hedgeedge-consent";

export const ConsentBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasConsent = localStorage.getItem(CONSENT_KEY);
    if (!hasConsent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-primary/20 p-4 z-50 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 flex-1">
          <AlertCircle className="text-secondary w-5 h-5 mt-1" />
          <p className="text-sm text-foreground/90">
            We use cookies to enhance your experience. By continuing, you agree to our use of
            cookies and acknowledge our risk disclosures.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAccept} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            Accept
          </Button>
          <Button asChild variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10">
            <Link to="/legal/cookies">Learn More</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
