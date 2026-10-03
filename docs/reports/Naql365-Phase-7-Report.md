# Naql365 Phase 7 — MVP launch, guest ordering and visual experience

Canonical acceptance report, updated 3 October 2026. **REOPENED by owner-observed public login and post-login routing defects on 3 October 2026. Previous PASS is superseded pending real public signup and role-aware hosted acceptance. Dependency security closeout: PASS — scoped owner risk acceptance. No merge or Production release is authorized.** This revision replaces earlier implementation checkpoints and retains material failed-run evidence below.

## A. Starting state

Phase 6 was protected-merged, with 31 migrations. Work continued without restarting the completed gap analysis or rebuilding accepted domains.

## B. Git baseline

Branch: `feature/phase-7-mvp-launch-guest-brand`. Develop remains `24f1a4c6a3b8027a6ce89aaf72c8c3bb5fd6fbd9`; main remains `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`. Both are protected. Required independent approval, stale-review dismissal, both required CI jobs and enforced admin protection remain unchanged; force pushes are disabled. Nothing has been merged in this phase.

## C. MVP gap analysis

`docs/phase-7-mvp-launch-gap-analysis.md` was committed as `435fcb4` before any migration. The smallest safe extension is a scoped guest capability around existing Customer/Request/Quote/Order/Payment/Tracking authority, rather than a parallel guest engine.

## D. Guest architecture

GUEST Customers have no Auth identity/profile/membership/role. One private grant binds organization, Customer and Request journey. Shared server/database commands authorize that context independently of registered RBAC. Guest services use an isolated publishable-key client; no service-role key or fabricated Auth user is used by the application.

## E. Guest security token

Secrets contain 32 cryptographically random bytes, with canonical versioned encoding. Only SHA-256 verifiers are stored. Expiry is configurable within 1–90 days, revocation is permanent, and privileged replacement revokes the old grant transactionally. Continuation links use fragments, cleared before API access, then Secure/HttpOnly/SameSite=Strict host-only cookies on HTTPS. References and UUIDs are not credentials. Staff inspection does not disclose raw secrets; ephemeral copy is available only after authorized replacement. Grant-first locking serializes mutations against revocation/rotation.

## F. Guest Request

The existing eight-step wizard, validation, autosave, private attachments and submission transaction are reused without registration. Creation uses a browser-generated 256-bit replay capability; duplicate submissions return the same journey and cannot resurrect revoked/expired access. In-memory retry state does not survive closing the page. The customer receives the existing N365 reference and a private continuation-link copy action.

## G. Guest Quote

The safe preliminary projection uses authoritative pricing after staff verifies the required road distance; Quick Quote does not invent an instant routing price. This preserves the approved MANUAL_VERIFIED distance authority. Sent final versions, expiry, customer-safe amounts/tax/currency and accept/reject use existing commands. No internal adjustment reason or pricing administration is disclosed.

## H. Guest Order

Existing transactional/idempotent acceptance creates exactly one Order per accepted Quote Version. Commercial facts come from the immutable accepted snapshot. Guest rejection creates no Order.

## I. Guest payment

CASH and BANK_TRANSFER reuse Phase 6 authority. Guests cannot mark CASH paid or verify a transfer. EG transfer configuration extends the existing privileged account model with Vodafone Cash/InstaPay destinations; Market/currency relationships and proof snapshots are enforced. Destination changes freeze after proof submission. Only synthetic TEST configuration is used on Staging. Instructions are returned only during authorized transfer checkout. Copy IBAN remains supported; no owner financial values were added to configuration, fixtures or documentation.

## J. Guest tracking

The same safe own-Order projection follows preparation, Trip/Stop progression and POD/completion. Guest tracking is status-only; precise coordinates, Driver identity, private issues, assignment history and Finance notes remain excluded. Refresh obtains authoritative state rather than a separate tracking truth.

## K. Registered customer regression

Registered adapters continue using accepted SSR Auth and authorization. Full hosted foundation/intake/commercial/Operations/Driver/tracking/Finance regression is currently running serially on the candidate below. It is not yet PASS.

## L. WhatsApp SA/EG

One intentionally public Market contact configuration supplies each country's display/destination. Selected country determines the single floating contact action. Messages contain generic text or a bounded safe reference, never a capability, proof URL, payment destination or location. Hosted country-switch and reference-message checks PASS.

## M. Market selector

Country and locale are independent. AR/EN each support SA/EG. Catalogue IDs, service/city availability, Request initialization and payment context remain Market-authoritative. Exchanging a journey link restores its Market selection.

## N. Brand system

Deep Navy, Electric Blue, Cyan and soft backgrounds form one restrained product identity. Alexandria/Inter use Next font loading. Product-route illustrations are explicitly illustrative, with no invented customer data or stock-truck dependency.

## O. Homepage

Header, Hero, active services, How It Works, safe tracking demonstration, business CTA, concrete benefits, FAQ and final CTA are implemented. Request is primary; Sign In is secondary. Real payment instructions are absent from public content.

## P. Mobile UX

Hosted guest Request, Quote, checkout and tracking are checked at 360/390/768/1440 pixels. Public AR/EN checks cover the same widths. Mobile and desktop public screenshots were inspected for layout/cohesion; no horizontal overflow was observed. Private screenshots, traces and video are disabled.

