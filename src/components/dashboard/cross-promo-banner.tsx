"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Phone, ShieldCheck, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { PIPO_LABS_URLS } from "@/config/cross-promo";

// Cross-promo cards on the dashboard for OTHER Pipo Labs products. Only
// products that are LIVE on custom domains get listed here — apps still
// behind vercel.app URLs leak the internal hostname and confuse customers.
const promos = [
  {
    icon: Phone,
    title: "Missed calls killing leads?",
    description: "CallSpark — bilingual AI voice agent that answers, texts back, and books appointments.",
    url: PIPO_LABS_URLS.callspark,
    cta: "Try CallSpark",
  },
  {
    icon: ShieldCheck,
    title: "Building with AI in the EU?",
    description: "AIComply — auto-classify your AI systems against the EU AI Act. Free tier.",
    url: PIPO_LABS_URLS.aicomply,
    cta: "Try AIComply",
  },
];

export function CrossPromoBanner() {
  const promo = useMemo(() => promos[Math.floor(Math.random() * promos.length)], []);
  const Icon = promo.icon;

  return (
    <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
      <CardContent className="flex items-center gap-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{promo.title}</p>
          <p className="text-xs text-muted-foreground">{promo.description}</p>
        </div>
        <Link
          href={promo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
        >
          {promo.cta}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
