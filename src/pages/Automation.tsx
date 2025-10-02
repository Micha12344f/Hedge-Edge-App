import { Button } from "@/components/ui/button";

export default function Automation() {
  return (
    <div className="min-h-screen bg-background py-16 px-4">
      <div className="container max-w-3xl mx-auto text-center space-y-6">
        <h1 className="text-4xl font-bold">
          Full Automation <span className="text-primary">Coming Soon</span>
        </h1>
        <p className="text-muted-foreground">
          We&apos;re reworking our automation service so it runs entirely on our own stack. The full
          done-for-you package isn&apos;t available just yet, but you can review the free guide while we
          finish things up.
        </p>
        <div className="bg-muted border border-primary/10 rounded-xl p-8 space-y-4">
          <p className="text-foreground/70">
            Check back soon for a simple, self-contained automation offer with easy onboarding and
            transparent pricing.
          </p>
          <Button disabled className="w-full bg-muted text-muted-foreground" size="lg">
            Coming Soon
          </Button>
        </div>
      </div>
    </div>
  );
}
