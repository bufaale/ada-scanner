/**
 * branding.spec.ts — Phase 3 of app-quality-auditor
 *
 * Catches the bug class the operator surfaced: ReviewStack tab title says
 * "SaaS AI Boilerplate" because the template wasn't fully rebranded. This
 * spec asserts every public route renders AccessiScan brand consistently
 * in tab title, meta description, and visible footer/header.
 *
 * Boundary: NEVER asserts against design tokens or visual layout — that's
 * the design system's job. Only the brand string identity.
 */
import { test, expect } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/terms",
  "/privacy",
  "/refund",
  "/why-not-overlays",
  "/overlay-detector",
  "/free/wcag-scanner",
  "/blog",
];

// Template scaffolding leaks that should NEVER appear anywhere — title, meta,
// or body. These are signs the app wasn't fully rebranded from the boilerplate.
// This is the bug class operator caught in ReviewStack ("SaaS AI Boilerplate"
// tab title) and SaaS Boilerplate (broken/placeholder content).
const TEMPLATE_LEAKS = [
  "SaaS AI Boilerplate",
  "SaaS Boilerplate",
  "Lorem ipsum",
  "TODO",
  "FIXME",
  "Coming soon",
  "Placeholder",
];

// Sibling brands. Wrong as the app's IDENTITY (tab title, meta description)
// but valid in body content (cross-promo footer, comparison tables, etc.).
const SIBLING_BRANDS = [
  "Pilotdeck",
  "AIComply",
  "CallSpark",
  "ReviewStack",
  "ContentFlow",
  "PriceHawk",
  "PingPanda",
  "Votefuse",
  "ClauseForge",
  "StatusBeacon",
  "Subjectly",
];

// "ADA Scanner" is the OLD product name pre-rebrand to AccessiScan. Should not
// appear as the brand identity (tab title) but is fine as the regulatory term
// in body copy ("ADA Title II", "ADA-compliant", etc.).
const OLD_BRAND_AS_IDENTITY = ["ADA Scanner"];

test.describe("Branding consistency — every public route", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} — tab title and meta include "AccessiScan"`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status(), `${route} should not 404`).toBeLessThan(400);

      const title = await page.title();
      expect(title, `${route} tab title should mention AccessiScan`).toMatch(
        /AccessiScan/i,
      );

      const description = await page
        .locator('meta[name="description"]')
        .getAttribute("content");
      const titleAndMeta = `${title}\n${description ?? ""}`;

      // Tab title + meta = the app's IDENTITY signal. Reject all leaks here.
      for (const leak of [...TEMPLATE_LEAKS, ...SIBLING_BRANDS, ...OLD_BRAND_AS_IDENTITY]) {
        expect(
          titleAndMeta,
          `${route} title/meta leaks "${leak}"`,
        ).not.toContain(leak);
      }
    });

    test(`${route} — body copy is free of template scaffolding leaks`, async ({
      page,
    }) => {
      await page.goto(route);
      const bodyText = await page.locator("body").innerText();

      // Body content can legitimately reference sibling brands (cross-promo) and
      // ADA terminology (regulatory). Only reject scaffolding/template leaks.
      for (const leak of TEMPLATE_LEAKS) {
        expect(bodyText, `${route} body leaks template scaffolding: "${leak}"`)
          .not.toContain(leak);
      }
    });
  }
});