## Q. Design tokens

Shared typography, semantic controls, borders, shadows and restrained card radii preserve accessible focus and contrast. Wizard progress nodes, confirmation pickup/delivery and authoritative tracking Trip statuses reuse the route identity; they do not invent completed milestones.

## R. Quick Quote

Active service and covered pickup/delivery city IDs enter the shared wizard. Preselection is validated against the chosen Market, applied only to a pristine draft and never overwrites an existing draft. Additional detail and verified distance are still needed for authoritative pricing.

## S. Public navigation

Localized Services/How It Works/Track/Contact, country/language selection and Request CTA simplify navigation. Tracking explains use of the private link; reference-only lookup is not introduced. Unapproved legal routes are unpublished and not linked.

## T. Feature flags

`LAUNCH_CUSTOMER_LIVE_TRACKING` is server-only, default false, and controls the registered live-view presentation without changing RLS. It is enabled only in this regression Preview's build/runtime to exercise accepted Phase 5 behavior. Guest live-map access is deliberately excluded. Advanced internal engines were retained.

## U. SEO

Hosted public metadata, canonical/hreflang, structured information, crawler policy and sitemap checks PASS. Non-production indexing is blocked; secure guest/account/payment/portal surfaces are excluded. Legal technical routes return genuine HTTP 404 until owner-approved AR/EN content exists, without public placeholder copy.

## V. Analytics

Finite event/country/context inputs update private daily aggregate counters, with 90-day retention and an ingestion budget. No token, URL, PII, financial destination, proof or location field exists. Funnel and WhatsApp instrumentation are implemented. These approximate counters are not an accounting or unique-customer source of truth.

## W. RLS/security

All 59 public tables have RLS. Guest capability policies scope one organization/Customer/Request-derived journey and private files; ordinary RBAC and Finance/Operations permissions remain authoritative. Hosted own/other-journey denial, malformed/random/reference/UUID denial, staff-command denial and Finance mutation denial PASS in Phase 7. Final repeated database verification passed on 1 October; registered regression on the corrected Preview passed.

## X. Abuse protection

Privileged guest creation defaults off in migrations. Staging is intentionally enabled at 30-day expiry / 30 creations per hour; acceptance temporarily raises the quota and restores it. Database budgets cover creation, capability mutation (60/minute), upload (60/hour), exchange (300/minute per organization) and aggregate analytics (600/minute). Body/file/count limits and safe image processing are retained. This is not per-IP protection or CAPTCHA; organization-wide limits can affect legitimate availability during abuse. Creation replay and real independent-connection race checks pass CI.

## Y. Performance

Server-rendered public/catalogue and authoritative secure pages avoid a parallel client fetching engine. No new animation library, video Hero or eager guest map is added. Current optimized build passes; the local run compiled in 11.9 seconds. A bounded union of 16 JavaScript assets discovered across five public/login/guest-entry pages was 1,029,161 decoded bytes, not a single-page initial-load measure. No field Core Web Vitals claim is made.

## Z. Accessibility

Hosted public and guest secure surfaces pass axe checks at four viewport widths, with AR RTL / EN LTR, labeled controls, visible focus, semantic landmarks and keyboard checks. This is automated smoke coverage plus visual review, not full WCAG certification.

## AA. SA guest journey

On the current Preview: anonymous Arabic SA Request → Sales-verified preliminary/final Quote → accept → exactly one SAR Order → CASH_DUE → internal Driver/Stop execution → final POD → completed Order PASS. No registration; immutable commercial facts remain unchanged.

## AB. EG guest journey

On the same Preview: anonymous English EG Request → Quote → accepted EGP Order → synthetic InstaPay transfer instructions → private proof → Finance rejection/reupload/confirmation → internal Driver/POD → completed Order PASS. No Saudi currency/timezone/resource assumption was substituted.

## AC. Payment rejection/reupload

Guest EG rejection, safe customer reason, replacement proof, Finance confirmation and private signed proof expiry PASS. All five registered Finance scenarios passed, including SA/EG CASH and BANK_TRANSFER; no financial rule was weakened.

## AD. WhatsApp acceptance

SA/EG switch, correct destination, safe reference-aware text and absence of guest token PASS. Public pages do not expose payment instructions.

## AE. Regression

The same protected, security-patched Preview passed all 36 hosted tests across seven serial suites: Operations/Markets 3, guest MVP 6, registered Finance 5, Foundation/Auth/Storage 12, registered Intake 6, Pricing/Quote 1, and Driver/live tracking/notifications 3. Every suite recorded scoped cleanup PASS. Both SA and EG completed their guest and internal-Driver journeys. Local regression passed 176 unit/integration tests across 40 files and 32 desktop/mobile E2E tests. The 3 October supplemental Foundation run refreshes bounded runtime-log evidence after the original run's logs aged out; all 12 tests and cleanup passed. Sanitized results, durations, database checks, asset/log review and cleanup are committed in [Naql365-Phase-7-Evidence.json](Naql365-Phase-7-Evidence.json).

## AF. Migrations

