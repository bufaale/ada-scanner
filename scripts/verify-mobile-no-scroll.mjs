/**
 * Verify mobile horizontal-scroll status accurately. The body can have
 * scrollWidth > viewport width, but if html has overflow-x: clip and
 * documentElement.scrollWidth === viewport.width, the user CANNOT scroll
 * horizontally — there's no scrollbar and no swipe.
 *
 * The test is: try to actually scroll the page horizontally via JS, and
 * see if scrollLeft changes. If it can't change, no real overflow.
 */
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await ctx.newPage();

const ROUTES = ["/", "/pricing", "/free/wcag-scanner", "/blog", "/overlay-detector", "/why-not-overlays", "/login", "/signup", "/terms", "/privacy", "/refund"];

console.log(`Mobile horizontal-scroll audit (390x844 viewport):\n`);
const results = [];

for (const route of ROUTES) {
  await page.goto(`https://accessiscan.piposlab.com${route}`);
  await page.waitForLoadState("networkidle");

  const measure = await page.evaluate(() => {
    // The actual user-visible test: can they scroll horizontally?
    const before = window.scrollX;
    window.scrollTo(500, 0);
    const after = window.scrollX;
    window.scrollTo(0, 0);
    return {
      viewport: window.innerWidth,
      html_scrollWidth: document.documentElement.scrollWidth,
      body_scrollWidth: document.body.scrollWidth,
      can_scroll_horizontally: after > before,
      scrolled_to: after,
    };
  });

  const status = measure.can_scroll_horizontally ? "BAD ⚠" : "OK ✓";
  results.push({ route, ...measure, status });
  console.log(`  ${status}  ${route.padEnd(28)} html=${measure.html_scrollWidth}px body=${measure.body_scrollWidth}px scroll=${measure.scrolled_to}`);
}

await browser.close();

const broken = results.filter((r) => r.can_scroll_horizontally);
if (broken.length === 0) {
  console.log(`\n✓ ALL ${results.length} routes mobile-scroll-clean. No horizontal scroll on any public page.`);
} else {
  console.log(`\n⚠ ${broken.length} routes with REAL horizontal scroll:`);
  for (const b of broken) console.log(`    - ${b.route}`);
}
