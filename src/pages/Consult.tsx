import { Button } from "@/components/ui/button";

export default function Consult() {
  return (
    <div className="min-h-screen bg-background py-16 px-4">
      <div className="container max-w-3xl mx-auto text-center space-y-6">
        <h1 className="text-4xl font-bold">
          1-on-1 Consultation <span className="text-secondary">Coming Soon</span>
        </h1>
        <p className="text-muted-foreground">
          We&apos;re simplifying the consultation offer to match the leaner platform. Personal sessions
          aren&apos;t open right now, but we&apos;ll announce availability once the new booking flow is
          ready.
        </p>
        <div className="bg-muted border border-secondary/10 rounded-xl p-8 space-y-4">
          <p className="text-foreground/70">
            In the meantime, start with the free guide or reach out through the Google Form if you
            have specific questions.
          </p>
          <Button disabled className="w-full bg-muted text-muted-foreground" size="lg">
            Coming Soon
          </Button>
        </div>
      </div>
    </div>
  );
}
