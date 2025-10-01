import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Learn() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Success!",
      description: `Guide sent to ${email}. Check your inbox for the PDF, broker list, and Discord invite.`,
    });
    setName("");
    setEmail("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-16 px-4">
      <div className="container max-w-xl mx-auto">
        <h1 className="text-5xl font-bold mb-4">
          Get Your <span className="text-primary">Free Hedge Guide</span>
        </h1>
        <p className="text-foreground/70 text-lg mb-8">
          Download our comprehensive PDF guide, access our vetted broker list, and join our Discord
          community—all completely free.
        </p>

        <div className="bg-card border border-primary/30 rounded-xl p-8">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <Label htmlFor="name" className="block font-semibold mb-2">
                Name
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-muted border-primary/30 focus:border-primary"
                placeholder="John Doe"
              />
            </div>

            <div className="mb-6">
              <Label htmlFor="email" className="block font-semibold mb-2">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-muted border-primary/30 focus:border-primary"
                placeholder="you@example.com"
              />
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Send Me the Guide
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-primary/20">
            <p className="text-muted-foreground text-sm text-center">
              You'll instantly receive: PDF guide, broker comparison list, and Discord invite
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
