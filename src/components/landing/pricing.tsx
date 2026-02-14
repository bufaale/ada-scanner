"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pricingPlans } from "@/lib/stripe/plans";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

function SubscribeButton({ priceId, recommended }: { priceId: string; recommended: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      if (res.status === 401) {
        router.push("/signup");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to start checkout. Please try again.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      className="w-full"
      variant={recommended ? "default" : "outline"}
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {loading ? "Loading..." : "Subscribe"}
    </Button>
  );
}

export function Pricing() {
  const [isYearly, setIsYearly] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setIsLoggedIn(!!user));
  }, []);

  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Simple, transparent pricing</h2>
          <p className="text-muted-foreground mt-4 mx-auto max-w-2xl">
            Choose the plan that fits your needs. Upgrade or downgrade at any
            time.
          </p>
        </div>

        {/* Monthly/Yearly Toggle */}
        <div className="mt-10 flex items-center justify-center gap-3">
          <span
            className={cn(
              "text-sm font-medium",
              !isYearly ? "text-foreground" : "text-muted-foreground"
            )}
          >
            Monthly
          </span>
          <Switch checked={isYearly} onCheckedChange={setIsYearly} />
          <span
            className={cn(
              "text-sm font-medium",
              isYearly ? "text-foreground" : "text-muted-foreground"
            )}
          >
            Yearly
            <Badge variant="secondary" className="ml-2">
              Save 17%
            </Badge>
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {pricingPlans.map((plan) => {
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            const period = isYearly ? "/yr" : "/mo";
            const priceId = isYearly ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex flex-col transition-shadow hover:shadow-md",
                  plan.recommended && "border-primary shadow-lg"
                )}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge>Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">
                      {price === 0 ? "Free" : `$${price}`}
                    </span>
                    {price > 0 && (
                      <span className="text-muted-foreground ml-1 text-base">
                        {period}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                        <span className="text-muted-foreground text-sm">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {plan.monthlyPrice === 0 ? (
                    <Button className="w-full" variant="outline" asChild>
                      <Link href={isLoggedIn ? "/dashboard" : "/signup"}>
                        {isLoggedIn ? "Go to Dashboard" : "Start Free"}
                      </Link>
                    </Button>
                  ) : (
                    <SubscribeButton priceId={priceId} recommended={plan.recommended} />
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
