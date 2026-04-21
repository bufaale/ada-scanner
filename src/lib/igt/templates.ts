/**
 * Intelligent Guided Test (IGT) catalog.
 *
 * Each template targets a WCAG 2.1 or 2.2 success criterion that automated
 * tools cannot verify reliably. The catalog lives in code (version-controlled,
 * deployable, auditable) rather than the database. PER-SCAN results are
 * stored in the `scan_igt_results` table keyed by `template_id`.
 *
 * Categories group the tests in the UI for easier auditor workflow.
 */

export type IgtCategory = "keyboard" | "screen_reader" | "content" | "visual" | "motion" | "forms";

export interface IgtTemplate {
  id: string;
  wcagCriterion: string;
  wcagLevel: "A" | "AA";
  wcagVersion: "2.1" | "2.2";
  category: IgtCategory;
  /** Short summary, used as the card title. */
  title: string;
  /** The question the auditor answers. */
  question: string;
  /** Step-by-step guidance so a non-expert can execute the check. */
  guidance: string[];
  /** What counts as a pass. */
  passCriteria: string;
  /** Common failure modes, used in the "mark failed" dialog. */
  commonFailures: string[];
}

export const IGT_TEMPLATES: IgtTemplate[] = [
  {
    id: "keyboard-no-trap",
    wcagCriterion: "2.1.2",
    wcagLevel: "A",
    wcagVersion: "2.1",
    category: "keyboard",
    title: "No keyboard trap",
    question: "Can you navigate INTO and OUT of every widget using only the keyboard?",
    guidance: [
      "Open the page and focus the address bar.",
      "Press Tab to move into the page content.",
      "Keep pressing Tab until you have visited every interactive element.",
      "Any time you enter a custom widget (modal, date picker, combobox), verify you can also exit it with Tab or Esc.",
      "Never use the mouse during this test.",
    ],
    passCriteria: "Every interactive element can be reached AND left with keyboard only.",
    commonFailures: [
      "Focus stuck inside a modal with no Esc handler",
      "Custom combobox that eats arrow keys without releasing focus",
      "Iframes / embeds that capture focus and don't return it",
    ],
  },
  {
    id: "keyboard-focus-visible",
    wcagCriterion: "2.4.7",
    wcagLevel: "AA",
    wcagVersion: "2.1",
    category: "keyboard",
    title: "Focus indicator visible",
    question: "Is the focused element always visually distinguishable from non-focused?",
    guidance: [
      "Tab through the page.",
      "Watch the screen — the focused element should have a visible outline, border change, background shift, or equivalent.",
      "On dark backgrounds, ensure the outline has sufficient contrast to be seen.",
    ],
    passCriteria: "Every focusable element shows a clear visual indicator when focused.",
    commonFailures: [
      "`outline: none` applied globally without replacement styling",
      "Focus ring hidden behind overflow:hidden container",
      "Light-grey outline on white background (insufficient contrast)",
    ],
  },
  {
    id: "focus-not-obscured",
    wcagCriterion: "2.4.11",
    wcagLevel: "AA",
    wcagVersion: "2.2",
    category: "keyboard",
    title: "Focus not obscured",
    question: "When an element receives focus, is it never hidden by a sticky header, cookie banner, or other overlapping content?",
    guidance: [
      "Scroll the page until a sticky header / floating button is visible.",
      "Tab through form fields or links that pass under the sticky region.",
      "Check that the focused element remains at least partially visible.",
    ],
    passCriteria: "Focused element is never completely hidden by other content.",
    commonFailures: [
      "Sticky nav bar covers focused input at the top of the viewport",
      "Cookie consent modal overlaps the focused button beneath it",
    ],
  },
  {
    id: "images-of-text",
    wcagCriterion: "1.4.5",
    wcagLevel: "AA",
    wcagVersion: "2.1",
    category: "content",
    title: "No images of text (except logos)",
    question: "Does the page use real text instead of images-of-text for meaningful content?",
    guidance: [
      "Inspect each image on the page.",
      "If an image contains text that conveys meaning (not a logo, not decorative), it should be real HTML text.",
      "Exceptions: logotypes, essential images where the text IS the visual (e.g. a screenshot).",
    ],
    passCriteria: "Text is rendered as HTML text, not baked into images.",
    commonFailures: [
      "Hero headlines rendered as PNGs for font styling",
      "Buttons with text embedded in the icon asset",
      "Marketing copy in infographics without a text alternative",
    ],
  },
  {
    id: "meaningful-sequence",
    wcagCriterion: "1.3.2",
    wcagLevel: "A",
    wcagVersion: "2.1",
    category: "screen_reader",
    title: "Meaningful reading sequence",
    question: "When read in DOM order (screen reader or tab order), does the content still make sense?",
    guidance: [
      "Disable CSS (in DevTools: Emulate disabled CSS, or use the WAVE linearize tool).",
      "Read the page top-to-bottom in the resulting linear order.",
      "Verify the sequence still conveys the intended meaning.",
    ],
    passCriteria: "Content is programmatically in the same sequence that a sighted user encounters it visually.",
    commonFailures: [
      "Multi-column grid where DOM order mixes columns",
      "Absolute-positioned sidebar that appears before main content in DOM",
      "Sections reordered via CSS flexbox `order` property",
    ],
  },
  {
    id: "sensory-characteristics",
    wcagCriterion: "1.3.3",
    wcagLevel: "A",
    wcagVersion: "2.1",
    category: "content",
    title: "Instructions not solely sensory",
    question: "Do instructions avoid relying ONLY on shape, size, visual location, orientation, or sound?",
    guidance: [
      "Scan for instructional text.",
      "Flag anything that uses 'click the button on the right' / 'the green button' / 'the square icon' without also naming the control.",
      "Check that 'above' / 'below' references are accompanied by programmatic identifiers.",
    ],
    passCriteria: "Instructions identify controls by programmatic name, not only sensory characteristics.",
    commonFailures: [
      '"Click the green Submit button" (color-only)',
      '"Tap the square to continue" (shape-only)',
      '"See the panel on the right" (position-only)',
    ],
  },
  {
    id: "use-of-color",
    wcagCriterion: "1.4.1",
    wcagLevel: "A",
    wcagVersion: "2.1",
    category: "visual",
    title: "Color is not the sole differentiator",
    question: "Is color never the ONLY way information is conveyed?",
    guidance: [
      "Look for required form fields — are they marked with more than just red?",
      "Look at data charts — can you distinguish series without color?",
      "Look at links in body text — are they distinguishable from surrounding text without relying on color alone (underline, weight)?",
    ],
    passCriteria: "Every use of color for meaning has a non-color reinforcement.",
    commonFailures: [
      "Error text styled red with no icon or 'Error:' prefix",
      "Inline links styled only by color, no underline",
      "Pie chart legend that uses only hue to differentiate segments",
    ],
  },
  {
    id: "reflow",
    wcagCriterion: "1.4.10",
    wcagLevel: "AA",
    wcagVersion: "2.1",
    category: "visual",
    title: "Reflow at 320 CSS px",
    question: "Does the content reflow without horizontal scrolling at 320 CSS pixels wide?",
    guidance: [
      "Open DevTools device emulation.",
      "Set viewport width to 320 px (or zoom to 400% at 1280 px).",
      "Confirm there is no 2-D scrolling — i.e., no horizontal scrollbar for normal content.",
      "Allowed exceptions: data tables, maps, images, video, games.",
    ],
    passCriteria: "Content renders without a horizontal scrollbar at 320 CSS px (with documented exceptions).",
    commonFailures: [
      "Fixed-width elements break out of viewport",
      "Navigation bar overflows horizontally",
      "Modal dialog wider than 320 px",
    ],
  },
  {
    id: "text-spacing",
    wcagCriterion: "1.4.12",
    wcagLevel: "AA",
    wcagVersion: "2.1",
    category: "visual",
    title: "Text spacing respected",
    question: "Does content remain usable when these spacing values are applied: line-height 1.5, paragraph spacing 2x font-size, letter-spacing 0.12x, word-spacing 0.16x?",
    guidance: [
      "Open DevTools → add a user stylesheet or inject these overrides via :root CSS.",
      "Verify text is not cut off, truncated, or overlapping.",
      "No content should disappear or become unreachable.",
    ],
    passCriteria: "Text remains visible and usable with the specified spacing overrides.",
    commonFailures: [
      "Fixed-height cards that clip text when line-height is increased",
      "Overflow:hidden containers that truncate expanded content",
      "Navigation labels overflow their button boxes",
    ],
  },
  {
    id: "content-on-hover",
    wcagCriterion: "1.4.13",
    wcagLevel: "AA",
    wcagVersion: "2.1",
    category: "visual",
    title: "Hover / focus content is dismissible, hoverable, persistent",
    question: "For content that appears on hover or focus (tooltips, popovers), is it dismissible with Escape, hoverable, and persistent?",
    guidance: [
      "Hover on a tooltip trigger.",
      "Move the pointer from the trigger onto the tooltip itself — it should stay visible.",
      "Press Escape — the tooltip should dismiss.",
      "Don't move the pointer for 5+ seconds — the tooltip should NOT auto-dismiss unless the user dismisses it or the info becomes irrelevant.",
    ],
    passCriteria: "Tooltips meet all three: dismissible, hoverable, persistent.",
    commonFailures: [
      "Tooltip disappears as soon as pointer leaves the trigger",
      "No Esc keybinding to close tooltips",
      "Tooltip auto-dismisses after a timer",
    ],
  },
  {
    id: "target-size",
    wcagCriterion: "2.5.8",
    wcagLevel: "AA",
    wcagVersion: "2.2",
    category: "visual",
    title: "Target size at least 24 x 24 CSS px",
    question: "Are pointer targets at least 24 x 24 CSS pixels (with documented exceptions)?",
    guidance: [
      "Inspect interactive elements (buttons, checkboxes, icons).",
      "Measure the hit-target in CSS pixels.",
      "Exceptions: inline text links, browser-default UA controls, essential small targets, equivalent larger target available.",
    ],
    passCriteria: "Every pointer target is ≥ 24 x 24 CSS px OR qualifies for a listed exception.",
    commonFailures: [
      "Icon-only close buttons < 24 px",
      "Pagination dots < 24 px with no surrounding padding",
      "Social media icon row spaced tightly (< 24 px each)",
    ],
  },
  {
    id: "consistent-nav",
    wcagCriterion: "3.2.3",
    wcagLevel: "AA",
    wcagVersion: "2.1",
    category: "content",
    title: "Consistent navigation",
    question: "Does the primary navigation appear in the same relative order across pages?",
    guidance: [
      "Visit 3-4 different pages of the site.",
      "Compare the order of primary nav items.",
      "Order must be identical (additions/removals allowed, but relative sequence is stable).",
    ],
    passCriteria: "Primary navigation has the same relative order on every page where it appears.",
    commonFailures: [
      "A/B test that randomizes nav order per visit",
      "Mobile hamburger reorders items vs desktop",
    ],
  },
  {
    id: "on-input",
    wcagCriterion: "3.2.2",
    wcagLevel: "A",
    wcagVersion: "2.1",
    category: "forms",
    title: "No surprise context change on input",
    question: "Do form controls avoid triggering navigation or major UI changes just from a value change?",
    guidance: [
      "Interact with selects, radios, checkboxes.",
      "Check that none of them auto-submit the form or redirect the page.",
      "If a dropdown does trigger navigation, it must be documented before the user interacts.",
    ],
    passCriteria: "Changing an input value does not cause a context change unless the user is warned beforehand.",
    commonFailures: [
      "Language selector that auto-redirects on change",
      "Radio that submits form without explicit Submit button",
    ],
  },
  {
    id: "error-identification",
    wcagCriterion: "3.3.1",
    wcagLevel: "A",
    wcagVersion: "2.1",
    category: "forms",
    title: "Errors identified and described",
    question: "When a form submission fails, is the error identified AND described in text?",
    guidance: [
      "Submit a form with known-invalid data (empty required field, bad email, etc.).",
      "Verify the error is described in text (not only red border).",
      "Verify each erroring field has an associated message — not just a global '1 error' count.",
    ],
    passCriteria: "Errors are communicated via text AND associated with the specific invalid field.",
    commonFailures: [
      "Red border with no text message",
      "Single global error banner instead of per-field messages",
      "Error text not programmatically associated with the input",
    ],
  },
  {
    id: "status-messages",
    wcagCriterion: "4.1.3",
    wcagLevel: "AA",
    wcagVersion: "2.1",
    category: "screen_reader",
    title: "Status messages announced",
    question: "Are success/error/progress messages announced by screen readers without stealing focus?",
    guidance: [
      "Enable a screen reader (NVDA on Windows, VoiceOver on Mac, Orca on Linux).",
      "Submit a form that triggers a success toast / error message.",
      "The screen reader should announce the message WITHOUT moving focus.",
      "The message element should use role='status', role='alert', or aria-live.",
    ],
    passCriteria: "Status messages are announced via the accessibility API.",
    commonFailures: [
      "Toast component with no role or aria-live",
      "Error message added via innerHTML without live region",
      "Success indicator that only changes a color",
    ],
  },
  {
    id: "accessible-auth",
    wcagCriterion: "3.3.8",
    wcagLevel: "AA",
    wcagVersion: "2.2",
    category: "forms",
    title: "Accessible authentication",
    question: "Does authentication avoid a cognitive function test (remembering a puzzle, character recognition) without an alternative?",
    guidance: [
      "Attempt to log in / sign up.",
      "If the flow asks you to remember a sequence, re-type a CAPTCHA, or solve a puzzle, there must be an alternative that does NOT require a cognitive test.",
      "Acceptable alternatives: browser autofill support, password-manager compatibility, 'email me a magic link', biometric.",
    ],
    passCriteria: "At least one authentication path does not require a cognitive function test.",
    commonFailures: [
      "Image CAPTCHA with no audio alternative",
      "Memory puzzle as only 2FA option",
      "Forced character-by-character re-type of OTP without paste support",
    ],
  },
];

export const IGT_CATEGORIES: Record<IgtCategory, string> = {
  keyboard: "Keyboard operation",
  screen_reader: "Screen reader announcements",
  content: "Content structure",
  visual: "Visual presentation",
  motion: "Motion & pointer",
  forms: "Forms & authentication",
};

export function templatesByCategory(): Record<IgtCategory, IgtTemplate[]> {
  const out: Record<string, IgtTemplate[]> = {};
  for (const t of IGT_TEMPLATES) {
    (out[t.category] ??= []).push(t);
  }
  return out as Record<IgtCategory, IgtTemplate[]>;
}

export function findTemplate(id: string): IgtTemplate | undefined {
  return IGT_TEMPLATES.find((t) => t.id === id);
}
