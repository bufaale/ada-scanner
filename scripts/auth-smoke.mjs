/**
 * Authenticated smoke audit for AccessiScan prod.
 *
 * Mirror of app-16-aicomply + app-02-voice-agent auth-smoke.mjs. Provisions
 * a fresh Supabase user, logs in via UI, walks every authenticated route,
 * captures full-page screenshots. Used to catch the same class of mock-data
 * bugs caught in AIComply (BUG #5-8) and CallSpark (BUG #9-17): Claude
 * Designs prototype data shipped to prod without being wired to real DB.
 *
 * Usage:  node scripts/auth-smoke.mjs
 */
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

for (const f of [".env.test.local", ".env.test"]) {
  try {
    const env = readFileSync(`c:/Projects/apps-portfolio/app-04-ada-scanner/${f}`, "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

const SUPA = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const BASE = "https://accessiscan.piposlab.com";
const OUT = "c:/Projects/apps-portfolio/fotos-verificar/as-auth-smoke";
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  "/dashboard",
  "/dashboard/scans",
  "/dashboard/sites",
  "/dashboard/monitored",
  "/dashboard/pdf-scans",
  "/settings",
  "/settings/billing",
  "/settings/profile",
  "/settings/api-keys",
  "/settings/github",
];

const email = `auth-smoke-${Date.now()}@test.example.com`;
const password = "AuthSmoke_Pass123!";
const r = await fetch(`${SUPA}/auth/v1/admin/users`, {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, email_confirm: true }),
});
const u = await r.json();
console.log("user:", r.status, u.id);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
const page = await ctx.newPage();
const findings = [];

try {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.waitForTimeout(1500);
  console.log("logged in OK");

  for (const route of ROUTES) {
    const slug = route.replace(/^\//, "").replace(/\//g, "_") || "root";
    const errors = [];
    const onMsg = (msg) => {
      if (msg.type() === "error") errors.push(msg.text().slice(0, 200));
    };
    page.on("console", onMsg);
    let status = "?";
    try {
      const resp = await page.goto(`${BASE}${route}`, { timeout: 30000 });
      status = resp?.status() ?? "?";
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2200);
      await page.screenshot({ path: `${OUT}/${slug}.png`, fullPage: true });
    } catch (e) {
      findings.push({ route, status: "ERR", error: e.message.slice(0, 200) });
      page.off("console", onMsg);
      continue;
    }
    page.off("console", onMsg);
    if (status >= 400 || errors.length > 0) {
      findings.push({ route, status, errors: errors.slice(0, 5) });
      console.log(`  X ${route}  status=${status} errors=${errors.length}`);
    } else {
      console.log(`  ok ${route}  status=${status}`);
    }
  }
} finally {
  await browser.close();
  await fetch(`${SUPA}/auth/v1/admin/users/${u.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY },
  });
  writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
  console.log(`\n${findings.length} findings written to ${OUT}/findings.json`);
}
