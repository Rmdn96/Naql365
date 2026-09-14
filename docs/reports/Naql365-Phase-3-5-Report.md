# Naql365 — Phase 3.5 Report

Closeout, 2026-09-14. Evidence is scoped to the accepted protected Preview and the Phase 3.5 feature branch. No merge or Production release.

## A. Starting State

Phase 0–3 accepted and merged. Phase 3.5 extends the existing platform; Phase 4 is not started.

## B. Git Baseline

Branch: `feature/phase-3-5-multi-country-sa-eg`, based on protected develop `6937efa96201329d149e61057433f46a4cdb1d73`. Main remains `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`.

## C. Multi-Country Gap Analysis

`docs/multi-country-sa-eg.md` was committed as `4dafa8a` before migrations. All 13 accepted migrations and the existing intake, pricing, operations and RLS boundaries were inspected.

## D. Market Architecture

One organization owns first-class markets. Currency, timezone, calling code, geography, service availability, pricing and effective-dated tax are explicit relational context. Locale remains independent. Market identity facts cannot be reinterpreted after creation.

## E. Migrations

Six additive Phase 3.5 migrations bring the total to 19: market foundation; authoritative commands; snapshot guards; unambiguous relationship metadata; customer tracking market projection; initial geographic provisioning. The original 13 migrations remain unchanged.

## F. Backfill

Existing business rows inherit SA. The populated 13-migration upgrade test compares every pre-existing commercial field and original trigger state before/after; values and timestamps remain unchanged. New structured location IDs are required for new intake/operational plans; historical address text is retained.

## G. Country/Market Configuration

SA: SAR, Asia/Riyadh, +966. EG: EGP, Africa/Cairo, +20. Both active only in controlled Staging configuration. Geography provisioning itself does not activate markets or service coverage.

## H. Locations

Stable market/region/city IDs; initial Riyadh/Jeddah and Cairo/Alexandria catalogue. Province/governorate terminology is represented separately. Postal code, building and unit are optional. Geographic sources and scope are documented in the gap analysis.

## I. Service Areas

Catalogue presence is independent of active service coverage and market service activation. Staging has 10 synthetic service/city pairs per market. Inactive coverage and inactive market service deny submission in SQL tests.

## J. Request Market

Explicit country selection creates a market-bound draft. Pickup/delivery city IDs must belong to that market. Market changes require cancel/restart; there is no silent commercial migration between countries.

## K. Currency

Integer minor-unit commercial calculations remain authoritative. SAR/EGP are stored explicitly, shown in both locales and constrained against market currency. Sent/accepted snapshots cannot change currency. No FX exists.

## L. Pricing

All existing pricing dimensions and vehicle classes are market-scoped. MANUAL_VERIFIED road distance remains staff-authoritative. Staging has 19 synthetic rules per market; these are not approved tariffs.

## M. Tax Architecture

Effective-dated immutable tax versions carry code, rate, labels and configuration provenance into commercial snapshots. Missing/ambiguous active tax cannot silently fall back. Staging fixtures use SA 1500 bps and EG 2000 bps, explicitly STAGING_TEST; neither is a legal compliance assertion. Existing accepted Saudi tax facts remain intact.

## N. Phone Handling

International normalization supports +966 and +20 and Arabic digits. National request contact input uses the explicitly selected market calling code on blur. International contacts are retained across markets. Profile input requires international form; phone does not choose market. Malformed/duplicate-prefix/overlong input is rejected.

## O. Customer Model

The same organization/customer identity can own requests and orders in both markets; there is no duplicate Auth identity per country. Existing ownership and membership checks remain authoritative.

## P. Branches

Branches carry market context. Composite branch/resource relationships prevent mixing markets; no additional branch management workflow is introduced.

## Q. Drivers

INTERNAL and EXTERNAL drivers carry market context. External drivers still require no Auth account. Existing fleet permission and active membership checks apply.

## R. Vehicles

Vehicles retain independent identity/assignment and market context. Resource selectors filter by Trip market; SQL independently validates compatibility.

