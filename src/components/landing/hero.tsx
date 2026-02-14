import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <Badge variant="secondary" className="mb-4">
          AI-Powered WCAG Compliance
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Check Your Website&apos;s ADA Compliance in{" "}
          <span className="text-primary">Seconds</span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Scan any URL against WCAG 2.1 guidelines. Get instant compliance scores and AI-generated fix suggestions.
          Stay ahead of accessibility lawsuits with proactive scanning.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/signup">Scan Your Site Free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="#pricing">View Pricing</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          No credit card required. Free tier available.
        </p>
      </div>
    </section>
  );
}
