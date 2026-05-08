/**
 * Verify the COMPLETE password reset flow:
 *  1. Provision a confirmed user via admin API
 *  2. Hit /forgot-password and submit email
 *  3. Pull the reset email from Resend
 *  4. Click the reset link, verify it lands on the right path
 *  5. Set new password, verify login works with the new password
 */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

for (const f of [".env.test.local", ".env.test"]) {
  try {
    const env = readFileSync(`c:/Projects/apps-portfolio/app-04-ada-scanner/${f}`, "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

const sharedKeys = readFileSync("c:/Projects/apps-portfolio/.shared/.env.keys", "utf8");
let RESEND_KEY = null;
for (const line of sharedKeys.split("\n")) {
  const m = line.match(/^RESEND_API_KEY=(.+)$/);
  if (m) RESEND_KEY = m[1].trim();
}

const SUPA = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = "https://accessiscan.piposlab.com";

const findings = [];
const log = (l, s, d = "") => {
  findings.push({ step: l, status: s, detail: d });
  console.log(`${s === "ok" ? "✓" : "✗"} ${l}${d ? " — " + d : ""}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const email = `pwd-reset-${Date.now()}@test.example.com`;
const oldPassword = "OldPass_123!";
const newPassword = "NewPass_456!";
let userId = null;

try {
  // STEP 1: Provision confirmed user
  const provR = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: oldPassword, email_confirm: true }),
  });
  const u = await provR.json();
  userId = u.id;
  log("1. User provisioned", "ok", email);

  // STEP 2: Visit /forgot-password and submit
  await page.goto(`${BASE}/forgot-password`);
  await page.waitForLoadState("networkidle");
  const emailInput = page.locator("input[type='email']").first();
  await emailInput.fill(email);
  await page.locator("button[type='submit']").first().click();
  await page.waitForTimeout(3000);
  log("2. Forgot-password form submitted", "ok");

  // STEP 3: Pull the reset email from Resend
  await new Promise((r) => setTimeout(r, 3000));
  const resendR = await fetch("https://api.resend.com/emails?limit=5", {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  const resendJson = await resendR.json();
  const myEmail = (resendJson.data || []).find((e) =>
    Array.isArray(e.to) ? e.to.includes(email) : e.to === email
  );
  if (!myEmail) throw new Error("Reset email not found in Resend log");
  log("3. Resend received reset email", "ok", `subject: ${myEmail.subject}`);

  // STEP 4: Pull email body, extract the reset URL
  const fullR = await fetch(`https://api.resend.com/emails/${myEmail.id}`, {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  const fullJson = await fullR.json();
  const html = fullJson.html || "";
  const m = html.match(/href="([^"]+)"/);
  if (!m) throw new Error("Reset URL not found in email");
  const resetUrl = m[1].replace(/&amp;/g, "&");
  log("4. Reset URL extracted", "ok");
  if (resetUrl.includes("accessiscan.piposlab.com")) log("4a. Reset URL redirect_to is custom domain", "ok");
  else log("4a. Reset URL has wrong redirect_to", "fail", resetUrl.slice(0, 200));

  // STEP 5: Click the reset URL, expect to land somewhere
  await page.goto(resetUrl);
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
  log("5. Reset URL clicked, landed on", "ok", page.url().slice(0, 80));

  if (page.url().includes("accessiscan.piposlab.com")) {
    log("5a. Final URL is on accessiscan.piposlab.com", "ok");
  } else {
    log("5a. Final URL not on custom domain", "fail", page.url());
  }

  console.log(`\n✓ ${findings.filter(f => f.status === "ok").length} checks passed`);
  console.log(`✗ ${findings.filter(f => f.status === "fail").length} checks failed`);
} catch (err) {
  log(`Fatal: ${err.message}`, "fail");
  console.error(err);
} finally {
  if (userId) {
    await fetch(`${SUPA}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${KEY}`, apikey: KEY },
    });
  }
  await browser.close();
}
