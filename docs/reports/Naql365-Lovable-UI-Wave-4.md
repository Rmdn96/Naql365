# Naql365 Lovable UI V2 — Wave 4 Staff Experience

Current technical decision: **PASS — Wave 4 implementation and hosted acceptance complete**. Release handoff requires both exact-head delivery CI jobs PASS; that immutable delivery SHA/run pair is supplied in the owner handoff. No merge is authorized.

Accepted baseline: `e38fd0b99000e6cd49a6cae650e9ce563f9a3fb0`; prior application `f758f42868f97984999a5673d2f5ed0ca5d13b89`. Branch: `feature/lovable-ui-experience-v2`. All 47 migrations remain immutable. No merge or Production authorization.

Authoritative application SHA: `8e340a537a8f469324e13e5f050077881489d0de`. Tested protected Preview deployment: `dpl_EksrbbFReHv56ohBHW9ae2v5xnB3`; canonical origin: https://naql365-staging-ui-v2-naql365.vercel.app. Exact application CI: [38808837693](https://github.com/Rmdn96/Naql365/actions/runs/38808837693), both jobs PASS. Local and CI regression: 323 unit/integration, 60 E2E; SQL/RLS, official types, six independent-connection concurrency suites and 12 restricted-role/locale browser scenarios PASS. Final visual matrix 590/590; supplemental Market/theme smoke 60/60; hosted business 10/10; retained session acceptance 6/6.

Application identity is distinct from the final documentation/evidence delivery commit. The commit containing this report changes only test/evidence/docs after the application SHA above; resolve its exact SHA from Git history and the owner handoff. Its required CI must pass independently; the application CI is not presented as CI for a later evidence commit.

## Existing accepted implementation reviewed

Stage 3 final report and its 670 detailed captures plus 60 historical shell captures establish the accepted staff authority/workflows. Wave 4 changes their presentation, not their security or commercial behavior.

| Existing surface          | Existing safe source                                                      | Wave 4 presentation scope                                                                        |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Staff layout/navigation   | `staffModules()` and single canonical authorized organization             | Reuse the exact filtered links; compact sidebar, drawer, topbar, theme control and context       |
| Dashboard                 | Existing bounded Sales/Operations/Finance loaders; only permitted modules | Dense displayed work queues; no global totals/new queries                                        |
| Requests / Quotes         | Existing Sales queue/details, manual pricing and quote commands           | Separate request facts, verified distance, commercial entry, final actions and immutable history |
| Operations / Jobs / Trips | Existing workspace/detail/issues/progress/command loaders                 | Compact planning, resource/assignment, Stop/event/issue/POD sections; no availability metrics    |
| Finance / proof review    | Existing queue/payment details and Finance authority                      | Clear cash/proof/review/rejected/confirmed/clearance hierarchy; private proof remains on demand  |
| Bank settings             | Existing `finance.accounts.manage` guard                                  | Privileged configuration only; never shell/dashboard destinations                                |
| Support                   | Migration 47's bounded read-only projection                               | Safe localized contact/route/status rows and pagination; no pricing/Finance/guest-link mutations |

CUSTOMER and DRIVER remain outside the staff shell. SALES, OPERATIONS/DISPATCHER, FINANCE and CUSTOMER_SERVICE navigation continues to derive from effective permissions in the selected single organization, not role labels/email. Existing destination and command authorization remains mandatory.

## Design Lab workflow

Existing project: Naql365 Design Lab (`45d7c85b-e937-48ee-8d57-251cc16a57b8`), workspace-only, unpublished. Starting lab commit: `cbe4112a4c1457b83a02179bdae11d6a2476bf82`. Connector reads work; message write is denied because `projects:write` is absent. The existing authenticated browser UI accepted the owner-approved Wave 4 visual request. No credentials/backend integration/publishing were supplied or authorized.

Completed lab commit: `dd9399162de0f1c5e42a56ef24e09e128bce0067`. The generated 14-file diff was inspected. Accepted visual ideas: compact stable navy sidebar, restrained control radii, semantic themed work surfaces, bounded queues, compact filter/table hierarchy, separated detail panels, clear payment-proof versus confirmation presentation, accessible drawer/focus and localized copy.

Rejected from the canonical port: `staff-concept.ts` role presets, `demoModules`/editable/clearance predicates, role and grant selectors, generated LAB rows, state selectors, acknowledgement-only mock commands, TanStack route/runtime, independent localStorage theme wiring, package/lockfile or lab instruction changes. Incidental customer-concept type-safety edits in the lab were not ported. No backend integration or privileged data was sent to Lovable.

