/**
 * Validation + helpers for /api/enterprise-lead.
 *
 * Extracted from the route handler so these can be unit-tested without
 * spinning up a full Next.js Request mock.
 */

import { z } from "zod";

export const FrameworkId = z.enum([
  "doj_title_ii",
  "section_508",
  "eaa",
  "aoda",
  "acaa",
  "other",
]);

export const EnterpriseLeadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  work_email: z.string().trim().toLowerCase().email().max(254),
  company: z.string().trim().min(1).max(180),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  frameworks: z.array(FrameworkId).max(6).default([]),
  scope: z.string().trim().max(2_000).optional().or(z.literal("")),
});

export type EnterpriseLeadInput = z.infer<typeof EnterpriseLeadSchema>;

/**
 * Disposable / throwaway email domains we explicitly reject. These domains
 * are useless for procurement follow-up — a real Compliance VP at a school
 * district isn't using mailinator. Keeping the list short on purpose;
 * over-aggressive filtering rejects real buyers (e.g. fastmail, hey.com,
 * proton.me are all valid for early-stage procurement).
 */
export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "throwaway.email",
  "trashmail.com",
  "yopmail.com",
  "sharklasers.com",
  "getnada.com",
  "maildrop.cc",
]);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return DISPOSABLE_DOMAINS.has(domain);
}
