# Naql365 Lovable UI V2 — Wave 4 Staff Experience

Current decision: **IN PROGRESS — design and acceptance pending**.

Accepted baseline: `e38fd0b99000e6cd49a6cae650e9ce563f9a3fb0`; prior application `f758f42868f97984999a5673d2f5ed0ca5d13b89`. Branch: `feature/lovable-ui-experience-v2`. All 47 migrations remain immutable. No merge or Production authorization.

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

Pending: finish all required local/CI and protected hosted role/visual gates, record exact application/delivery identities, and independently verify scoped cleanup.

## Deterministic visual acceptance plan

`scripts/staging/wave4-staff-matrix.mjs` retains all 67 accepted Stage 3 state definitions, but never reuses their screenshots as evidence of the redesigned rendering. The Wave 4 index requires **590 combinations**: every state in AR/EN at 360 and 1440; 23 representative route/role/state families additionally at 390/768/1280 and Dark/System at the two extremes, with System exercised against both OS preferences. Every selected combination checks direction, overflow, clipping, overlapping actions, labels, focus and safe content. Axe smoke runs at the extremes; this is not WCAG certification. SA/EG business/Market coverage is recorded separately from theme/viewport presentation coverage.

The dedicated resumable runner uses only the canonical UI V2 origin, normal password sessions, effective permission readback, existing authoritative commands, ledger-owned tenant fixtures and baseline-preserving cleanup. Controlled loading/error/busy presentation is explicitly distinguished from real hosted lifecycle facts. Hashes, exact application SHA, state/role/locale/viewport/theme/OS preference and capture timestamp are indexed atomically; missing/corrupt/duplicate/wrong-identity evidence fails closed.

## Historical attempts (not acceptance passes)

- Initial Lovable generation spent an extended interval at its review checkpoint without a committed diff. A stop request did not yield a confirmed stopped response. The original request subsequently completed at the lab SHA above; no second prompt was accepted and no fabricated failure/pass was assigned to the intermediate checkpoint. Chrome extension connectivity was interrupted and recovered; connector metadata/diff supplied the completed design identity.
- The first new shell test used `.test.tsx`, outside this repository's unit discovery pattern; it was renamed to `.test.ts` before counting. Its first discovered execution exposed a test-only attribute-order assumption, corrected to check link attributes without assuming their serialization order. All three shell assertions then passed.
- A full unit/integration run overlapped local build/lint and exceeded existing 30-second limits in four database reconstruction/hook cases (deployment attestation upgrade, operational isolation, market fixture isolation, transfer attempts). Result: 319 passed / 4 timed out. No timeout/assertion was relaxed; an isolated rerun is required before PASS.

## Acceptance boundary

Local implementation gates: isolated **323/323 unit/integration PASS** across 64 files (accepted 318 + 3 staff-shell contracts + 2 evidence contracts), **56/56 Playwright E2E PASS**, production build PASS, strict TypeScript PASS, ESLint PASS, formatting PASS, tracked/history heuristic secret scans PASS. The five focused shell/evidence contracts were rerun after final harness metadata checks. PostgreSQL/RLS/official generated types, restricted-role browser regression and all six independent-connection concurrency suites are required in exact-head Foundation CI; no local Docker result is claimed. Hosted acceptance is still pending and local success is not substituted for it.

Required before final closeout: full unit/integration and E2E, SQL/RLS/official types, independent concurrency, restricted-role navigation/commands, hosted staff business journeys, AR/EN RTL/LTR SA/EG Light/Dark/System responsive evidence at 360/390/768/1280/1440, keyboard/focus/axe smoke, fixture ledger and independent cleanup, tracked/history scans, exact-head delivery CI. Existing Customer/Guest acceptance is retained unless affected source requires fresh verification. Automated accessibility smoke is not WCAG certification.

No new backend query, projection, RPC, schema/migration, Auth implementation, payment/pricing/lifecycle behavior, global KPI infrastructure, Commerce, Hostinger, DNS or Phase 8 work is authorized.
