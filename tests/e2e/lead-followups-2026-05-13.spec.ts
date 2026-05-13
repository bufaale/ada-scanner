/**
 * E2E smoke for /api/cron/lead-followups (shipped 2026-05-13).
 *
 * - Unauthed GET → 401
 * - Bearer CRON_SECRET → 200 + JSON shape match
 *
 * Live fire is gated on ACCESSISCAN_CRON_SECRET. Default state today:
 * 0 candidates (the captures shipped <1h ago — won't be 3 days old
 * until 2026-05-16).
 */

import { test, expect, request } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL ?? "https://accessiscan.piposlab.com";
const SECRET = process.env.ACCESSISCAN_CRON_SECRET ?? process.env.CRON_SECRET ?? "";

test.describe("lead-followups cron shipped 2026-05-13", () => {
  test("unauthed GET returns 401", async () => {
    const ctx = await request.newContext();
    const r = await ctx.get(`${BASE}/api/cron/lead-followups`);
    expect(r.status()).toBe(401);
  });

  test.describe("bearer-auth (needs ACCESSISCAN_CRON_SECRET or CRON_SECRET env)", () => {
    test.skip(!SECRET, "Set ACCESSISCAN_CRON_SECRET or CRON_SECRET to a valid value to run.");

    test("returns 200 + expected shape with valid CRON_SECRET", async () => {
      const ctx = await request.newContext();
      const r = await ctx.get(`${BASE}/api/cron/lead-followups`, {
        headers: { Authorization: `Bearer ${SECRET}` },
        timeout: 60_000,
      });
      expect(r.status()).toBe(200);
      const body = await r.json();
      expect(body.ok).toBe(true);
      expect(typeof body.candidates).toBe("number");
      expect(typeof body.sent).toBe("number");
      expect(typeof body.failed).toBe("number");
      expect(Array.isArray(body.details)).toBe(true);
    });
  });
});