**44 total: 31 accepted + 13 additive Phase 7 migrations.** Accepted migration files are unchanged. Fresh reconstruction, populated 31-migration upgrade preserving identities and commercial snapshots, official generated types, SQL/RLS and independent-connection concurrency PASS in CI. Staging was upgraded without a reset; exact ledger/schema assertions and generated schema types matched. No seed business data or manual schema workaround was introduced.

## AG. Tests and material failed runs

Formatting, lint, strict types, unit/integration, build, local E2E and tracked/history secret-pattern scans PASS. The complete dependency audit discovered lint-only brace-expansion advisories. Compatible patches 1.1.18 → 1.1.21 and 5.0.9 → 5.0.12 were applied in the lockfile; no top-level dependency changed. Those fixes produced a clean audit on 1 October. The 3 October full audit instead reports five high development-only findings through the single unpatched braces advisory below; production-only audit remains clean. The Next.js runtime was separately patched to 16.3.6, and the final Preview matches that runtime dependency graph. Advisory: https://github.com/advisories/GHSA-q2hr-2g5m-vwhr. CI executes real independent-connection Operations/Driver/tracking/payment/guest harnesses. Guest races cover creation replay, acceptance/exactly-one Order, acceptance vs revocation, rotation, mutation vs revocation and proof retries.

Earlier hosted Phase 7 run had 2 PASS / 4 FAIL: unhydrated first-click controls and a localized-title expectation were corrected, then all six tests passed. A later registered SA transfer test timed out at replacement upload: setInputFiles populated a disabled SSR input before its handler existed, so no upload POST was made and the button remained disabled. The replacement test now waits for the real interactive control, as its initial uploads already did; application authorization/payment behavior was not relaxed. The failed run cleaned up and stopped the sequence. The rerun passed all five Finance scenarios. Operations then exposed a real planner hydration defect: the first scheduled-start edit was lost before handlers were ready while the scheduled-end edit persisted. The planner now disables its fieldset until hydration, with a hosted delayed-script regression. SA Operations failed and EG passed in that run; fixture cleanup passed. The final security-patched Preview passed both delayed-script Operations journeys and all 36 hosted tests. Failures are not relabeled PASS.

## AH. CI

