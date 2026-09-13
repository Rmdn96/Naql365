# Naql365 — Phase 3.5 Report

Checkpoint, 2026-09-13. Evidence is scoped to the current implementation and candidate Preview.

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

## AA. Cross-Market Security

Composite relational constraints plus permission-checked commands enforce route/resource/currency/tax context. Tests run beside pre-existing catalogue/configuration and prove rollback fixtures do not alter it.

## AB. Analytics/SEO

No country marketing pages, nationwide-service claims, global cross-currency totals or FX analytics are introduced. Existing non-production robots/noindex and localized metadata remain; hosted regression is pending.

## AC. Accessibility

Local desktop/mobile E2E passed. Hosted market selector, customer and authenticated operational axe/focus/responsive acceptance is in progress.

## AD. AR/EN

Market and locale are independent. Hosted both-locale evidence is in progress on one Preview.

## AE. Tests

Local strict types, lint, build and 18 E2E passed. Unit/integration suite now contains 109 tests across 19 files. CI includes fresh real Supabase reset, shared SQL/RLS, independent PostgreSQL connection concurrency, generated types and typecheck. Hosted SQL passed. Hosted browser acceptance remains pending.

## AF. Saudi Hosted Journey

Request, pricing, acceptance and correct market/currency/tax assertions passed, then the quote-page locator failed. Dispatch/POD remains unexecuted for this candidate. The quote pages contain nested main landmarks; the application fix is awaiting fresh CI/Preview acceptance.

## AG. Egypt Hosted Journey

In progress; do not treat local results as hosted PASS.

## AH. Cross-Market Negative Tests

Hosted SQL proved domestic route, pricing class, resource, commercial override and ownership negatives. Hosted browser/API probes remain in progress.

## AI. Hosted Staging

Candidate Preview: https://naql365-staging-efwrhnkgv-naql365.vercel.app — dpl_Hnfmm2CBfn4mHzQseaQEcyXQQwEi, independently classified Preview and READY, source f70d5fde27c6eb6a1b8ac6ae9505e11aeed7d4bf. Protected with Vercel SSO. Only Preview-scoped Staging variables exist; no Production deployment/scope exists. Staging Auth uses this exact origin and four explicit callback URLs, no wildcards.

## AJ. Cleanup

Shared hosted SQL fixtures rolled back. Browser fixture cleanup and temporary automation credential removal must be verified after acceptance.

## AK. Files Changed

Migrations, domain market utilities, scoped server adapters, affected customer/pricing/operations presentation, authoritative types, shared SQL and browser tests, Staging configuration tools and documentation. Final inventory will be recorded at closeout.

## AL. Commits/CI

Latest deployment source f70d5fde27c6eb6a1b8ac6ae9505e11aeed7d4bf passed both required CI jobs: https://github.com/Rmdn96/Naql365/actions/runs/34746822991. Initial concurrency cleanup failed after all race assertions passed; fixture audit deletion order was corrected, then CI passed. Hosted types differ from local generated types only by the authoritative PostgREST 14.5 metadata header; no business schema drift.

## AM. Known Limitations

Initial city catalogue is deliberately limited. Coverage, pricing and tax are synthetic Staging fixtures. No Egyptian legal tax certification, Production tariff approval or routing-provider integration is claimed. Market changes require draft restart. Ambiguous DST wall times require choosing another time.

## AN. Deferred Items

Cross-border transport/customs/ports, FX, legal certification, Production tariffs, Driver Portal, GPS/ETA, optimization, payments/refunds/settlement, marketplace/bidding, AI and Phase 4.

## AO. Acceptance Matrix

| Gate                      | Result  | Evidence                                                             |
| ------------------------- | ------- | -------------------------------------------------------------------- |
| Git baseline              | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Gap analysis              | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Market architecture       | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Migrations/backfill       | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| SA Market                 | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| EG Market                 | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Locations                 | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Service areas             | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Request Market            | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Cross-market route denial | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| SAR                       | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| EGP                       | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Pricing isolation         | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Tax isolation             | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Phone handling            | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Branch Market             | PARTIAL | Final hosted acceptance/current-source verification pending          |
| Driver Market             | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Vehicle Market            | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Job/Trip/Stop Market      | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Assignment isolation      | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Timezones                 | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Scheduling                | PARTIAL | Final hosted acceptance/current-source verification pending          |
| Operations UX             | PARTIAL | Final hosted acceptance/current-source verification pending          |
| Customer UX               | PARTIAL | Final hosted acceptance/current-source verification pending          |
| RLS                       | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Customer isolation        | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Cross-market negatives    | PASS    | Scoped implementation and executed SQL/unit evidence described above |
| Accessibility             | PARTIAL | Final hosted acceptance/current-source verification pending          |
| AR/EN                     | PARTIAL | Final hosted acceptance/current-source verification pending          |
| Saudi hosted journey      | PARTIAL | Final hosted acceptance/current-source verification pending          |
| Egypt hosted journey      | PARTIAL | Final hosted acceptance/current-source verification pending          |
| Regression                | PARTIAL | Final hosted acceptance/current-source verification pending          |
| CI                        | PARTIAL | Final hosted acceptance/current-source verification pending          |
| Hosted Staging            | PARTIAL | Final hosted acceptance/current-source verification pending          |
| Cleanup                   | PARTIAL | Final hosted acceptance/current-source verification pending          |
| Scope compliance          | PASS    | Scoped implementation and executed SQL/unit evidence described above |

## AP. Final Decision

PHASE 3.5 PARTIAL — NOT READY

Implementation checkpoint. Hosted acceptance and closeout remain in progress. No merge, Production deployment or Phase 4.
