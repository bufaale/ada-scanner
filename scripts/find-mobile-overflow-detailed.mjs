/**
 * Find which DOM element on / is overflowing the 390px mobile viewport.
 */
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();

await page.goto("https://accessiscan.piposlab.com");
await page.waitForLoadState("networkidle");

const overflowing = await page.evaluate(() => {
  const VIEWPORT_W = window.innerWidth;
  const offending = [];
  const all = document.querySelectorAll("*");
  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (rect.right > VIEWPORT_W + 5 || rect.left < -5) {
      const w = rect.right - rect.left;
      // Skip very small offsets — only report meaningful overflow
      if (rect.right - VIEWPORT_W > 50 || rect.left < -50) {
        offending.push({
          tag: el.tagName,
          id: el.id || null,
          className: typeof el.className === "string" ? el.className.slice(0, 100) : null,
          text: (el.textContent || "").slice(0, 80).replace(/\s+/g, " ").trim(),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(w),
          overflow_px: Math.round(rect.right - VIEWPORT_W),
        });
      }
    }
  }
  return { viewport: VIEWPORT_W, body_scroll: document.body.scrollWidth, html_scroll: document.documentElement.scrollWidth, offending: offending.slice(0, 20) };
});

console.log("Viewport:", overflowing.viewport);
console.log("Body scroll width:", overflowing.body_scroll);
console.log("HTML scroll width:", overflowing.html_scroll);
console.log(`\nFound ${overflowing.offending.length} overflowing elements:\n`);
for (const el of overflowing.offending) {
  console.log(`  ${el.tag}#${el.id || "_"} .${(el.className || "").slice(0, 40)}`);
  console.log(`    text: "${el.text}"`);
  console.log(`    rect: left=${el.left} right=${el.right} width=${el.width} overflow=${el.overflow_px}px`);
  console.log("");
}

await browser.close();