## S. Jobs/Trips/Stops

Order → Job → Trip → Stop inherits market via composite relationships and server/database commands. The previous multi-Trip, multi-Pickup/multi-Delivery and POD completion invariants remain in place.

## T. Assignment Invariants

Both directions of cross-market Driver-only and Vehicle-only assignment are rejected in SQL. Driver/Vehicle conflicts, emergency reassignment history, revision races, POD retries and aggregate completion remain covered by the real independent-connection CI harness.

## U. Timezones

IANA/Intl handles Riyadh and Cairo winter/summer behavior. Tests cover Cairo nonexistent/ambiguous wall times and different local month boundaries. No fixed Cairo UTC offset is used.

## V. Scheduling

Planner converts explicit market wall time to UTC and rejects DST ambiguity/gaps. Request date bounds and operational event display use market timezone. Stored instants remain timestamptz.

## W. Reference Generation

Existing formats and shared uniqueness counters remain; business-local reference month now comes from the market timezone. No counter reset or historical renumbering.

## X. Operations UX

Workspace displays market labels and filters all/SA/EG. Resource forms require market, Trip resource choices are scoped, and time/currency context is visible.

## Y. Customer UX

Market selector, scoped cities/services, optional address details and market/currency labels extend the existing eight-step wizard. My Requests/Quotes and tracking support both markets.

## Z. RLS

Hosted shared SQL suites passed after migration. All 54 public tables have RLS enabled. No client privilege or policy was relaxed.

Hosted security checks passed private file/POD isolation, signed access and expiry, suspended membership, security headers/CSP, redirects, cookie behavior and browser asset/source-map inspection. No privileged test secret appeared in inspected assets. A bounded 1000-record Preview runtime sample inspected at 2026-09-13T22:28:25Z contained no error records, secret patterns or auth query values; this is not a claim of exhaustive log retention coverage. Production variables and deployments remain absent. Temporary automation bypass revocation was confirmed with zero credentials remaining and a 302 protection redirect when the revoked credential was used.

## AA. Cross-Market Security

Composite relational constraints plus permission-checked commands enforce route/resource/currency/tax context. Tests run beside pre-existing catalogue/configuration and prove rollback fixtures do not alter it.

## AB. Analytics/SEO

No country marketing pages, nationwide-service claims, global cross-currency totals or FX analytics are introduced. Hosted desktop/mobile AR/EN public tests passed title, metadata, canonical/hreflang, structured data, routing, robots/sitemap and non-production indexing protection.

## AC. Accessibility

PASS: authenticated axe checks on market selection, request/quote, operations workspace/planner, emergency dialog, mobile POD and customer tracking in both market journeys. Foundation AR/EN pages, customer login/account and desktop/mobile checks passed. Keyboard focus and RTL/LTR were checked; no axe violations in the tested WCAG 2 A/AA and 2.1 AA rules. Automated smoke checks do not replace a full assistive-technology audit.

## AD. AR/EN

PASS on the same Preview: market selection is independent of locale; Arabic RTL and English LTR request, commercial and tracking views were exercised for SA and EG. Foundation and intake suites also passed desktop Arabic and mobile English coverage.

## AE. Tests

Local formatting, secret scan, lint, strict types, build, 109 unit/integration tests across 19 files and 18 desktop/mobile E2E passed. Required CI includes install, all quality checks, fresh Supabase reconstruction, shared SQL/RLS, real independent-connection concurrency, official types and typecheck. Hosted database verification covers all 19 migrations and 54/54 public tables with RLS.

All 22 hosted tests passed on one accepted Preview: 3 multi-country/operations tests (SA journey, EG journey, asset security), 6 intake regression, 1 complete commercial regression, 12 foundation/auth/public/security tests. No skipped tests or continue-on-error. Earlier test fixtures were updated to provide mandatory market IDs, country-scoped vehicle identifiers, current market labels and immutable tax labels; security assertions remain intact.

## AF. Saudi Hosted Journey

