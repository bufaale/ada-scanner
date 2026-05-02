/**
 * account-delete-lifecycle.spec.ts — GDPR Article 17 right-to-erasure end-to-end.
 *
 * Scenario:
 *  1. Create a test user via Supabase Admin API.
 *  2. Seed a scan owned by that user (so we can confirm cascade).
 *  3. Login + POST DELETE /api/account/delete with the magic confirm string.
 *  4. Assert: profile row gone, auth.users row gone, scan row gone (cascade).
 *
 * Stripe path is exercised via best-effort retry; we don't fail if the
 * customer ID isn't set (free user). The webhook handles real Stripe
 * cleanup on subscription.deleted, which is covered by the integration
 * stripe webhook spec.
 */
import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  loginViaUI,
  seedScan,
} from "../../helpers/test-utils";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function profileExists(userId: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_ANON_KEY!,
      },
    },
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function authUserExists(userId: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_ANON_KEY!,
      },
    },
  );
  return res.status === 200;
}

async function scanExists(scanId: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/scans?id=eq.${scanId}&select=id`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_ANON_KEY!,
      },
    },
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

test.describe("Account delete — GDPR right-to-erasure", () => {
  test.skip(!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY, "Supabase env not set");

  test("DELETE /api/account/delete cascades user + scans + profile rows", async ({ page, request, baseURL }) => {
    const u = await createTestUser("account-delete", "free");
    let registeredCleanup = true;
    try {
      const scan = await seedScan(u.id, { url: "https://will-be-deleted.test" });
      // Sanity precondition.
      expect(await profileExists(u.id)).toBe(true);
      expect(await authUserExists(u.id)).toBe(true);
      expect(await scanExists(scan.id)).toBe(true);

      await loginViaUI(page, u.email);
      const cookies = (await page.context().cookies())
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

      const res = await request.delete(`${baseURL}/api/account/delete`, {
        headers: { "Content-Type": "application/json", Cookie: cookies },
        data: { confirm: "DELETE MY ACCOUNT" },
      });
      expect([200, 202, 204]).toContain(res.status());
      registeredCleanup = false; // we did the delete; fallback finally is a no-op.

      // Give the cascade a beat to settle (FK cascade on auth.users → profiles → scans).
      await page.waitForTimeout(2000);

      expect(await authUserExists(u.id)).toBe(false);
      expect(await profileExists(u.id)).toBe(false);
      expect(await scanExists(scan.id)).toBe(false);
    } finally {
      if (registeredCleanup) {
        await deleteTestUser(u.id).catch(() => {});
      }
    }
  });

  test("DELETE without correct confirm string → 400", async ({ page, request, baseURL }) => {
    const u = await createTestUser("account-delete-noconfirm", "free");
    try {
      await loginViaUI(page, u.email);
      const cookies = (await page.context().cookies())
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

      const r = await request.delete(`${baseURL}/api/account/delete`, {
        headers: { "Content-Type": "application/json", Cookie: cookies },
        data: { confirm: "delete my account" }, // wrong case
      });
      expect(r.status()).toBe(400);

      // Profile + user should still exist.
      expect(await profileExists(u.id)).toBe(true);
      expect(await authUserExists(u.id)).toBe(true);
    } finally {
      await deleteTestUser(u.id);
    }
  });

  test("DELETE without auth cookies → 401", async ({ request, baseURL }) => {
    const r = await request.delete(`${baseURL}/api/account/delete`, {
      headers: { "Content-Type": "application/json" },
      data: { confirm: "DELETE MY ACCOUNT" },
    });
    expect(r.status()).toBe(401);
  });
});
