import { useParams, Link } from "react-router-dom";
import { legalContent } from "@/data/siteData";

type LegalType = "terms" | "privacy" | "risk";

export default function Legal() {
  const { type = "terms" } = useParams<{ type: LegalType }>();
  const content = legalContent[type as LegalType] || legalContent.terms;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-16 px-4">
      <div className="container max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-8">{content.title}</h1>

        <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-6 mb-8">
          <p className="text-foreground/80 text-sm">
            <strong className="text-secondary">Last Updated:</strong> September 30, 2025
          </p>
        </div>

        <div className="space-y-8">
          {content.sections.map((section, idx) => (
            <div key={idx} className="bg-card border border-primary/20 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-primary mb-3">{section.heading}</h2>
              <p className="text-foreground/80 leading-relaxed">{section.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-primary hover:text-primary/80 font-semibold">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
