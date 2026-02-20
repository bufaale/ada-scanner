import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <Badge variant="destructive" className="mb-4">
          ADA lawsuits up 37% — overlays won&apos;t protect you
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Real ADA Compliance,{" "}
          <span className="text-primary">Not an Overlay Band-Aid</span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          The FTC fined the leading overlay provider $1M for deceptive claims.
          22.6% of ADA lawsuits target sites with overlays installed. Get real WCAG 2.1
          scanning with AI-generated fix code — starting at $19/mo.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/signup">Scan Your Site Free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="#comparison">See How We Compare</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          No credit card required. Free tier available. Not an overlay.
        </p>
      </div>
    </section>
  );
}
