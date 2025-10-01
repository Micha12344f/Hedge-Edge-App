import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FAQItem } from "@/components/FAQItem";
import { faqData } from "@/data/siteData";

export default function FAQ() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-16 px-4">
      <div className="container max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold mb-4 text-center">
          Frequently Asked <span className="text-primary">Questions</span>
        </h1>
        <p className="text-foreground/70 text-lg text-center mb-12">
          Everything you need to know about our services and approach
        </p>

        <div className="space-y-4">
          {faqData.map((faq, idx) => (
            <FAQItem key={idx} question={faq.q} answer={faq.a} />
          ))}
        </div>

        <div className="mt-12 bg-muted border border-secondary/30 rounded-xl p-6 text-center">
          <h3 className="text-secondary font-bold text-xl mb-2">Still Have Questions?</h3>
          <p className="text-foreground/70 mb-4">
            Join our Discord community or book a consultation for personalized answers
          </p>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/learn">Join Discord Community</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
