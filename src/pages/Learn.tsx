import { Button } from "@/components/ui/button";

const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScJNCzrMv9O4OC-BRSoE54p5qn-b9ttZPzl9t67pB8GKJrmAQ/viewform?usp=header";

export default function Learn() {
  return (
    <div className="min-h-screen bg-background py-16 px-4">
      <div className="container max-w-2xl mx-auto text-center space-y-6">
        <h1 className="text-4xl font-bold">
          Access the <span className="text-primary">Free Hedge Guide</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          We now collect interest through a simple Google Form. Share your name and email there and
          we will send the full guide, broker list, and Discord invitation straight to your inbox.
        </p>
        <div className="bg-card border border-primary/20 rounded-xl p-8 space-y-4">
          <p className="text-foreground/80">
            Click below to open the form, fill in your details, and you&apos;re done—no accounts or
            extra tools required.
          </p>
          <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <a href={GOOGLE_FORM_URL} target="_blank" rel="noopener noreferrer">
              Open the Google Form
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
