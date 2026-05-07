/**
 * Diagnose why the UI signup isn't creating auth.users rows.
 * Spy on network traffic during the signup form submit.
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

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const requests = [];
page.on("request", (req) => {
  if (req.url().includes("supabase") || req.url().includes("/auth/") || req.method() === "POST") {
    requests.push({ method: req.method(), url: req.url(), body: req.postData()?.slice(0, 300) });
  }
});
page.on("response", async (resp) => {
  if (resp.url().includes("supabase") || resp.url().includes("/auth/")) {
    let body = "";
    try { body = (await resp.text()).slice(0, 300); } catch {}
    console.log(`<- ${resp.status()} ${resp.url()}\n   body: ${body}`);
  }
});

const email = `e2e-diag-${Date.now()}@test.example.com`;
const password = "Diag_Pass123!";

await page.goto("https://accessiscan.piposlab.com/signup");
await page.waitForLoadState("networkidle");

await page.locator("#signup-name").fill("Diag User");
await page.locator("#signup-email").fill(email);
await page.locator("#signup-password").fill(password);
await page.locator("label[for='agree']").click();
await page.waitForTimeout(500);
console.log(`\n--- submitting form for ${email} ---\n`);
await page.locator("button[type='submit']").filter({ hasText: /start free/i }).click();
await page.waitForTimeout(5000);

console.log(`\n--- POST/Auth requests during signup: ---`);
for (const r of requests) {
  console.log(`-> ${r.method} ${r.url}`);
  if (r.body) console.log(`   body: ${r.body}`);
}

console.log(`\n--- Page state after submit: ---`);
console.log(`URL: ${page.url()}`);
const errorEl = await page.getByRole("alert").first().textContent().catch(() => null);
if (errorEl) console.log(`Alert: ${errorEl}`);
const bodyText = await page.locator("body").textContent();
const errorMatch = bodyText.match(/(error|fail|invalid|wrong|please)[^.]{1,100}/i);
if (errorMatch) console.log(`Body error: ${errorMatch[0]}`);

await browser.close();
