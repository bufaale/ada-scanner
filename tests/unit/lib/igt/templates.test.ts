import { describe, it, expect } from "vitest";
import {
  IGT_TEMPLATES,
  IGT_CATEGORIES,
  templatesByCategory,
  findTemplate,
} from "@/lib/igt/templates";

describe("IGT_TEMPLATES catalog", () => {
  it("ships exactly 16 templates", () => {
    expect(IGT_TEMPLATES.length).toBe(16);
  });

  it("template ids are unique", () => {
    const ids = IGT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every template references a real WCAG SC and a non-empty title/question", () => {
    for (const t of IGT_TEMPLATES) {
      expect(t.wcagCriterion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(["A", "AA"]).toContain(t.wcagLevel);
      expect(["2.1", "2.2"]).toContain(t.wcagVersion);
      expect(t.title.length).toBeGreaterThan(3);
      expect(t.question.length).toBeGreaterThan(10);
      expect(t.guidance.length).toBeGreaterThan(0);
      expect(t.passCriteria.length).toBeGreaterThan(10);
      expect(t.commonFailures.length).toBeGreaterThan(0);
    }
  });

  it("every template's category is a known IgtCategory", () => {
    const known = Object.keys(IGT_CATEGORIES);
    for (const t of IGT_TEMPLATES) {
      expect(known).toContain(t.category);
    }
  });
});

describe("IGT_CATEGORIES", () => {
  it("declares the 6 known categories", () => {
    expect(Object.keys(IGT_CATEGORIES).sort()).toEqual([
      "content",
      "forms",
      "keyboard",
      "motion",
      "screen_reader",
      "visual",
    ]);
  });
});

describe("templatesByCategory", () => {
  it("groups templates by category key", () => {
    const grouped = templatesByCategory();
    expect(Object.keys(grouped).length).toBeGreaterThan(0);
    let total = 0;
    for (const arr of Object.values(grouped)) total += arr.length;
    expect(total).toBe(IGT_TEMPLATES.length);
  });

  it("keyboard category contains 'keyboard-no-trap'", () => {
    const grouped = templatesByCategory();
    const keyboard = grouped.keyboard;
    expect(keyboard.find((t) => t.id === "keyboard-no-trap")).toBeDefined();
  });
});

describe("findTemplate", () => {
  it("returns the template by id", () => {
    const t = findTemplate("keyboard-no-trap");
    expect(t).toBeDefined();
    expect(t!.wcagCriterion).toBe("2.1.2");
  });

  it("returns undefined for unknown id", () => {
    expect(findTemplate("does-not-exist")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(findTemplate("")).toBeUndefined();
  });
});