Canonical implementation reuses the existing permission-filtered server link list and existing ThemeControl/cookie. The portal layout reads that same presentation preference; it introduces no backend query. The new `staff-v2.css` is scoped to `.staff-app`, covers Dashboard/Sales/Operations/Finance/Support/detail/error/loading surfaces, and leaves Customer/Driver outside the staff shell. Existing loaders, commands, authorization and business state predicates are untouched.

The earlier pending implementation/acceptance checkpoint is superseded by the final results below.

## Deterministic visual acceptance plan

`scripts/staging/wave4-staff-matrix.mjs` retains all 67 accepted Stage 3 state definitions, but never reuses their screenshots as evidence of the redesigned rendering. The Wave 4 index requires **590 combinations**: every state in AR/EN at 360 and 1440; 23 representative route/role/state families additionally at 390/768/1280 and Dark/System at the two extremes, with System exercised against both OS preferences. Every selected combination checks direction, overflow, clipping, overlapping actions, labels, focus and safe content. Axe smoke runs at the extremes; this is not WCAG certification. SA/EG business/Market coverage is recorded separately from theme/viewport presentation coverage.

The dedicated resumable runner uses only the canonical UI V2 origin, normal password sessions, effective permission readback, existing authoritative commands, ledger-owned tenant fixtures and baseline-preserving cleanup. Controlled loading/error/busy presentation is explicitly distinguished from real hosted lifecycle facts. Hashes, exact application SHA, state/role/locale/viewport/theme/OS preference and capture timestamp are indexed atomically; missing/corrupt/duplicate/wrong-identity evidence fails closed.

## Historical attempts (not acceptance passes)

- Initial application candidate `19b5cf1b537b28759668986e464476171047a31a` passed Foundation CI `38760060254` (both jobs), and its canonical protected Preview was READY (`dpl_2fDaNRmd2M5jtieugE1GwustUS3c`). The first Sales/Support visual batch recorded 119 automated capture checks. Manual inspection then identified dashboard-only card stretch and cramped long references next to status badges. These captures remain historical, not final Wave 4 visual acceptance. The operator closed only the ledger-owned Playwright browser; the runner caught the interruption at `sales-history-en-360-system-dark`, preserved its failure checkpoint, and completed scoped cleanup. Independent readback confirmed zero run-owned Auth/profiles/memberships/roles/Customers/Requests/Quotes/Orders/Jobs/Trips/banks/files/Storage and unchanged non-owned baseline. See `dashboard-finding-19b5cf1.json`, the historical `lovable-wave4-staff/index.json`, and its `cleanup-1792078271179.json`.
- The repair is limited to dashboard grid alignment and stacked reference/status rows; no application authority or data source changed. A new application identity, full regression/CI and fresh final visual matrix are required. Final evidence uses `docs/reports/evidence/lovable-wave4-staff-final/`; no historical screenshot is silently retagged to the repaired SHA. A test-only stop sentinel was added for orderly future interruption and fixture cleanup.

- Initial Lovable generation spent an extended interval at its review checkpoint without a committed diff. A stop request did not yield a confirmed stopped response. The original request subsequently completed at the lab SHA above; no second prompt was accepted and no fabricated failure/pass was assigned to the intermediate checkpoint. Chrome extension connectivity was interrupted and recovered; connector metadata/diff supplied the completed design identity.
- The first new shell test used `.test.tsx`, outside this repository's unit discovery pattern; it was renamed to `.test.ts` before counting. Its first discovered execution exposed a test-only attribute-order assumption, corrected to check link attributes without assuming their serialization order. All three shell assertions then passed.
- A full unit/integration run overlapped local build/lint and exceeded existing 30-second limits in four database reconstruction/hook cases (deployment attestation upgrade, operational isolation, market fixture isolation, transfer attempts). Result: 319 passed / 4 timed out. No timeout/assertion was relaxed; an isolated rerun is required before PASS.

## Historical implementation acceptance checkpoint

Local implementation gates: isolated **323/323 unit/integration PASS** across 64 files (accepted 318 + 3 staff-shell contracts + 2 evidence contracts), **60/60 Playwright E2E PASS** (56 existing + four native-date theme regressions), production build PASS, strict TypeScript PASS, ESLint PASS, formatting PASS, tracked/history heuristic secret scans PASS. The five focused shell/evidence contracts were rerun after final harness metadata checks. PostgreSQL/RLS/official generated types, restricted-role browser regression and all six independent-connection concurrency suites are required in exact-head Foundation CI; no local Docker result is claimed. Hosted acceptance is still pending and local success is not substituted for it.

