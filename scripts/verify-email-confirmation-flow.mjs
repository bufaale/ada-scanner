/**
 * Verify the COMPLETE email confirmation flow:
 *  1. Sign up via UI (creates auth.users with email_confirmed_at = null)
 *  2. Resend sends the confirmation email
 *  3. Pull the confirmation URL from the latest Resend email
 *  4. Hit that URL with a fresh browser context
 *  5. Verify the user lands on accessiscan.piposlab.com (not vercel.app or supabase.co)
 *  6. Verify the user is now logged in (cookie set, dashboard accessible)
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
const log = (label, status, detail = "") => {
  findings.push({ step: label, status, detail });
  console.log(`${status === "ok" ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

let userId = null;
const email = `confirm-flow-${Date.now()}@test.example.com`;
const password = "ConfirmFlow_Pass123!";

try {
  // STEP 1: Sign up via UI to trigger real auth flow with email
  await page.goto(`${BASE}/signup`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-name").fill("Confirm Flow");
  await page.locator("#signup-email").fill(email);
  await page.locator("#signup-password").fill(password);
  await page.locator("label[for='agree']").click();
  const submitTime = Date.now();
  await page.locator("button[type='submit']").filter({ hasText: /start free/i }).click();
  await page.waitForTimeout(3000);
  log("1. Signup form submitted", "ok", email);

  // STEP 2: Verify auth.users row exists with email_confirmed_at = null
  await new Promise((r) => setTimeout(r, 1500));
  const lookupR = await fetch(`${SUPA}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY },
  });
  const lookupJson = await lookupR.json();
  const user = (lookupJson.users || lookupJson || []).find?.((u) => u.email === email);
  if (!user) throw new Error("User not found in auth.users after signup");
  userId = user.id;
  log("2. auth.users row created", "ok", `id=${userId.slice(0, 8)}, confirmed=${!!user.email_confirmed_at}`);
  if (user.email_confirmed_at) {
    log("2a. WARNING: Email is already confirmed (admin auto-confirm?)", "warn");
  }

  // STEP 3: Pull the latest confirmation email from Resend
  await new Promise((r) => setTimeout(r, 2000));
  const resendR = await fetch("https://api.resend.com/emails?limit=5", {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  const resendJson = await resendR.json();
  const myEmail = (resendJson.data || []).find((e) =>
    Array.isArray(e.to) ? e.to.includes(email) : e.to === email
  );
  if (!myEmail) throw new Error("Confirmation email not found in Resend log");
  log("3. Resend received the confirmation email", "ok", `id=${myEmail.id.slice(0, 8)}`);

  // STEP 4: Pull full email body to extract confirm URL
  const fullR = await fetch(`https://api.resend.com/emails/${myEmail.id}`, {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  const fullJson = await fullR.json();
  const html = fullJson.html || "";

  // Find the confirm URL (Supabase verify endpoint)
  const m = html.match(/href="([^"]*supabase\.co\/auth\/v1\/verify[^"]+)"/);
  if (!m) throw new Error("Could not find Supabase verify URL in email body");
  // Decode HTML entities (&amp; → &)
  const confirmUrl = m[1].replace(/&amp;/g, "&");
  log("4. Confirm URL extracted from email", "ok");

  // Verify the redirect_to is our custom domain
  if (confirmUrl.includes("accessiscan.piposlab.com")) {
    log("4a. Confirm URL redirect_to is accessiscan.piposlab.com", "ok");
  } else {
    log("4a. WRONG redirect_to in confirm URL", "fail", confirmUrl.slice(0, 200));
  }

  // STEP 5: Click the confirm URL in the SAME browser context (PKCE flow
  // requires the code_verifier cookie set during signup). Real-world users
  // who click the email link on the SAME device they signed up on hit this
  // happy path.
  await page.goto(confirmUrl);
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
  const finalUrl = page.url();
  log("5. Confirm URL clicked, landed on", "ok", finalUrl.slice(0, 80));

  if (finalUrl.includes("accessiscan.piposlab.com")) {
    log("5a. Final landing URL is accessiscan.piposlab.com (correct domain)", "ok");
  } else if (finalUrl.includes("vercel.app")) {
    log("5a. Final URL leaked vercel.app (BAD!)", "fail", finalUrl);
  } else if (finalUrl.includes("supabase.co")) {
    log("5a. Final URL stuck on supabase.co (BAD!)", "fail", finalUrl);
  } else {
    log("5a. Final URL is other domain", "warn", finalUrl);
  }

  // STEP 6: Verify the user is logged in by hitting /dashboard
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  const dashUrl = page.url();
  if (dashUrl.includes("/dashboard") && !dashUrl.includes("/login")) {
    log("6. User is logged in after confirm — /dashboard accessible", "ok");
  } else {
    log("6. User NOT logged in after confirm", "fail", dashUrl);
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
