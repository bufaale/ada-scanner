import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase server client. Each test sets the count returned.
let mockedCount: number | null = 0;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ count: mockedCount, error: null }),
        }),
      }),
    }),
  }),
}));

import { checkScanLimit } from "@/lib/usage";

describe("checkScanLimit", () => {
  beforeEach(() => {
    mockedCount = 0;
  });

  it("free tier: allows quick scan when used < limit (0/2)", async () => {
    mockedCount = 0;
    const r = await checkScanLimit("user-1", "free", "quick");
    expect(r.allowed).toBe(true);
    expect(r.used).toBe(0);
    expect(r.limit).toBe(2);
    expect(r.canDeepScan).toBe(false);
  });

  it("free tier: allows scan at boundary (1/2 = still allowed)", async () => {
    mockedCount = 1;
    const r = await checkScanLimit("user-1", "free", "quick");
    expect(r.allowed).toBe(true);
    expect(r.used).toBe(1);
  });

  it("free tier: BLOCKS scan at limit (2/2 = denied)", async () => {
    mockedCount = 2;
    const r = await checkScanLimit("user-1", "free", "quick");
    expect(r.allowed).toBe(false);
    expect(r.used).toBe(2);
  });

  it("free tier: BLOCKS scan over limit (3/2)", async () => {
    mockedCount = 3;
    const r = await checkScanLimit("user-1", "free", "quick");
    expect(r.allowed).toBe(false);
  });

  it("free tier: REJECTS deep scan even when usage is 0/2", async () => {
    mockedCount = 0;
    const r = await checkScanLimit("user-1", "free", "deep");
    expect(r.allowed).toBe(false);
    expect(r.canDeepScan).toBe(false);
  });

  it("pro tier: allows quick scan up to 30/month", async () => {
    mockedCount = 29;
    const r = await checkScanLimit("user-1", "pro", "quick");
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(30);
    expect(r.canDeepScan).toBe(true);
  });

  it("pro tier: blocks at 30/30", async () => {
    mockedCount = 30;
    const r = await checkScanLimit("user-1", "pro", "quick");
    expect(r.allowed).toBe(false);
  });

  it("pro tier: ALLOWS deep scan", async () => {
    mockedCount = 5;
    const r = await checkScanLimit("user-1", "pro", "deep");
    expect(r.allowed).toBe(true);
  });

  it("agency tier: unlimited (-1) — always allows", async () => {
    mockedCount = 9999;
    const r = await checkScanLimit("user-1", "agency", "quick");
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(-1);
  });

  it("business tier: unlimited (-1) — always allows", async () => {
    mockedCount = 99999;
    const r = await checkScanLimit("user-1", "business", "deep");
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(-1);
    expect(r.canDeepScan).toBe(true);
  });

  it("falls back to free tier behaviour for unknown plan id", async () => {
    mockedCount = 5;
    const r = await checkScanLimit("user-1", "nonexistent-plan", "quick");
    // Falls back to pricingPlans[0] which is free (limit 2).
    expect(r.allowed).toBe(false);
    expect(r.limit).toBe(2);
  });

  it("treats null count as 0", async () => {
    mockedCount = null;
    const r = await checkScanLimit("user-1", "free", "quick");
    expect(r.used).toBe(0);
    expect(r.allowed).toBe(true);
  });
});