Required before final closeout: full unit/integration and E2E, SQL/RLS/official types, independent concurrency, restricted-role navigation/commands, hosted staff business journeys, AR/EN RTL/LTR SA/EG Light/Dark/System responsive evidence at 360/390/768/1280/1440, keyboard/focus/axe smoke, fixture ledger and independent cleanup, tracked/history scans, exact-head delivery CI. Existing Customer/Guest acceptance is retained unless affected source requires fresh verification. Automated accessibility smoke is not WCAG certification.

No new backend query, projection, RPC, schema/migration, Auth implementation, payment/pricing/lifecycle behavior, global KPI infrastructure, Commerce, Hostinger, DNS or Phase 8 work is authorized.

### Native date control remediation checkpoint

Manual review of application `140165f475e6e66e7f30b0e3cef41939ecf3be18` found black native calendar controls on dark datetime fields. A new browser regression reproduced computed color-scheme `normal` instead of `dark` against the old build. The repair is eight scoped CSS lines for explicit Dark and System/dark OS; date values, validation and scheduling commands are unchanged. Four locale/device regression cases cover all theme/OS combinations.

The 332 hash-valid captures from that candidate are preserved in `evidence/lovable-wave4-staff-140165f/index.json`, with 258 missing and the original failed Operations checkpoint intact. They are historical and will not be retagged to the repaired application. Independent cleanup was verified before archiving. The Operations assignment-success English attempt failed its HTTP success assertion after the Arabic scenario had assigned the same mutable Trip. The harness now prepares a separate forward-only English assignment Trip and resources; no command/state-machine behavior is changed. The historical response code was not retained, so its exact value is not asserted retrospectively.

Current repaired application candidate: `8e340a537a8f469324e13e5f050077881489d0de`; protected canonical Preview READY as `dpl_EksrbbFReHv56ohBHW9ae2v5xnB3`. Both CI jobs for run `38808837693` are pending until exact-head results are recorded. Local 323 unit/integration, 60 E2E, strict types, lint, build, changed-file formatting and tracked/history secret scans passed. Migration subtree matches accepted Wave 3 byte-for-byte (`20ae191f7838e46c61a1ff3d92dd058483aad6ff`); backend/domain/API/Auth/Supabase source diff is empty.

### Repaired-candidate acceptance checkpoints

Application `8e340a537a8f469324e13e5f050077881489d0de`: exact-head Foundation CI `38808837693` passed both jobs. Sales/Support/shell batch completed **242/242** indexed captures. Navigation readback in AR/EN: SUPER_ADMIN Quotes/Operations/Finance/Banks/Support; SALES Quotes only; OPERATIONS and DISPATCHER Operations only; FINANCE Finance only (no accounts.manage); CUSTOMER_SERVICE Support only. This uses each principal’s canonical same-organization grants. Independent cleanup for run `1792099243460` confirmed zero owned Auth/profiles/memberships/roles/Customers/Requests/Quotes/Orders/Jobs/Trips/banks/files/Storage and unchanged non-owned baseline. No completed batch is substituted for remaining Operations/Finance/state acceptance.

Operations/Dispatcher batch on repaired application: **118/118 PASS**, cumulative **360/590**. Separate locale-specific forward-only assignment fixtures passed real AR/EN HTTP success and ASSIGNED-state readback. Dark native date control was visually re-inspected and is legible. Run `1792100024280` independently cleaned to zero for all owned identities/business/files/Storage; seven disposed synthetic passwords were explicitly retried and denied (`invalid_credentials`, no session). No new operator credential was provisioned. See final matrix cleanup proof and representative manual-review index.

Finance/bank batch completed **142/142 PASS**, cumulative **502/590**. Restricted FINANCE navigation excludes bank settings; privileged configuration captures use SUPER_ADMIN with finance.accounts.manage. Proof pending/rejected/resubmitted/confirmed, clearance, validation/error/retry/busy and synthetic bank success states passed. Independent run `1792100673963` cleanup confirmed zero owned records/Storage and unchanged non-owned baseline; seven disposed credentials were retried and denied.

## Final visual matrix result

Repaired application `8e340a537a8f469324e13e5f050077881489d0de`: **590/590 PASS, zero missing, zero failed final entries**, independently reloaded and SHA-256 verified. Batch totals: Sales/Support/shell 242; Operations/Dispatch 118; Finance/banks 142; loading 54; empty 34. Locale totals: AR 295, EN 295. Theme totals: Light 406, Dark 92, System 92 (both OS preferences). All five required widths are represented. This is a documented risk-based state matrix, not a full Cartesian expansion of every Market/theme/width.

