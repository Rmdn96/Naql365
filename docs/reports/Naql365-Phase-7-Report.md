# Naql365 Phase 7 — MVP launch, guest ordering and visual experience

**Implementation checkpoint; not final acceptance.** This is the canonical report. Update it in place as remaining work is verified. No Production release or merge is authorized by this report.

## 29 September continuation — current evidence

This section supersedes the older implementation checkpoint below; hosted acceptance is still in progress.

- Updated source `5ff24bdadc89e59acd96589da62fdca2b40de811`: CI [36589983451](https://github.com/Rmdn96/Naql365/actions/runs/36589983451) PASS, local E2E **32 PASS** including delayed-hydration controls. Candidate https://naql365-staging-hcp52bipi-naql365.vercel.app (`dpl_gWukANJGCWNGfk7QrgZGkhKGcgiH`) independently READY / Preview.
- Updated Phase 7 hosted suite: **6 PASS**. SA guest CASH and EG guest InstaPay TEST transfer both completed Request → Quote → Payment → internal Driver → POD → completed Order without registration. EG included Finance rejection/reupload/confirmation and private signed proof expiry. Quote rejection created no Order. Both locales passed public accessibility/responsive/SEO/contact checks. Capability isolation and duplicate creation passed. Final cleanup and full registered regressions are separate gates.
- Staging guest policy is now intended bounded configuration, enabled through `scripts/staging/configure-guest.mjs --apply`; existing expiry/quota are preserved. Acceptance temporarily raises the creation quota and restores it afterward.

- Current tested source: `43ab3a2260b8bbf3f8938bb05c678491de2b8332`. Full CI [36556662562](https://github.com/Rmdn96/Naql365/actions/runs/36556662562) PASS, including independent-connection concurrency, fresh migrations, RLS and exact generated types.
- Local validation: 176 unit/integration tests in 40 files PASS; 30 browser tests PASS; formatting, lint, strict types, secret scan and build PASS. Production dependency audit reports zero vulnerabilities.
- Total migrations: **44**. Staging upgraded from the accepted 31; exact ledger, SQL assertions and generated public schema types PASS. RLS enabled on all 59 public tables. Earlier accepted migrations remain unchanged.
- Protected candidate Preview: https://naql365-staging-o00hmi43d-naql365.vercel.app, `dpl_3AzEHEiNP1c5QnqBC6beZen5YubB`, independently verified READY / Preview for the source above. This is not yet final hosted acceptance.
- Staging Auth uses this exact origin with four exact localized callback URLs, no wildcard. Vercel has zero Production deployments and no Production-scoped variables.
- Quick Quote catalogue/preselection, EG transfer destinations, private aggregate funnel telemetry, opt-in registered live-tracking presentation, and approved-content-only legal routes are implemented. Unpublished legal routes now return a real HTTP 404 before streaming.
- Hosted tests now cover guest SA CASH and EG transfer/rejection/reupload through Driver/POD completion, link replacement/revocation, capability isolation, concurrent creation replay, public AR/EN accessibility and four viewport widths. These are test definitions, not PASS claims until executed.
- The fixture runner records only scoped IDs and one-way capability verifiers before request creation, enabling cleanup after a lost HTTP response. Hosted fixture/automation credential cleanup remains pending execution evidence.
- Remaining: complete hosted journeys/security/visual checks, registered Phase 0–6 regression on the same accepted Preview, bounded runtime review, explicit cleanup, final report and final-HEAD CI. Main/develop/Production/Phase 8 remain untouched.
- First hosted run: **2 PASS / 4 FAIL**, not accepted. The capability-isolation/concurrent-creation test and English public checks passed. Three journeys timed out at the first guest-start click; the client-only button lacked the existing hydration guard. The Arabic public test incorrectly expected the English brand in the localized title. Scoped fixture cleanup passed. Both causes are being corrected and the complete suite must be rerun; no downstream journey acceptance is inferred.

## A–C. Starting state, Git baseline and gap analysis

- Branch: `feature/phase-7-mvp-launch-guest-brand`.
- Accepted remote develop: `24f1a4c6a3b8027a6ce89aaf72c8c3bb5fd6fbd9`; 31 migrations.
- Main: `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`, unchanged in remote-ref checks.
- Gap analysis: `docs/phase-7-mvp-launch-gap-analysis.md`, committed as `435fcb4` before any Phase 7 migration. Completed analysis is preserved.

## D–J. Guest architecture, security, Request, Quote, Order, payment and tracking

A GUEST Customer has no Auth identity, profile, role or membership. A private grant binds organization, customer and one Request journey. Only a SHA-256 verifier is stored; issuance provides a high-entropy `g1_` bearer secret once. Expiry is constrained/configurable and revocation permanent. A fragment-based continuation URL exchanges the secret for a Secure/HttpOnly/SameSite cookie on HTTPS. The fragment is removed before fetching journey data. Requests use a separate publishable-key Supabase client carrying the capability, never a service-role key or fabricated Auth identity.

The existing Request initializer, save/submit commands, eight-step wizard, Quote response transaction, payment commands, private evidence pipeline and status-only tracking projection are reused. Anonymous raw writes remain denied. Grant checks are independent of ordinary RBAC; `has_permission` is not weakened. CASH remains due until Finance collection; a transfer proof remains unverified until Finance confirms the exact amount/currency. Payment instructions are hidden until BANK_TRANSFER selection, with a separate non-sensitive availability flag.

Preliminary pricing remains server-authoritative and waits for Sales-verified road distance. Guest UI exposes the safe preliminary projection when available; it does not invent an instant route price. Quote acceptance preserves exactly-one Order and immutable commercial facts. Guest tracking uses the accepted safe status projection; guest live-map presentation is off. Registered tracking remains available under existing permissions.

Migration 39 adds explicit `guest.links.manage` permission for SUPER_ADMIN, SALES and OPERATIONS. Inspection does not reveal a token; replacement atomically revokes the prior grant and issues a new one; revocation and replacement record grant IDs only. The shared grant-first locking order is retained. Sales now has an explicit replacement/revocation control with an ephemeral copy action. The secret is not rendered as text or sent to WhatsApp. Independent-connection rotation races and hosted staff UI verification remain unfinished.

## K–M. Registered regression, WhatsApp and Market selection

Existing registered services default to the original authenticated client. Guest adapters are selected only by dedicated server routes. Local existing integration/SQL tests pass at the recorded checkpoint; registered hosted regression on the Phase 7 Preview has not run.

Public contact values live in one intentional public Market configuration, separate from Finance data. The selected SA/EG country updates WhatsApp and the initial guest Request country; locale remains independent. Reference messages accept a bounded reference format and never arbitrary text or secret URLs. Local desktop/mobile browser tests verify country switching and entering Request without a login wall. Reference-aware hosted verification is pending.

## N–T. Brand, Homepage, mobile, tokens, Quick Quote, navigation and flags

The public page now uses navy/blue/cyan, a reusable route motif, product-status illustration explicitly labeled as illustrative, clear Request CTA, active service catalogue, four-step explanation, tracking preview, business section, useful FAQ and final CTA. Alexandria and Inter use Next font self-hosting. No stock-photo dependency or animation library was added. Layout uses server components with small interactive Market/contact controls.

Services come from active Market/service coverage, never invented offerings. The current Quick Quote section enters the real Request flow; inline location/service preselection remains to be finished. Guest live location is not presented; a general launch presentation-flag configuration is not complete. Legal-page structure and approved content gates remain pending. Existing operational systems are preserved.

## U–X. SEO, analytics, security and abuse

Localized canonical/hreflang and WebSite structured data remain. Guest pages/API carry noindex/noarchive and no-referrer headers; existing CSP and same-origin mutations remain. Local exchange test proves predictable references cannot authorize access and are removed from the fragment before any network request.

Strict analytics event validation admits a finite event/Market/context vocabulary only; the actual collector and complete funnel instrumentation remain unfinished. Do not claim analytics acceptance from the schema alone.

Private grant/rate tables have RLS and no anonymous table permissions. Per-organization creation quota and per-grant mutation/upload quotas execute authoritatively in PostgreSQL. Request bodies and proof streams are bounded. Image normalization and existing private PDF handling are reused; no malware-scanning claim is made. Initial anonymous creation retry recovery and bounded invalid-exchange abuse handling need completion/review before acceptance.

## Y–Z. Performance and accessibility

An optimized local build passed before the latest preliminary-price display addition. There is no video Hero, heavy animation dependency or unconditional guest map. Final build/page-size comparison remains required.

Local AR/EN Homepage checks at 360, 390, 768 and 1440 pixels found zero horizontal overflow and zero axe WCAG A/AA-tagged violations after fixing a text-link distinction and English footer overflow. This is not WCAG certification. Authenticated guest Quote/Checkout/Tracking and hosted visual/a11y acceptance remain pending. Local screenshots are outside Git in the workspace `work/phase7-{ar,en}-{390,1440}.png`; they contain public synthetic presentation only.

## AA–AE. Hosted journeys, rejection/reupload, WhatsApp and regression

No Phase 7 hosted journey has run and no Phase 7 Staging migration has been applied at this checkpoint. Local integration tests prove guest Quote accept/reject, CASH due, private transfer upload, Finance-only reject/confirm, reupload and wrong-currency denial. They do not replace the required SA/EG browser-to-database completion journeys on one protected Preview.

## AF–AI. Migrations, tests, CI and protected Preview

Repository now contains 42 migrations (31 accepted + eleven additive Phase 7 migrations). Accepted Phase 0–6 migrations were not rewritten. The Phase 7 projection grants were corrected for existing composite PostgREST relationships before any hosted application.

Evidence available:

- Continuation on 27 September: migration 40 serializes creation retries using a browser-generated 256-bit capability, storing only its verifier. Replays return the same journey; revoked/expired grants cannot be resurrected. Migration 41 commits invalid exchange attempts against a bounded organization-wide budget (300/minute). This aggregate limit intentionally trades availability for abuse protection; it is not a per-IP defense. Browser retry state is held in memory and does not survive closing the page.
- Migration 42 extends existing privileged transfer configuration with BANK, VODAFONE_CASH and INSTAPAY. Wallet destinations require EG/EGP. Customer selection is scoped to the accepted Order's organization/Market/currency, freezes after a proof attempt, and each proof preserves the destination type and instructions. No historical snapshot is rewritten. Local tests cover privileged configuration, cross-Market rejection, selection, frozen history and private instructions. The shared checkout includes Copy IBAN. Hosted EG acceptance remains pending.
- Full local suite after migration 42: 171 tests / 37 files PASS. Typecheck and lint PASS after importing authoritative 42-migration types from successful workflow `36336025201`. Final release checks remain required after outstanding implementation.
- CI `36335343973` and `36336025183`: application quality jobs PASS. Database jobs executed SQL/RLS and real independent-connection guest creation/acceptance/revocation/rotation/proof races successfully, then failed only at the generated-types diff. Types were imported from official successful workflows; these runs are not claimed as complete CI PASS. Exact next-HEAD CI is required.

- Full local unit/integration suite: 168 tests passed after link-management addition, including suspended and cross-tenant staff denial. Final full-suite run remains required after subsequent changes.
- Local guest/registered payment integration: exact authority, private proof, rejection/reupload and immutable acceptance covered.
- Local browser suite: original 24 tests plus four new public tests. Two new tests initially selected both the application alert and Next's route announcer; narrowed the locator to `main`. Four new tests then passed. Existing 24 had passed in the initial run; final combined run remains required.
- Formatting, lint, strict typecheck, secret-pattern scan and optimized build have passed at intermediate checkpoints. They must be rerun for final HEAD.
- CI `36243476082` for `1c7537ac0884fcd5fb18e3eb164ebc24d523f45b`: application quality job PASS; database job failed at generated-type diff. No errors were ignored. Official types workflow `36243476085` PASS; its 38-migration artifact was imported. Official workflow `36320835712` reconstructed all 39 migrations successfully; its exact generated types were imported. CI `36320835689` passed the full application quality job, including browser tests; database checks failed only on the then-uncommitted types diff. Exact updated-HEAD CI is pending.
- No accepted Phase 7 Preview URL yet. The previous phase's Preview is not Phase 7 evidence.

## AJ–AL. Production runbook, release blockers and cleanup

See `docs/production-launch-runbook.md`. It contains placeholders and privileged configuration steps, not owner financial values. Production domain, resources/secrets, coverage, pricing, taxes, private payment instructions, legal copy and authorized people remain separate release gates.

No disposable Phase 7 hosted fixtures or bypass credentials have been created. Local PGlite fixtures are isolated and closed by the tests. Final hosted cleanup cannot pass until hosted fixtures have actually been created, exercised and removed. No Production deployment/configuration was performed; main/develop were not modified.

## AM–AP. Files, commits, known limitations and deferred items

Logical checkpoints: `435fcb4` gap analysis; `fed0c33` guest capability; `432dad6` public-contact/privacy schemas; `6e1b85d` projections/private attachments; `f43353e` shared Quote authority; `d8f205d` official types/lint helper; `33d19e0` guest payment/tracking authority; `1c7537a` shared guest journey UI. Further commits are listed by `git log` on the feature branch; this checkpoint is not a final feature SHA.

Changed areas: additive migrations, guest domain/infrastructure/routes, shared Request/Quote/Payment/Tracking views, public Market/contact/landing components, localized copy/styles/fonts, integration and browser tests, official generated database types and launch documentation. Next dev generated `AGENTS.md`/`CLAUDE.md`; these contain framework guidance only.

Outstanding implementation/acceptance work, in order:

1. Verify implemented creation retries, exchange abuse controls and staff link inspection/replacement/copy in hosted tests. Local expiry/revocation and independent-connection races pass.
2. Verify implemented EG destination selection/snapshots and Copy IBAN in hosted acceptance; synthetic values only.
3. Complete Quick Quote preselection, safe analytics integration, launch presentation controls, legal-page technical structure and customer-safe navigation/copy review.
4. Retain passing independent-connection guest races in final CI. Re-run populated 31-migration upgrade and preserve historical snapshots/files after remaining migrations.
5. Import final authoritative types, run all local/CI gates, then apply to Staging and deploy a genuine protected Preview.
6. Execute both full guest hosted journeys, negative/security/Storage/expiry/log/bundle checks, registered Phase 0–6 regression, all required responsive/a11y/visual checks; clean all fixtures and owned bypasses.
7. Update every acceptance entry with actual evidence and final exact-HEAD CI before requesting owner review.

No refunds/cancellation engine, gateway, wallet API, automated WhatsApp/SMS, account claiming, new routing provider, Production launch or Phase 8 has been implemented.

## AQ. Acceptance matrix

PASS here is limited to the evidence explicitly described. Any combined hosted requirement remains PARTIAL or BLOCKED.

| Gate                           | Result  | Evidence / remaining work                                                |
| ------------------------------ | ------- | ------------------------------------------------------------------------ |
| Git baseline                   | PASS    | Accepted develop and main refs checked; feature branch isolated          |
| Gap analysis                   | PASS    | Committed before migrations                                              |
| Guest request                  | PARTIAL | Shared local commands/UI; hosted journey pending                         |
| Guest token security           | PARTIAL | Hash, expiry, revocation/local tests; concurrency/hosted pending         |
| Reference ≠ authorization      | PASS    | Unit/SQL and local browser rejection                                     |
| Guest preliminary quote        | PARTIAL | Safe projection/UI; hosted pending                                       |
| Guest final Quote              | PARTIAL | Shared local authority; hosted pending                                   |
| Guest accept/reject            | PARTIAL | Local immutable acceptance/rejection; independent connections pending    |
| Guest Order                    | PARTIAL | Local exactly-one behavior; hosted pending                               |
| Guest CASH                     | PARTIAL | Local due/Finance-only behavior; hosted pending                          |
| Guest BANK_TRANSFER            | PARTIAL | Local proof/review; EG destination configuration unfinished              |
| Guest proof privacy            | PARTIAL | Local Storage RLS; hosted signed URL/expiry pending                      |
| Guest tracking                 | PARTIAL | Shared status projection; operational hosted journey pending             |
| Customer isolation             | PARTIAL | Local RLS negatives; full hosted matrix pending                          |
| Registered customer regression | PARTIAL | Existing local tests; hosted Phase 0–6 pending                           |
| SA WhatsApp                    | PASS    | Canonical public config and local browser destination                    |
| EG WhatsApp                    | PASS    | Canonical public config and local browser destination                    |
| Market switching               | PARTIAL | Public contact/request country local PASS; full hosted flows pending     |
| Homepage redesign              | PARTIAL | Local visual/a11y checks; hosted review pending                          |
| Hero                           | PARTIAL | Local rendered CTA/illustrative motif; hosted pending                    |
| Quick Quote                    | PARTIAL | Enters shared Request; inline preselection unfinished                    |
| Services                       | PARTIAL | Active catalogue query; hosted actual-catalogue check pending            |
| How It Works                   | PASS    | Four localized customer-facing steps                                     |
| Tracking preview               | PASS    | Explicit illustrative status presentation                                |
| Route visual motif             | PARTIAL | Homepage reusable motif; journey integration incomplete                  |
| Mobile UX                      | PARTIAL | Public eight viewport/locale checks; secure pages pending                |
| AR/EN                          | PARTIAL | Public/shared guest copy; full hosted flows pending                      |
| RTL/LTR                        | PARTIAL | Public local checks; hosted pending                                      |
| SEO                            | PARTIAL | Local public/guest guards; hosted pending                                |
| Analytics privacy              | PARTIAL | Strict schema only; collector/instrumentation unfinished                 |
| Abuse protection               | PARTIAL | DB quotas/body bounds; further abuse/retry gates pending                 |
| RLS                            | PARTIAL | Local database tests; hosted Phase 7 pending                             |
| Security negatives             | PARTIAL | Local subset; final hosted matrix pending                                |
| Performance                    | PARTIAL | Intermediate build; final measurement pending                            |
| Accessibility                  | PARTIAL | Public local axe PASS; secure hosted pages pending                       |
| SA guest hosted journey        | BLOCKED | Not executed; implementation/gates unfinished                            |
| EG guest hosted journey        | BLOCKED | Not executed; destination support unfinished                             |
| Bank reject/reupload           | PARTIAL | Local integration PASS; hosted pending                                   |
| WhatsApp hosted test           | BLOCKED | No Phase 7 accepted Preview                                              |
| Migrations                     | PARTIAL | Local reconstruction/upgrade; final official/hosted verification pending |
| Generated types                | PARTIAL | Official 39-migration artifact imported; updated-HEAD CI pending         |
| Regression                     | PARTIAL | Local intermediate results; final/hosted pending                         |
| CI                             | PARTIAL | Previous quality PASS; final HEAD pending                                |
| Protected Preview              | BLOCKED | Not deployed for Phase 7                                                 |
| Production runbook             | PARTIAL | Prepared; update final commands/configuration after completion           |
| Cleanup                        | PARTIAL | No hosted fixtures yet; final cleanup verification pending               |
| Scope compliance               | PASS    | No main/Production/Phase 8 actions                                       |

## AR. Current decision

**PHASE 7 PARTIAL — NOT READY**

This is an unfinished implementation checkpoint, not an owner-approval request. Continue the listed work without restarting the gap analysis or replacing accepted foundations. Do not merge or deploy Production.
