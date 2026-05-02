import { describe, it, expect } from "vitest";
import {
  detectOverlaysInHtml,
  OVERLAY_VENDORS,
} from "@/lib/overlay/detect";

describe("OVERLAY_VENDORS catalog", () => {
  it("ships exactly 6 vendors", () => {
    expect(OVERLAY_VENDORS.length).toBe(6);
  });

  it("vendor ids are unique", () => {
    const ids = OVERLAY_VENDORS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every vendor has at least one script domain and one marker", () => {
    for (const v of OVERLAY_VENDORS) {
      expect(v.scriptDomains.length).toBeGreaterThan(0);
      expect(v.markers.length).toBeGreaterThan(0);
      expect(v.notes.length).toBeGreaterThan(20);
      expect(v.tagline.length).toBeGreaterThan(5);
    }
  });

  it("includes accessiBe, UserWay, AudioEye, EqualWeb, Accessibly, Max Access", () => {
    const ids = OVERLAY_VENDORS.map((v) => v.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "accessibe",
        "userway",
        "audioeye",
        "equalweb",
        "accessibly",
        "maxaccess",
      ]),
    );
  });
});

describe("detectOverlaysInHtml", () => {
  const URL = "https://example.com";

  it("returns clean=true when no overlays detected", () => {
    const html = `<html><body><h1>Plain</h1></body></html>`;
    const r = detectOverlaysInHtml(URL, html);
    expect(r.clean).toBe(true);
    expect(r.hits).toEqual([]);
    expect(r.url).toBe(URL);
    expect(r.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("detects accessiBe via script domain", () => {
    const html = `<script src="https://acsbapp.com/apps/app/dist/js/app.js"></script>`;
    const r = detectOverlaysInHtml(URL, html);
    expect(r.clean).toBe(false);
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0].vendor.id).toBe("accessibe");
    expect(r.hits[0].matched).toBe("acsbapp.com");
  });

  it("detects accessiBe via marker", () => {
    const html = `<div id="acsb"></div>`;
    const r = detectOverlaysInHtml(URL, html);
    expect(r.clean).toBe(false);
    expect(r.hits[0].vendor.id).toBe("accessibe");
  });

  it("detects UserWay", () => {
    const html = `<script src="//cdn.userway.org/widget.js"></script>`;
    const r = detectOverlaysInHtml(URL, html);
    expect(r.hits[0].vendor.id).toBe("userway");
  });

  it("detects AudioEye", () => {
    const html = `<script src="https://ws.audioeye.com/ae.js"></script>`;
    const r = detectOverlaysInHtml(URL, html);
    expect(r.hits[0].vendor.id).toBe("audioeye");
  });

  it("detects EqualWeb via marker", () => {
    const html = `<div class="INDWrap"></div>`;
    const r = detectOverlaysInHtml(URL, html);
    expect(r.hits[0].vendor.id).toBe("equalweb");
  });

  it("detects Accessibly", () => {
    const html = `<script src="https://accessibly.app/widget.js"></script>`;
    const r = detectOverlaysInHtml(URL, html);
    expect(r.hits[0].vendor.id).toBe("accessibly");
  });

  it("detects Max Access", () => {
    const html = `<script src="https://maxaccess.io/main.js"></script>`;
    const r = detectOverlaysInHtml(URL, html);
    expect(r.hits[0].vendor.id).toBe("maxaccess");
  });

  it("is case-insensitive", () => {
    const html = `<script src="HTTPS://ACSBAPP.COM/x.js"></script>`;
    const r = detectOverlaysInHtml(URL, html);
    expect(r.hits[0].vendor.id).toBe("accessibe");
  });

  it("returns multiple hits when several overlays coexist", () => {
    const html = `
      <script src="//acsbapp.com/x.js"></script>
      <script src="//cdn.userway.org/y.js"></script>
    `;
    const r = detectOverlaysInHtml(URL, html);
    expect(r.hits).toHaveLength(2);
    const ids = r.hits.map((h) => h.vendor.id);
    expect(ids).toContain("accessibe");
    expect(ids).toContain("userway");
  });

  it("does NOT double-count a vendor when both domain and marker match", () => {
    const html = `
      <script src="//acsbapp.com/x.js"></script>
      <div id="acsb"></div>
    `;
    const r = detectOverlaysInHtml(URL, html);
    const accessibeHits = r.hits.filter((h) => h.vendor.id === "accessibe");
    expect(accessibeHits).toHaveLength(1);
    // Domain takes priority (continue after domain hit).
    expect(accessibeHits[0].matched).toBe("acsbapp.com");
  });

  it("includes ISO timestamp in fetchedAt", () => {
    const r = detectOverlaysInHtml(URL, "<html></html>");
    const parsed = new Date(r.fetchedAt);
    expect(parsed.getTime()).not.toBeNaN();
  });
});
