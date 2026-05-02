import { describe, it, expect } from "vitest";
import { pricingPlans, getPlanByPriceId } from "@/lib/stripe/plans";

describe("pricingPlans catalog", () => {
  it("ships free, pro, agency, business, team", () => {
    const ids = pricingPlans.map((p) => p.id);
    expect(ids).toEqual(["free", "pro", "agency", "business", "team"]);
  });

  it("free tier: 2 scans/mo, no deep scan, $0", () => {
    const free = pricingPlans.find((p) => p.id === "free")!;
    expect(free.monthlyPrice).toBe(0);
    expect(free.yearlyPrice).toBe(0);
    expect(free.limits.scansPerMonth).toBe(2);
    expect(free.limits.canDeepScan).toBe(false);
  });

  it("pro tier: $19/mo, $190/yr, 30 scans, deep scan enabled", () => {
    const pro = pricingPlans.find((p) => p.id === "pro")!;
    expect(pro.monthlyPrice).toBe(19);
    expect(pro.yearlyPrice).toBe(190);
    expect(pro.limits.scansPerMonth).toBe(30);
    expect(pro.limits.canDeepScan).toBe(true);
  });

  it("agency tier: $49/mo, unlimited scans, recommended=true", () => {
    const agency = pricingPlans.find((p) => p.id === "agency")!;
    expect(agency.monthlyPrice).toBe(49);
    expect(agency.limits.scansPerMonth).toBe(-1);
    expect(agency.recommended).toBe(true);
  });

  it("business tier: $299/mo, unlimited, deep scan enabled", () => {
    const biz = pricingPlans.find((p) => p.id === "business")!;
    expect(biz.monthlyPrice).toBe(299);
    expect(biz.limits.scansPerMonth).toBe(-1);
    expect(biz.limits.canDeepScan).toBe(true);
  });

  it("team tier: $599/mo, contactSales=true, custom CTA label", () => {
    const team = pricingPlans.find((p) => p.id === "team")!;
    expect(team.monthlyPrice).toBe(599);
    expect(team.contactSales).toBe(true);
    expect(team.ctaLabel).toBe("Contact sales");
  });

  it("every plan has the required shape", () => {
    for (const p of pricingPlans) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("description");
      expect(p).toHaveProperty("monthlyPrice");
      expect(p).toHaveProperty("yearlyPrice");
      expect(p).toHaveProperty("features");
      expect(p).toHaveProperty("limits");
      expect(p.features.length).toBeGreaterThan(0);
    }
  });
});

describe("getPlanByPriceId", () => {
  it("returns undefined for an unknown / invalid price id", () => {
    expect(getPlanByPriceId("price_does_not_exist_xyz")).toBeUndefined();
  });

  it("returns the matching plan when env vars are set (skipped if not)", () => {
    const proMonthlyId = process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID?.trim();
    if (!proMonthlyId) {
      // Env var not configured in this test environment — skip silently.
      return;
    }
    const plan = getPlanByPriceId(proMonthlyId);
    expect(plan?.id).toBe("pro");
  });

  it("returns undefined for a price id that doesn't match anything", () => {
    expect(getPlanByPriceId("price_unrelated_42")).toBeUndefined();
  });
});
