import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function Booking() {
  const [searchParams] = useSearchParams();
  const tier = searchParams.get("tier");

  useEffect(() => {
    // Load the zcal embed script
    const script = document.createElement("script");
    script.src = "https://static.zcal.co/embed/v1/embed.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background py-16 px-4">
      <div className="container max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-primary">
            {tier === "automation" ? "Book Your Automation Setup Call" : "Book Your Strategy Session"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {tier === "automation" 
              ? "Schedule your consultation to get started with full automation setup."
              : "Select a convenient time for your 60-minute strategy accelerator session."}
          </p>
        </div>

        <div className="bg-card border rounded-xl p-8">
          <div className="zcal-inline-widget">
            <a href="https://zcal.co/i/DmkwmVRV">30 Minute Meeting - Schedule a meeting</a>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>After booking, you'll receive a confirmation email with meeting details and preparation instructions.</p>
        </div>
      </div>
    </div>
  );
}