PASS on the current Preview: explicit SA market, national phone normalization, SAR pricing/tax snapshot, customer acceptance, one Job with two Trips and four Stops per Trip, internal/external resources, independent assignment, conflicts, emergency history, private POD and final aggregate completion. Both locales, authenticated axe/mobile, suspended staff and customer isolation passed. January 2027 10:00 Riyadh persisted as 07:00 UTC and reloaded as 10:00.

Earlier candidates exposed nested main landmarks and missing SQLSTATE 23503 validation mapping. Both were corrected without relaxing constraints or policies. The current hosted run verifies those corrections. Intermediate expect.poll messages are retry observations; final test status is authoritative.

## AG. Egypt Hosted Journey

PASS on the same Preview and customer identity as SA: explicit EG, national +20 phone normalization, EGP and market tax snapshot, accepted Quote → Order → one Job → two Trips, four Stops per Trip, independent internal/external resources, emergency history, private POD and completion only after the final required Trip. January 2027 10:00 Cairo persisted as 08:00 UTC and reloaded as 10:00. The same customer held one Saudi and one Egyptian Order.

An earlier attempt reused the Saudi isolation-fixture vehicle identifier within one organization. The existing uniqueness constraint correctly rejected it. Test identifiers now include country; both full journeys passed without changing that constraint.

## AH. Cross-Market Negative Tests

PASS: hosted SQL proves domestic route, pricing class, branch/resource, currency/tax override, inactive coverage/service/tax and ownership negatives. Hosted browser/API proves SA→EG and EG→SA wrong-city, Driver-only and Vehicle-only denial; cross-tenant reassignment denial; customer/Sales mutation denial; suspended staff denial; customer isolation; private POD denial, no public object access and signed URL expiry. Orders retain accepted currency/tax/distance after operational completion.

## AI. Hosted Staging

Current protected Preview: https://naql365-staging-hretspdjl-naql365.vercel.app — deployment `dpl_DfQKcWmNVQpEQUKwWuYkPi44uhY4`, source `9dc62e604525033e50fc0e60038dc2797e52c524`. Vercel independently reports READY and Preview (target null). Only the four Preview-scoped Staging variables exist; no Production variables or deployments exist. Supabase Auth uses this exact origin and four explicit AR/EN callback URLs with no wildcards. Later commits change test fixtures, operator Auth URLs and documentation, not deployed application behavior.

## AJ. Cleanup

All four hosted suite runners confirmed scoped fixture cleanup. Final audit verified zero Auth test identities, requests, Quotes/Versions, Orders, Jobs, Trips, PODs, assignments, Drivers, Vehicles, file registry rows and storage objects. SA/EG market/city/service/pricing/tax and required role/permission catalogues remain. Temporary Vercel automation credentials were revoked and the revoked credential no longer bypasses protection. No Production data was used or modified.

## AK. Files Changed

