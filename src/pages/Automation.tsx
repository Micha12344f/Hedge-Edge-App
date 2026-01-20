import { useEffect } from "react";

export default function Automation() {
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
          <h1 className="text-4xl md:text-4xl text-3xl font-bold text-primary">
            Book Your Automation Setup Call
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Schedule your consultation to get started with full automation setup.
          </p>
        </div>

        <div className="bg-card border rounded-xl p-4 md:p-8 overflow-hidden">
          <div className="zcal-inline-widget w-full">
            <a href="https://zcal.co/hedgedge">Schedule a meeting</a>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>After booking, you'll receive a confirmation email with meeting details and preparation instructions.</p>
        </div>
      </div>
    </div>
  );
}
