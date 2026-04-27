# Quality Audit Report — AccessiScan

**Run:** 2026-04-26 night (Sunday before Tuesday PH launch)
**Auditor:** `pipo-labs:app-quality-auditor` agent (first execution)
**Branch audited:** `claude-design-landing` (against deployed `app-04-ada-scanner.vercel.app`)
**Suite:** 76 tests / **71 passing (93%)** / 5 failing
**Audit dir:** `tests/e2e/exhaustive/`

## Executive summary

AccessiScan is in **strong shape** for Tuesday's launch on the dimensions audited tonight:

- ✅ **Branding clean** — 22/22. Every public route's tab title says "AccessiScan", no template leaks ("SaaS AI Boilerplate", "Lorem ipsum", etc.) anywhere. The bug class operator surfaced in ReviewStack does NOT exist in AccessiScan.
- ✅ **Links clean** — 22/22. No broken internal links, no stale Vercel preview URLs (`app-04-ada-scanner.vercel.app`) in user-facing copy. The brand-scrub commit `c254572` from earlier today held up.
- ✅ **Forms clean** — 8/8. Free WCAG scanner, overlay detector, forgot password, and signup all reject empty/malformed/weak input correctly. Signup correctly disables submit until form is valid (good UX).
- ✅ **Auth gating clean** — 10/10. All 8 protected routes redirect signed-out users to /login. /admin correctly blocks non-admin users and admits admin role.
- ✅ **Empty states clean** — 5/5. Fresh free-tier user lands on dashboard / scans / monitored / pdf-scans / github-settings with 0 data, sees CTA, no Next.js error boundary.
- ⚠️ **Error states** — 3/4. /dashboard with /api/stats=500 and /dashboard/scans with /api/scans=500 BOTH show user-facing error UI (operator's bug #8 fix from Apr 26 morning held up). Network-failure test passes. ONE failure on /free/wcag-scan when API returns 500 — needs investigation (could be real bug: silent catch on free tool failure path).
- ⚠️ **Stripe tiers** — 1/5. Free tier upgrade CTA visible on billing page ✅. Three paid tiers (pro $19, agency $49, business $299) fail the assertion that price labels are visible on `/settings/billing`. Team tier "contact sales" CTA assertion also fails. **Needs investigation tomorrow** — likely either:
  - **Real bug:** /settings/billing only shows the user's CURRENT tier, not all tiers — meaning a free user can't upgrade from there. They'd have to go to /pricing first. UX flaw.
  - **Spec design issue:** test assumes billing page shows full pricing grid; reality is /pricing has the grid and /settings/billing has the portal entry.

## Critical bugs (block launch)

None confirmed. Five tests failing but their failure mode requires investigation to determine bug vs. spec issue.

## High bugs (fix this week)

1. ❓ **Stripe tier upgrade UX gap** — `tests/e2e/exhaustive/stripe-tiers.spec.ts:28` failed for pro, agency, business. The assertion is that `/settings/billing` shows the price label for each tier (e.g., `$19`, `$49`, `$299`). If the billing page doesn't render the full pricing grid, free-tier users have no clear path to upgrade FROM the billing page — they'd have to go to `/pricing` first. **Investigation step:** open `/settings/billing` as a free user, confirm whether prices are visible. If not, decide: (a) add tier comparison to billing page, OR (b) refine spec to assert against `/pricing` for tier prices.

2. ❓ **Team contact-sales CTA missing or hidden** — `tests/e2e/exhaustive/stripe-tiers.spec.ts:81`. If Team tier card isn't shown on `/settings/billing`, the contact-sales CTA can't be tested there. Same investigation as above.

3. ❓ **Free WCAG scanner error path** — `tests/e2e/exhaustive/error-states.spec.ts:79`. When `/api/free/wcag-scan` returns 500, the scanner page should show an error message. Test failed — either error UI is missing or my regex doesn't match the actual error copy. **Investigation step:** intercept that API in dev and confirm what users see. If silent failure, this IS a real bug (same class as operator's bug #8).

## Medium bugs (fix before $1K MRR)

None at this time. The lightweight tests (branding, links, forms, auth, empty-states) found no medium issues.

## Gaps generated (code commits added)

None this session. Phase 5 fixes deferred until the 5 failing tests are categorized as bug vs. spec.

## Gaps flagged (need product decision)

- **Pricing visibility on /settings/billing** — current behavior unclear. If `/settings/billing` is portal-entry only (per Stripe convention), spec needs to redirect to `/pricing` for tier comparison. If it's intended to show comparison too, billing page needs UX work. Operator decision needed.

## Pre-launch checklist

- [x] Branding consistent across all public routes
- [x] Internal links resolve, external links use canonical domains
- [x] Form validation surfaces errors correctly
- [x] Auth gating works (signed-out, free, paid, admin)
- [x] Empty states render with CTAs
- [x] Dashboard error UI surfaces API 500s
- [ ] /settings/billing pricing UX investigated
- [ ] /api/free/wcag-scan error path investigated
- [ ] Existing 20 spec files (auth, scan, billing, etc.) re-run to confirm no regressions
- [ ] V2 design swap completed (next session)
- [ ] Re-audit after v2 swap to verify functional parity

## Next session continuation

```bash
cd c:/Projects/apps-portfolio/app-04-ada-scanner
git checkout claude-design-landing

# Investigate the 5 failing tests:
npx playwright test tests/e2e/exhaustive/stripe-tiers.spec.ts --headed --debug
npx playwright test tests/e2e/exhaustive/error-states.spec.ts --headed --debug -g "free/wcag-scan"

# Then: v2 swap (Phase 1+2+3+4 from project_april_26_quality_audit_initiative memory)
```

## Run summary by spec

| Spec | Tests | Pass | Fail | Notes |
|---|---|---|---|---|
| `branding.spec.ts` | 22 | 22 | 0 | Refined to split TEMPLATE / SIBLING / OLD-NAME categories |
| `links.spec.ts` | 22 | 22 | 0 | Zero broken links, zero stale URLs |
| `forms.spec.ts` | 8 | 8 | 0 | Refined to accept good UX (disabled submit on invalid) |
| `auth-gating.spec.ts` | 10 | 10 | 0 | All protected routes + /admin role check |
| `empty-states.spec.ts` | 5 | 5 | 0 | Fresh users render correctly with CTAs |
| `error-states.spec.ts` | 4 | 3 | 1 | Dashboard handles 500s. Free WCAG path TBD |
| `stripe-tiers.spec.ts` | 5 | 1 | 4 | Investigation needed: billing page pricing UX |
| **TOTAL** | **76** | **71** | **5** | **93% pass rate on first run** |