- `.github/workflows/database-types.yml`
- `README.md`
- `config/staging/supabase/config.toml`
- `docs/architecture.md`
- `docs/database.md`
- `docs/deployment.md`
- `docs/multi-country-sa-eg.md`
- `docs/reports/Naql365-Phase-3-5-Report.md`
- `docs/security.md`
- `docs/staging.md`
- `docs/testing.md`
- `scripts/staging/configure-markets.mjs`
- `scripts/staging/configure-pricing.mjs`
- `scripts/staging/verify-intake.mjs`
- `scripts/staging/verify-phase2.mjs`
- `scripts/staging/verify-phase3.mjs`
- `scripts/test-operations-concurrency.mjs`
- `src/app/[locale]/(account)/account/orders/[id]/page.tsx`
- `src/app/[locale]/(account)/account/quotes/[id]/page.tsx`
- `src/app/[locale]/(account)/account/quotes/page.tsx`
- `src/app/[locale]/(account)/account/requests/[id]/page.tsx`
- `src/app/[locale]/(account)/account/requests/page.tsx`
- `src/app/[locale]/(portal)/portal/operations/trips/[id]/page.tsx`
- `src/app/[locale]/(portal)/portal/quotes/[id]/page.tsx`
- `src/app/[locale]/(portal)/portal/quotes/page.tsx`
- `src/app/[locale]/request/page.tsx`
- `src/app/api/customer/requests/route.ts`
- `src/components/operations/planner.tsx`
- `src/components/operations/workspace.tsx`
- `src/components/pricing/sales-pricing.tsx`
- `src/components/requests/account.tsx`
- `src/components/requests/wizard.tsx`
- `src/domain/markets/model.ts`
- `src/domain/operations/model.ts`
- `src/domain/pricing/model.ts`
- `src/domain/requests/intake.ts`
- `src/i18n/customer.ts`
- `src/i18n/markets.ts`
- `src/i18n/quotes.ts`
- `src/infrastructure/markets/service.ts`
- `src/infrastructure/operations/service.ts`
- `src/infrastructure/pricing/service.ts`
- `src/infrastructure/requests/service.ts`
- `src/infrastructure/supabase/database.types.ts`
- `supabase/migrations/20260913000100_market_foundation.sql`
- `supabase/migrations/20260913000200_market_commands.sql`
- `supabase/migrations/20260913000300_market_snapshot_guards.sql`
- `supabase/migrations/20260913000400_market_relationship_metadata.sql`
- `supabase/migrations/20260913000500_market_tracking_projection.sql`
- `supabase/migrations/20260913000600_initial_market_geography.sql`
- `supabase/tests/customer_request.test.sql`
- `supabase/tests/foundation.test.sql`
- `supabase/tests/market.test.sql`
- `supabase/tests/phase2.test.sql`
- `supabase/tests/phase3.test.sql`
- `tests/fixtures/phase2-legacy.sql`
- `tests/helpers/database.d.mts`
- `tests/helpers/database.mjs`
- `tests/intake/journey.spec.ts`
- `tests/integration/market-fixture-isolation.test.ts`
- `tests/integration/market-upgrade.test.ts`
- `tests/integration/markets.test.ts`
- `tests/phase2/journey.spec.ts`
- `tests/phase3/journey.spec.ts`
- `tests/unit/intake.test.ts`
- `tests/unit/markets.test.ts`
- `tests/unit/operations.test.ts`
- `tests/unit/pricing.test.ts`

## AL. Commits/CI

