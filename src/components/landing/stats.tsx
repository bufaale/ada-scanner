import { Shield, AlertTriangle, Scale, TrendingUp } from "lucide-react";

const stats = [
  {
    icon: AlertTriangle,
    value: "37%",
    label: "Increase in ADA lawsuits in 2025",
  },
  {
    icon: Shield,
    value: "22.6%",
    label: "Of sued sites had overlay widgets installed",
  },
  {
    icon: Scale,
    value: "$1M",
    label: "FTC fine against leading overlay provider",
  },
  {
    icon: TrendingUp,
    value: "5,000+",
    label: "ADA website lawsuits filed last year",
  },
];

export function Stats() {
  return (
    <section className="border-y bg-muted/30 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <stat.icon className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-3xl font-bold tracking-tight">
                {stat.value}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
