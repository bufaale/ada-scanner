import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const BADGES = [
  "WCAG 2.1 AA",
  "Section 508",
  "EN 301 549",
  "DOJ Title II ready",
  "VPAT 2.5",
];

export function FinalCTA() {
  return (
    <section className="bg-[#0b1f3a] text-white">
      <div className="mx-auto max-w-[1440px] px-6 py-24">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-b border-white/10 pb-10">
          {BADGES.map((b) => (
            <span
              key={b}
              className="rounded-sm border border-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85"
            >
              {b}
            </span>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h2 className="mx-auto max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Audit your site for Title II violations in 60 seconds.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/70">
            Free tier available. No credit card required. Export a VPAT 2.5 the
            moment your first scan completes.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-md bg-white px-6 text-sm font-semibold text-[#0b1f3a] shadow-none hover:bg-slate-100"
            >
              <Link href="/signup">
                Scan your site free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-md border-white/25 bg-transparent px-6 text-sm font-semibold text-white shadow-none hover:border-white hover:bg-white/5"
            >
              <Link href="mailto:sales@accessiscan.io?subject=Procurement%20demo">
                Book a 15-min procurement demo
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