Branch: `feature/phase-3-5-multi-country-sa-eg`. The immutable accepted Preview application source is `9dc62e604525033e50fc0e60038dc2797e52c524`, with successful [CI 34761749962](https://github.com/Rmdn96/Naql365/actions/runs/34761749962). Subsequent test/configuration commits `d0c7f52` and `8792371` passed [CI 34782396053](https://github.com/Rmdn96/Naql365/actions/runs/34782396053) and [CI 34783283827](https://github.com/Rmdn96/Naql365/actions/runs/34783283827). Later closeout commits contain tests/documentation only; no application/migration changes after the accepted Preview source.

The final containing report commit SHA and its exact-HEAD CI run are supplied in the owner closeout message after that run finishes; use `git rev-parse origin/feature/phase-3-5-multi-country-sa-eg` to resolve it without a self-referential commit hash in this file. Both required jobs must pass before delivery. No merge is authorized.

Official hosted types include PostgREST 14.5 metadata and match committed formatted types. Initial concurrency fixture cleanup ordering was fixed before subsequent complete CI passes; no concurrency invariant was skipped.

## AM. Known Limitations

Initial city catalogue is deliberately limited. Coverage, pricing and tax are synthetic Staging fixtures. No Egyptian legal tax certification, Production tariff approval or routing-provider integration is claimed. Market changes require draft restart. Ambiguous DST wall times require choosing another time.

## AN. Deferred Items

Cross-border transport/customs/ports, FX, legal certification, Production tariffs, Driver Portal, GPS/ETA, optimization, payments/refunds/settlement, marketplace/bidding, AI and Phase 4.

## AO. Acceptance Matrix

| Gate                      | Result | Evidence                                                                         |
| ------------------------- | ------ | -------------------------------------------------------------------------------- |
| Git baseline              | PASS   | Protected develop 6937efa; main unchanged; scoped feature branch                 |
| Gap analysis              | PASS   | 4dafa8a committed before migrations; original 13 inspected                       |
| Market architecture       | PASS   | One organization, explicit relational market; schema and hosted journeys         |
| Migrations/backfill       | PASS   | 19 migrations; populated original-13 upgrade; authoritative hosted history/types |
| SA Market                 | PASS   | SA hosted journey; SAR/Asia-Riyadh/+966                                          |
| EG Market                 | PASS   | EG hosted journey; EGP/Africa-Cairo/+20                                          |
| Locations                 | PASS   | Scoped stable IDs and initial four-city catalogue; hosted intake/planner         |
| Service areas             | PASS   | Active coverage separate from catalogue; negative SQL tests                      |
| Request Market            | PASS   | Explicit hosted selection, immutable market; same customer in both               |
| Cross-market route denial | PASS   | Hosted API wrong-city denial in both directions; SQL                             |
| SAR                       | PASS   | Saudi immutable commercial snapshot and UI                                       |
| EGP                       | PASS   | Egyptian immutable commercial snapshot and UI                                    |
| Pricing isolation         | PASS   | Market rules/classes and negative shared SQL                                     |
| Tax isolation             | PASS   | Effective immutable versions; missing tax/override negatives                     |
| Phone handling            | PASS   | Hosted +966/+20 national normalization; invalid input unit tests                 |
| Branch Market             | PASS   | Hosted SQL branch/resource composite-constraint negatives                        |
| Driver Market             | PASS   | Both-market internal/external hosted journeys and wrong-market denial            |
| Vehicle Market            | PASS   | Independent hosted assignment and both-direction denial                          |
| Job/Trip/Stop Market      | PASS   | Two Trips/four Stops per Trip in each hosted market                              |
| Assignment isolation      | PASS   | Cross-market/tenant hosted denial; independent-connection CI races               |
| Timezones                 | PASS   | Riyadh/Cairo winter/summer, DST gap/overlap/month-boundary unit tests            |
| Scheduling                | PASS   | Hosted winter wall-time → UTC persistence and reload, both markets               |
| Operations UX             | PASS   | Hosted workspace/planner/emergency/POD desktop/mobile axe                        |
| Customer UX               | PASS   | Same identity across markets; hosted request/quote/tracking                      |
| RLS                       | PASS   | Hosted shared SQL; 54/54 tables RLS; browser authorization negatives             |
| Customer isolation        | PASS   | Hosted peer and cross-tenant denial; foundation/intake regressions               |
| Cross-market negatives    | PASS   | Hosted SQL plus both-direction browser/API assertions                            |
| Accessibility             | PASS   | Authenticated and public axe, labels/focus/RTL/LTR/mobile                        |
| AR/EN                     | PASS   | Both locales in both market journeys and old hosted regressions                  |
| Saudi hosted journey      | PASS   | PASS current Preview, one Job/two Trips/POD/completion                           |
| Egypt hosted journey      | PASS   | PASS same Preview and customer, one Job/two Trips/POD/completion                 |
| Regression                | PASS   | 22 hosted tests total; 109 unit/integration and 18 local E2E                     |
| CI                        | PASS   | Both required jobs passed; exact final HEAD run in delivery evidence             |
| Hosted Staging            | PASS   | READY protected Preview 9dc62e6; isolated Supabase Staging                       |
| Cleanup                   | PASS   | Suite cleanup + zero-count audit + automation credential revocation              |
| Scope compliance          | PASS   | No main/develop change, merge, Production or Phase 4                             |

## AP. Final Decision

PHASE 3.5 PASS — READY FOR REVIEW

All critical gates have executed evidence. Owner review and protected approval remain required before any merge. Production is untouched and Phase 4 remains locked.