Supplemental shell Market/theme smoke: **60/60 PASS** across five authorized staff permission sets, AR/EN, SA/EG and Light/Dark/System; 12 safe SUPER_ADMIN representative captures are indexed separately with hashes in `evidence/lovable-wave4-staff-final/market-theme-smoke.json`. Each verifies canonical-origin Market POST 200, refresh persistence, theme, direction and overflow. Business currency/Market correctness is a separate hosted journey gate.

Every final visual batch independently cleaned all owned Auth/profile/membership/role/Customer/Request/Quote/Order/Job/Trip/bank/file/Storage state to zero and preserved the non-owned configuration/grants fingerprint. Four batches explicitly retried all seven deleted fixture passwords and received invalid_credentials/no session. The earlier Sales batch predates that added probe; deletion was independently proved, without claiming a probe that did not run. No new privileged operator credential was provisioned; owner CLI authentication is preserved.

Session acceptance: retained **6/6 PASS** for CUSTOMER/SUPER_ADMIN/DRIVER in AR/EN from application `140165f475e6e66e7f30b0e3cef41939ecf3be18`, with independent cleanup and Secure/Lax/Path=/ host-scoped cookie checks. The only subsequent application delta is native date-control CSS inside the staff shell, which does not affect authentication/session code; these records are retained at their original SHA, never retagged. Fresh canonical password logins also passed for all six staff personas during the final matrix.

Evidence entry points: `evidence/lovable-wave4-staff-final/index.json` (590 states); `evidence/lovable-wave4-review/final-matrix-summary.json` (counts/disposal); `evidence/lovable-wave4-review/final-manual-review.json` (representative human inspection); five independent `cleanup-*.json` files in the final matrix directory. Automated axe/focus/geometry checks are smoke coverage, not WCAG or exhaustive assistive-technology certification.

## Canonical source and deferred boundaries

Only four application files changed from accepted Wave 3: `src/components/shell/staff-shell.tsx`, `src/app/[locale]/(portal)/portal/layout.tsx`, `src/app/[locale]/layout.tsx`, `src/styles/staff-v2.css`. Tests/harness/evidence are separate. No Auth actions/callbacks, API/domain/infrastructure/Supabase source, generated types, package manifest or lockfile changed. All 47 migrations remain byte-identical to the accepted baseline; migration 47 remains the approved narrow read-only support projection. No migration 48.

Global KPI/exception aggregation, availability metrics, additional backend projections and any unimplemented module remain deferred. Driver and Customer/Guest redesign is outside Wave 4; their authority and accepted behavior are preserved. No merge, main/Production/DNS/Hostinger/Commerce/Wave 5/Phase 8 work was performed. Runtime dependency audit has zero findings; the same five high development-only ESLint-chain findings remain under the existing scoped owner acceptance, without suppression or dependency changes.

## Hosted business closeout

**10/10 PASS**, exit 0 on the exact application SHA: SA/EG Guest Request-to-delivery, Guest Quote rejection without an Order, SA/EG registered Customer manual Quote/CASH, AR/EN public responsive/accessibility/Market, Guest replay/capability isolation and AR/EN normal SUPER_ADMIN session/logout/history denial. See `evidence/lovable-wave4-review/hosted-business.json`. SafeReporter emitted intermediate failed-step lines during successful asynchronous polling; these are preserved in the safe output excerpt and are not represented as final failed tests. No assertion or timeout was weakened.

The accepted scoped business helper removed its owned Storage objects and business records, preserving catalogues. Independent readback confirmed all 16 owned Auth identities, profiles, memberships, roles, Customers, bank fixtures, file records and isolated organizations at zero, and Guest policy restored exactly. See `hosted-business-cleanup.json`. Five visual batches have separate independent zero-state/Storage proofs. Owner accounts were not changed.

## Delivery verification

Application source remains the exact SHA above; subsequent changes are harness/evidence/docs only. Required final checks: relevant five shell/evidence contracts, harness ESLint, formatting, strict types, tracked/history heuristic secret scans, evidence/hash/completeness validation and both Foundation CI jobs on the final delivery HEAD. The delivery SHA and final CI run are recorded together in the owner handoff to avoid a self-referential documentation hash. Official Preview remains the same protected canonical alias; an automatic evidence-commit rebuild is source-equivalent and must not be misreported as a new application-changing SHA.

Historical 119-capture and 332-capture attempts, their final failed/interrupted checkpoints and independent cleanup remain archived separately. The native-date regression against the old build produced one failed case and three interrupted cases under max-failures=1; the corrected build passed all four and the complete 60 E2E suite. JSON formatting preserves every record/decision/timestamp/hash semantically (`evidence-format-integrity.json`); screenshot bytes were not changed. The original 60 Stage 3 captures remain hash-valid historical evidence, and the accepted 670-capture Stage 3 report/evidence is untouched.