Deployed application source `2d39d1d9031b2aeb9614310f54c1cc3fafcf052a`: [36838210557](https://github.com/Rmdn96/Naql365/actions/runs/36838210557) PASS. Documentation/Auth checkpoint `bc8752bb61e9a124c335ec0f5d968a9c4115ad97`: [36876207982](https://github.com/Rmdn96/Naql365/actions/runs/36876207982) PASS. Both required jobs include fresh migrations, official types, SQL/RLS, independent-connection concurrency and application checks. Final delivery commit/run is reported with the handoff after verification; documentation and exact Auth-origin changes do not change deployed application code. npm's full dependency audit is reported separately and is NOT claimed green.

## AI. Protected Preview

[Verified Preview](https://naql365-staging-9s73vfobh-naql365.vercel.app): `dpl_7ANrTtkuqboUSJ3YNnxYWBuH2c7o`, independently verified READY / Preview, source `2d39d1d9031b2aeb9614310f54c1cc3fafcf052a`. Includes the Next.js 16.3.6 security patch, the planner hydration fix and scoped SQL test setup. Full sequential acceptance completed on 1 October with 36 PASS. Supabase Auth has four exact localized callbacks for this origin and no wildcards. Supabase remains the allowlisted independent Staging project. Five HTML pages and 16 discovered assets (1,029,161 decoded bytes) showed no scanned credential pattern; sibling source-map probes returned none, nonce CSP/security headers are present, and unauthorized Vercel access returns 302. This is a bounded scan, not an exhaustive security certification. A 3 October supplemental Auth/Storage run provided fresh logs: bounded 50-record serverless sample had no 5xx, error records, credential patterns or sensitive Auth query values; separate error and 5xx queries were empty. Original full-run logs were no longer returned, so this is explicitly a supplemental bounded review, not an exhaustive full-run log audit.

## AJ. Production launch runbook

`docs/production-launch-runbook.md` documents guarded resources/migrations/Auth, Market/coverage/pricing/tax, privileged private transfer configuration, staff/Driver provisioning, Storage/domain/environment, smoke and rollback. Actual owner financial values are excluded. Privacy/Terms technical structure requires approved legal content before publication.

## AK. Remaining Production blockers

Explicit release authorization; protected reviewed release commit; final domain/DNS; separate Production resources/secrets; approved coverage/services/pricing/taxes; privileged real private payment configuration; legal content; authorized staff/Driver provisioning and operational smoke/rollback sign-off. Application acceptance does not authorize any of these actions.

## AL. Cleanup

All seven full-run suites recorded scoped cleanup PASS. Independent 3 October comparison found zero owned fixture Auth identities, zero Storage objects and no divergence from pre-existing records after accounting for two separately removed orphan browser fixture identities. Orders, Quotes, payments, proofs, operational resources, POD, tracking samples/sessions and notifications are empty. One pre-existing account, two Customers/Requests and one guest grant were preserved; they were not attributed to this test run. Existing-account session counts are excluded from equality checks because sessions may refresh. SA/EG catalogues remain active. The 12-test supplemental run also cleaned up. One positively identified temporary Vercel automation credential was revoked; zero remain, the old credential returns 302, and Preview protection remains enabled. The earlier interrupted Finance run was recovered using its exact 16 fixture identities and isolated organization, not a global delete. No Production data was modified.

## AM. Files changed

The complete changed-file list is available from `git diff --name-only 24f1a4c6a3b8027a6ce89aaf72c8c3bb5fd6fbd9...HEAD`. Areas: thirteen additive migrations and SQL assertions; official DB types; guest capability/session/routes/adapters; shared Request/Quote/payment/tracking presentation; public catalogue/contact/brand/copy/fonts/styles; bounded aggregate analytics; launch/legal flags/content structure; local/hosted/concurrency tests; Staging configuration and documentation. Review the full feature diff for the authoritative filename list. No accepted migration, main or Production data changed.

## AN. Commits

Gap analysis `435fcb4`; scoped capability/shared engines and isolated adapters across logical commits; retry/exchange budgets and private transfer destinations; public catalogue/telemetry/legal foundation; hydration correction `42c3078`; hosted viewport/cookie/copy checks `ab7b3da`; shared route motif `c3fd275`; registered replacement-proof test guard and exact Preview Auth configuration `0a7f6d0`. Security patch `2d39d1d`, scoped SQL fixtures `e249377`, final Preview Auth `968072b`, and acceptance checkpoint `bc8752b` preserve the reviewable history. Final delivery SHA/run is supplied with the handoff; no giant replacement commit or force push is used.

### Newly indexed Next.js security advisory - 2026-10-01

The fresh npm audit reported critical GHSA-vcvr-r3jv-pc5j against Next.js 16.3.4 (the advisory database was updated on 30 September). The maintainer scopes exposure to attacker-controlled SVG passed into Node.js next/og ImageResponse; repository inspection found no ImageResponse/next/og use. Nevertheless, commit `2d39d1d` pins Next.js and matching eslint-config-next to the documented fixed patch 16.3.6. React, TypeScript, domain code and migrations remain unchanged. The 1 October lockfile audit reported zero vulnerabilities after the patch; the newer 3 October development-only advisory is recorded separately below. Patch CI [36838210557](https://github.com/Rmdn96/Naql365/actions/runs/36838210557), local formatting/secrets/lint/types/176 tests/build/32 E2E all passed. The new protected Preview is READY; all 36 hosted tests passed on the patched Preview; the 16.3.4 candidate's successful evidence is historical, not final. Reference: https://github.com/advisories/GHSA-vcvr-r3jv-pc5j.

### Hosted SQL fixture isolation correction ? 2026-10-01

The populated Staging rerun exposed two legacy test setup assumptions: Foundation counted all profiles/memberships and copied all business rows, while Phase 2 assigned roles across all memberships. Commit `e249377` scopes only privileged fixture setup and enrollment assertions to each test's synthetic identities/organizations. RLS assertions remain unfiltered and unchanged. No migration, application policy or existing Staging record was changed. All five rollback SQL suites passed against the populated project; 176 local tests passed. The 2026-10-01 hosted follow-up verified all 44 migration versions, all five SQL suites, RLS on all 59 public tables, official generated public-schema types, positive/revoked/expired capability handling and replay denial. Capability probe cleanup passed. Hosted Preview acceptance passed all 36 tests.

## AO. Known limitations

Manual verified road distance remains necessary before pricing. No automated link delivery, identity claiming, routing provider or payment reconciliation exists. Link possession confers scoped access until expiry/revocation; reissue requires trusted staff verification outside the application. Browser creation retries are memory-only. Organization-wide abuse budgets have an availability tradeoff. Guest tracking is status-only. Telemetry is approximate. Automated accessibility and bounded asset/log inspection are not certification/exhaustive audits. Final legal/Production configuration remains owner-controlled.

## AP. Deferred items

No refund/cancellation engine, gateway/cards/mada/Apple Pay, wallet API, automated WhatsApp/SMS, account claiming by contact text, route optimization, background GPS, native app, accounting GL/statutory invoicing, marketplace, international SA↔EG freight, AI, Production or Phase 8.

## AQ. Acceptance matrix

PASS is limited to executed evidence. Hosted/runtime gates passed; the unpatched development dependency finding remains PARTIAL and prevents final acceptance.

| Gate                           | Result | Evidence                                                                                   |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------ |
| Git baseline                   | PASS   | Remote refs and unchanged protected develop/main                                           |
| Gap analysis                   | PASS   | 435fcb4 before migrations                                                                  |
| Guest request                  | PASS   | Both hosted anonymous journeys                                                             |
| Guest token security           | PASS   | Hosted isolation/rotation/revocation; 2026-10-01 expiry/replay probe and cleanup; CI races |
| Reference ≠ authorization      | PASS   | Hosted malformed/reference/UUID denial                                                     |
| Guest preliminary quote        | PASS   | Shared server-authoritative projection after verified distance                             |
| Guest final Quote              | PASS   | Hosted SA/EG Sales review and sent snapshot                                                |
| Guest accept/reject            | PASS   | Hosted acceptance/rejection; CI independent races                                          |
| Guest Order                    | PASS   | Exactly one Order, immutable commercial facts                                              |
| Guest CASH                     | PASS   | SA due state through completion; no guest confirmation                                     |
| Guest BANK_TRANSFER            | PASS   | EG TEST InstaPay checkout/Finance verification                                             |
| Guest proof privacy            | PASS   | Private proof, unauthorized denial, signed expiry                                          |
| Guest tracking                 | PASS   | Safe progression and completed Order                                                       |
| Customer isolation             | PASS   | Hosted scoped capabilities/negative commands; CI RLS                                       |
| Registered customer regression | PASS   | 36-test full hosted run, including registered Intake/Finance/Auth                          |
| SA WhatsApp                    | PASS   | Hosted selected Market destination                                                         |
| EG WhatsApp                    | PASS   | Hosted selected Market destination                                                         |
| Market switching               | PASS   | AR/EN public and guest country context                                                     |
| Homepage redesign              | PASS   | Hosted public screenshots/DOM review                                                       |
| Hero                           | PASS   | Primary Request CTA and illustrative product route                                         |
| Quick Quote                    | PASS   | Valid catalogue preselection into shared Request                                           |
| Services                       | PASS   | Selected Market active catalogue                                                           |
| How It Works                   | PASS   | Four localized customer-facing steps                                                       |
| Tracking preview               | PASS   | Explicit illustration, no real customer data                                               |
| Route visual motif             | PASS   | Public motif, wizard nodes, confirmation/tracking                                          |
| Mobile UX                      | PASS   | Secure/public 360/390/768/1440 axe/overflow checks                                         |
| AR/EN                          | PASS   | SA Arabic / EG English and both public locales                                             |
| RTL/LTR                        | PASS   | Hosted direction/layout checks                                                             |
| SEO                            | PASS   | Hosted metadata/canonical/hreflang/crawlers/noindex                                        |
| Analytics privacy              | PASS   | Finite private aggregates, negative payload tests                                          |
| Abuse protection               | PASS   | Server/database limits and CI retry/race negatives                                         |
| RLS                            | PASS   | 2026-10-01 populated Staging: five SQL suites; all 59 public tables RLS-enabled            |
| Security negatives             | PASS   | Hosted guest/registered/Driver negatives, capability expiry/revocation and private Storage |
| Performance                    | PASS   | Build and bounded asset review; no field CWV claim                                         |
| Accessibility                  | PASS   | Hosted public/guest axe, responsive and keyboard smoke                                     |
| SA guest hosted journey        | PASS   | Current Preview through Driver/POD/completion                                              |
| EG guest hosted journey        | PASS   | Current Preview through transfer/Driver/POD/completion                                     |
| Bank reject/reupload           | PASS   | Guest EG; registered regression is separate                                                |
| WhatsApp hosted test           | PASS   | Country switch/reference safety                                                            |
| Migrations                     | PASS   | 44; fresh/upgrade/ledger; accepted 31 unchanged                                            |
| Generated types                | PASS   | Official CI exact file and hosted schema match                                             |
| Regression                     | PASS   | 176 local tests, 32 local E2E, 36 full hosted tests on one Preview                         |
| CI                             | PASS   | Both required jobs PASS for deployed source and documentation checkpoint                   |
| Protected Preview              | PASS   | READY genuine Preview, Staging-only, access protection                                     |
| Production runbook             | PASS   | Safe privileged procedure/placeholders, release blockers                                   |
| Cleanup                        | PASS   | Every runner cleanup PASS; independent owned-fixture comparison; final bypass evidence     |
| Scope compliance               | PASS   | No merge, main/Production/Phase 8 action                                                   |

### Development dependency review — owner-approved scoped risk

On 3 October, `npm audit --audit-level=low` exited 1 with five high findings arising from one dependency chain: eslint-config-next 16.3.6 -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces 3.0.3. `npm audit --omit=dev --audit-level=low` exited 0 with zero findings. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), updated 2 October, lists no patched version. The issue is stack exhaustion from deeply nested patterns; this project's dependency is development tooling, not a runtime input path. No exploitability claim beyond that inventory is made. npm proposes a breaking downgrade to eslint-config-next 14.2.35; that is not applied. No audit suppression, framework downgrade or unreviewed fork is introduced. The owner subsequently explicitly accepted this advisory only for the development-only chain. Audit remains unsuppressed; no downgrade or fork is permitted. Revisit immediately when a supported upstream patch becomes available. This acceptance does not cover other vulnerabilities.

| Gate                         | Result                              | Evidence                                                                               |
| ---------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| Dependency security closeout | PASS — scoped owner risk acceptance | Advisory remains unresolved technically; full audit still exits 1; runtime audit clean |

## AR. Final decision

**Historical checkpoint: PHASE 7 PARTIAL — NOT READY (superseded by final admin closeout below).**

Previous application and hosted acceptance remain historical evidence. The registered onboarding defect is now fixed and its required regressions pass. Final PASS is withheld solely for the requested administrative provisioning, blocked by existing immutable customer identity and membership rules. The dependency advisory has explicit scoped owner risk acceptance. Production configuration/legal/release blockers remain separate. Do not merge, deploy Production, modify main or start Phase 8.

## Registered onboarding follow-up — verified fix; provisioning blocked

Reproduced on the accepted protected Preview with a fresh unconfirmed synthetic signup, actual Supabase activation link, password login and profile save. HTTP 200 with same-page redirect; authoritative profile, customer and active membership persisted after refresh. No success message appeared; request-country remained blank and Start Request disabled. The country selector is request-scoped, not part of profile mutation. Fix provides explicit success/validation/error feedback and country-selection guidance without changing auth/RLS. The final hosted and regression evidence below certifies the application fix.

The owner-nominated Staging account was uniquely matched by normalized email and confirmed. It already has a CUSTOMER membership and one Request. Existing membership-category integrity prevents simultaneous staff authority. No deletion, role bypass or provisioning has occurred; owner disposition of its customer relationship is pending.

Further inspection found `private.validate_person_membership` also forbids changing Customer identity/profile relationships (migration 20260926000100). The initially proposed detachment is therefore NOT executed and is withdrawn. An existing Request must not be deleted or this trigger bypassed merely to provision staff authority. Owner decision on a separate admin identity or a separately designed identity migration is required. The nominated account remains unchanged.

Hosted validation reproduction on the fixed-feedback Preview found an additional defect: after returning a validation error the uncontrolled form resets name and phone to empty defaults. Both then become HTML-invalid, preventing a second submit. Safe browser evidence recorded namePreserved=false, nameEmpty=true, phoneValueEmpty=true and two invalid fields. Re-entering both fields produced HTTP 200, visible success and persisted database state. Controlled profile inputs now retain corrections; revised desktop/mobile tests assert this before retrying. Verification of that final fix passed in both hosted desktop Arabic and mobile English journeys.

## Follow-up acceptance — 3 October 2026

- Fix commits: dc6cd69 (visible success, explicit validation and request-country guidance); 3a5227feaf6f034660ccfc6c9bf82657cb1a38c9 (preserve controlled fields after validation).
- Protected Preview: https://naql365-staging-4amvwuc0p-naql365.vercel.app ; deployment dpl_yCmDZL8GV4KKgUwdfXRfL8g8JkG9, genuine Preview READY from 3a5227feaf6f034660ccfc6c9bf82657cb1a38c9. Later changes only affect tests, exact Staging callback configuration and evidence/docs; application content unchanged.
- Exact application CI 37110849502 PASS; subsequent checkpoint CI 37112601947 PASS. Final documentation HEAD/CI are supplied in the handoff.
- Local: formatting, secrets, lint, strict types, 177 unit/integration, build and 32 E2E PASS.
- Hosted: 8 registered/onboarding + 6 guest + 5 Finance = 19 PASS on this Preview. Fresh synthetic unconfirmed accounts use generated Supabase activation links opened in the real browser, then password login; mailbox delivery is not claimed. Both locales/devices prove validation preserves values, successful save persists after refresh and country selection enters Request flow.
- First guest rerun failed a two-second signed URL initial read; HTTP status was not recorded. Diagnostic rerun succeeded (HTTP 200, 523/570ms), including expiry denial. No TTL/security relaxation. Failure is preserved rather than retrospectively labeled PASS.
- Database/RLS/official types PASS; 44 migrations unchanged. No SQL or RLS changes.
- Bounded runtime review: 50 records, zero error/5xx/credential markers; separate error/5xx queries empty. Five public pages/16 JS assets checked: security headers/CSP present, zero credential patterns or public sibling source maps. This is a bounded review, not exhaustive log certification.
- Each runner cleaned its fixtures. Independent audit found zero owned fixture identities including onboarding. A new Request belonging to the nominated existing account appeared during work; it was preserved. Three retained Requests are two owner-account drafts plus one pre-existing cancelled guest Request. The historic aggregate expected two, so the count difference is explicitly attributed and not deleted. No test requests/files/payments/resources remain.
- Temporary automation credential revoked; zero remain; revoked access returns 302. Preview protection retained. Production deployments/env scopes zero, main/develop and protection unchanged.

| Follow-up gate                     | Result                     | Evidence                                                                            |
| ---------------------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| Scoped braces risk disposition     | PASS — owner accepted risk | Development advisory only; no audit suppression or dependency workaround            |
| Registered onboarding              | PASS                       | 2 fresh activated desktop/mobile cases, persistence and request entry               |
| Registered regression              | PASS                       | 6 cases                                                                             |
| Guest regression                   | PASS                       | 6 final cases; initial failure documented                                           |
| Finance regression                 | PASS                       | 5 cases                                                                             |
| Local / database / CI              | PASS                       | Counts and run references above                                                     |
| Fixture and credential cleanup     | PASS                       | Owned fixtures zero, owner records preserved, bypass revoked                        |
| Nominated SUPER_ADMIN provisioning | BLOCKED                    | CUSTOMER identity with retained Requests is immutable; no bypass/deletion performed |

The nominated account is confirmed, has a profile and active CUSTOMER membership, and remains unchanged. SUPER_ADMIN assignment and its authorization smoke tests were NOT executed. A separate admin identity is compatible with the existing model; converting this exact identity requires a separately approved identity-migration design, not ad-hoc trigger bypass or deleting Requests. The earlier detachment proposal is withdrawn. No assumption of owner approval is made for either alternative.

Files changed in this follow-up: customer Server Actions; account page/shell; profile form; request-country guidance; AR/EN dictionary; intake fixture runner; new onboarding test; customer-auth unit tests; safe guest proof diagnostics; Staging Auth callback config; canonical report/evidence. No migration added.

**Historical checkpoint: PHASE 7 PARTIAL — NOT READY (superseded by final admin closeout below).**

No merge, main change, Production deployment or Phase 8 work. Stop for owner resolution of administrative identity provisioning.

## Final separate SUPER_ADMIN closeout — 3 October 2026

Owner approved a separate administrative identity, `abo.sabara0@gmail.com`. The owner created/confirmed it and entered the password interactively. No secret was collected, persisted or exported by this closeout. Exact Auth UUID was verified against normalized email and confirmation; profile existed, with no membership, role or Customer conflict. A trusted transactional operator provisioned one active staff membership in Naql365 Staging and one canonical SUPER_ADMIN user_role. Normal identity/role/audit triggers remained enabled. No email-based application authorization or direct permission grant was added.

SUPER_ADMIN inherits all 25 intended staff permissions. The two catalogue exclusions are account.access and driver.access, intentionally not staff authority. Authenticated database RLS-context checks returned those exact permissions, the one intended organization, SA/EG Markets, services and authorized audit visibility. No application source or migration changed.

Hosted read-only smoke used the owner’s actual authenticated browser session on the existing protected Preview. AR and EN staff portal, Sales/Quote review, Operations/Dispatch board, Driver/Vehicle controls and bank destination configuration rendered successfully. AR Finance queue rendered successfully. SA/EG options were available. The customer account route correctly denied the staff identity. No password, JWT, cookie, magic link or authorization header was extracted. Bounded runtime logs: 50 records, no error/5xx/credential markers; separate error and 5xx queries empty.

Scope limits: this is access/provisioning smoke, not a rerun of business mutations. The accepted repository has no standalone organization/staff-role administration screens or general Market/service/coverage editor; these are NOT claimed as tested UI. Their existing permission/catalogue/RLS authority was inspected. There is no eligible submitted guest Request after fixture cleanup, so no guest-link token was issued/rotated on real data; guest.links.manage is verified in the canonical authenticated permission checks, with existing Phase 7 guest-link acceptance retained. No extra admin UI or privileged mutation was invented during closeout.

The original `Abo.sabara@gmail.com` identity is unchanged: one ACCOUNT Customer, active CUSTOMER membership, CUSTOMER role only, and both existing Requests match the before snapshot including IDs/status/update timestamps. No detachment, deletion or staff permission was applied to it.

Final gates: 44 unchanged migrations; hosted database assertions/RLS/official generated types and capability expiry/revocation probes PASS, probe cleanup PASS. No temporary automation bypass remains (zero); owner’s intended Auth session/account remain. main/develop unchanged; no Production deployment/configuration or Phase 8 work. Application Preview source remains 3a5227feaf6f034660ccfc6c9bf82657cb1a38c9, byte-identical application to final documentation HEAD. Exact final SHA and CI are supplied in handoff.

| Final closeout gate                       | Result                              | Evidence                                                  |
| ----------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| Confirmed separate admin identity/profile | PASS                                | Owner signup and confirmation; exact Auth UUID checked    |
| Canonical staff/SUPER_ADMIN               | PASS                                | One active membership, one role, 25 intended permissions  |
| Implemented hosted admin access           | PASS                                | Actual owner session AR/EN pages; limits explicitly above |
| Customer preservation                     | PASS                                | Customer, membership, roles and two Requests unchanged    |
| Database/RLS/types                        | PASS                                | Hosted repeat; 44 migrations unchanged                    |
| Scoped dependency risk                    | PASS — scoped owner risk acceptance | GHSA-vfj7-8cjw-p6xm only; audit not suppressed            |
| Credentials/Production/scope              | PASS                                | Zero temporary bypasses; no Production or source changes  |

## Final decision (authoritative)

**PHASE 7 PASS — MVP READY FOR OWNER LAUNCH REVIEW**

This is readiness for owner release review, not Production authorization. The separate Production configuration/legal/release checklist remains applicable. Do not merge, modify main, deploy Production or start Phase 8.

## Reopened real-user authentication investigation — 3 October 2026

Current decision: **PHASE 7 PARTIAL — NOT READY**. Earlier PASS sections are historical and are superseded by this investigation.

Read-only Staging inspection confirms the designated administrator is email-confirmed, has a profile and an active staff membership with SUPER_ADMIN, and has no Customer identity. The existing customer remains confirmed with active CUSTOMER membership and a Customer identity. Neither account was changed.

Confirmed source defect: successful password login unconditionally redirects to the Customer account, and the confirmation callback defaults there too. The generic login error currently collapses provider, validation and runtime failures; its observed cause is not yet established.

Previous onboarding coverage created an unconfirmed identity through Auth admin generateLink rather than the public registration form. It then confirmed and completed profile onboarding. The administrative smoke reused an authenticated session and navigated directly to staff pages, so it did not test the post-password-login destination. These tests did not establish the complete real public signup or staff-login journey.

Local corrective checkpoint: role-aware completion now reads live membership/permission RPCs; existing destination authorization stays in place. Staff and mapped internal Drivers bypass Customer onboarding. New Customer onboarding still uses the existing confirmed-user transactional profile command; no migration or membership mutation has been made while public reproduction remains pending. Login distinguishes invalid credentials, unconfirmed email, backend failure and input validation. Registration no longer hides provider service failure as successful mail delivery. New-password length policy is no longer imposed on existing password login.

Validation: 187 unit/integration tests passed; 32 local desktop/mobile E2E passed; lint, TypeScript, formatting, secret scan and build passed. Targeted auth tests were rerun after the registration-error change (16 passed). These results do not substitute for hosted public registration. Owner selected a different fresh test mailbox, not yet supplied. Real public signup, actual failed-login cause, partial-state recovery and hosted role-routing acceptance remain pending. Production, main and develop are unchanged; 44 migrations retained.

### Owner-operated staff login evidence — 3 October 2026

Protected Preview `https://naql365-staging-q142gx9ok-naql365.vercel.app` runs `e533ea9f4cba58933d1875c3bea77389874fc7e5`, whose CI run `37135663161` passed both application and Supabase gates. The owner entered the existing administrator password privately and confirmed completion without manual portal navigation. Browser inspection verified `/ar/portal`; refresh retained access. Visiting English auth completion resolved to `/en/portal`, and Finance rendered successfully. English reused the session and is not claimed as a second password-login test.

The separate public signup attempt did not produce an Auth identity according to read-only inspection. Absence of confirmation mail therefore does not yet establish a mail-delivery-only fault. The owner chose to resume existing administrator testing. Public signup/confirmation/customer bootstrap acceptance remains pending; no admin-generated replacement identity is counted as that evidence. **PHASE 7 PARTIAL — NOT READY** remains authoritative.

### Reopened public navigation/session defect — 3 October 2026

Owner recording supersedes the sufficiency of the previous staff login smoke. Before modifying source, the existing owner session navigated from the protected portal to the public homepage; the server-owned auth-complete route then revalidated getUser, active membership and portal permission and returned to the portal without credentials. Direct login still rendered a form, followed by successful English server completion using the same session. This proves retained server authentication in the reproduced sequence, not session destruction. Browser tooling did not expose cookie metadata; no claim of direct inspection of the owner's cookie attributes is made. The full requested navigation/expiry/logout matrix remains pending.

Root causes: Header/Footer always rendered Login without consulting identity; login/page unconditionally returned the form. Proxy refreshed only a route subset, excluding public home and auth-complete. The layout already uses headers() for request-specific CSP, with private/no-store responses, so static shared HTML was not the cause. Changes reuse loginDestination for role-specific shared navigation and direct-login redirects; proxy refresh now covers all localized pages and retains existing Secure/SameSite/Path and provider cookie attributes. No privileged or email-derived authorization was introduced. Public navigation contains no signOut. Market switching writes only its own cookie. Driver authorization rejection previously signed out a valid non-driver identity; that automatic signOut was removed. Explicit logout and explicit password-reset global revocation remain.

Added unit coverage for per-request role links, anonymous links, recovery and authenticated login redirects. Added hosted registered-session coverage that inspects only cookie names/attributes, public routes, AR/EN, SA/EG, direct login, refresh and explicit logout; it is not yet executed or a substitute for real public signup. No migrations changed (44). Unit/integration rerun passed 197 tests; an earlier concurrent build/test run timed out one SQL test and is retained as failed-run evidence rather than suppressed. Build, TypeScript and lint passed. Hosted owner-equivalent navigation, cookie metadata, DRIVER/customer/guest/Finance regressions and public signup remain pending. **PHASE 7 PARTIAL — NOT READY**.

### Session investigation checkpoint

Preview `https://naql365-staging-jd6ncixk4-naql365.vercel.app` runs `556435d8fdf9499eb6552e3f21013452989c684d`; exact-source CI `37139015668` passed. Registered hosted suite: **10 passed**, including two desktop/mobile session-navigation tests covering AR/EN, public sections, Market changes, direct login, refresh, root/Secure/Lax auth cookie attributes and explicit logout cookie removal/protected denial. Fixture cleanup passed. Browser Back was followed by a protected navigation; this is not claimed as a complete no-stale-content Back-cache proof. Staging migration/RLS/types checks passed (44 migrations, 59 RLS tables).

Guest regression: two runs each passed four cases and failed two SA/EG journey cases in the shared login helper. The helper assumed an authenticated /login visit rendered a form; an initial logout correction also inspected URL before streaming redirect completion. It now waits for the visible login-or-logout state before explicitly switching identities. Full rerun remains required. Both fixture cleanups passed; Finance was not run because the sequential runner stopped on Guest failure. No failed result is suppressed.

A further code inspection found browser-client cookie defaults omit Secure while SSR sets it. Browser refresh now explicitly matches HTTPS Secure, Lax and root Path; targeted cookie/navigation tests (12) and build passed. This later hardening is not yet in the above Preview. No HttpOnly change was made: the existing browser Supabase client requires readable auth cookies. No token/cookie values were recorded. Owner-equivalent SUPER_ADMIN navigation on the new Preview, dedicated Driver navigation, final Guest/Finance rerun and genuine public Customer signup remain pending. **PHASE 7 PARTIAL — NOT READY**.
