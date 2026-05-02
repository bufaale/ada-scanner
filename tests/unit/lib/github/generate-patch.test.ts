import { describe, it, expect } from "vitest";
import { isSafeRule } from "@/lib/github/generate-patch";

describe("isSafeRule (Phase 1 allowlist)", () => {
  it("includes image-alt", () => {
    expect(isSafeRule("image-alt")).toBe(true);
  });

  it("includes label", () => {
    expect(isSafeRule("label")).toBe(true);
  });

  it("includes form-field-multiple-labels", () => {
    expect(isSafeRule("form-field-multiple-labels")).toBe(true);
  });

  it("includes link-name", () => {
    expect(isSafeRule("link-name")).toBe(true);
  });

  it("includes button-name", () => {
    expect(isSafeRule("button-name")).toBe(true);
  });

  it("includes html-has-lang", () => {
    expect(isSafeRule("html-has-lang")).toBe(true);
  });

  it("includes html-lang-valid", () => {
    expect(isSafeRule("html-lang-valid")).toBe(true);
  });

  it("includes meta-viewport", () => {
    expect(isSafeRule("meta-viewport")).toBe(true);
  });

  it("EXCLUDES color-contrast (requires new tokens — Phase 2)", () => {
    expect(isSafeRule("color-contrast")).toBe(false);
  });

  it("EXCLUDES heading-order (structural change — Phase 2)", () => {
    expect(isSafeRule("heading-order")).toBe(false);
  });

  it("EXCLUDES landmark-one-main (structural — Phase 2)", () => {
    expect(isSafeRule("landmark-one-main")).toBe(false);
  });

  it("EXCLUDES random / unknown rule ids", () => {
    expect(isSafeRule("definitely-not-a-rule")).toBe(false);
    expect(isSafeRule("")).toBe(false);
  });

  it("is case-sensitive (axe rules are kebab-lowercase)", () => {
    expect(isSafeRule("Image-Alt")).toBe(false);
    expect(isSafeRule("IMAGE-ALT")).toBe(false);
  });
});
