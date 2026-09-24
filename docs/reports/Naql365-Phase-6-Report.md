# Naql365 Phase 6 — Payments, Bank Transfer Verification & Finance Foundation

Implementation checkpoint; hosted acceptance is not yet complete. No Phase 6 merge or Production release is authorized or performed.

## A. Starting State

Phase 5 closed and merged; 27 accepted migrations. Existing protected Preview evidence belongs to Phase 5 and does not establish Phase 6 acceptance.

## B. Git Baseline

- Branch: `feature/phase-6-payments-bank-transfer-finance`.
- Accepted develop: `a42d9f1f676e63a7786d73aa70a6213f061be796`.
- Main: `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`.
- Both remote references were fetched and reconfirmed during implementation; neither changed.

## C. Finance/Payment Gap Analysis

`docs/phase-6-payments-finance-gap-analysis.md` was committed in `6fdd01de5b621118a3726cb53121f8559672d479` before migrations. Owner approval of both legacy execution and method-switch policies is recorded in `af76312`.

## D. Existing Schema Reuse

Extend payments, payment_transactions, invoices, file_objects, audit_logs and notifications. Add only missing bank_accounts, bank_transfer_attempts and private replay records. Reuse the Phase 3 physical dispatch transition and shared organization lock; no second operational state machine.

## E. Migrations

31 migrations total: 28 financial schema/clearance, 29 transactional commands, 30 private storage/projections, 31 privileged bank configuration/notifications. Populated 27-migration upgrade preserves commercial/operational rows, does not infer CASH or PAID, and applies clearance only to not-yet-started Trips.

## F. Commercial Flow

Accepted Quote still creates its single immutable Order. The acceptance UI now navigates to that Order's checkout. Payment commands derive expected amount, currency, customer and Market from the accepted Order.

## G. Preliminary vs Final Quote

Pricing and Sales approval commands remain unchanged. Hosted regression on the Phase 6 Preview remains required.

## H. Checkout

Localized `/[locale]/account/orders/[id]/payment`, with server-authorized projection, exact Order total, two supported methods and safe history. Customer cannot supply authoritative totals or bank account selection.

## I. Payment Model

One Payment per Order; method separate from status. Explicit commands with optimistic revision, current authorization before replay, immutable actor/mutation intent and database transaction. Minor-unit integer amounts; no gateway.

## J. Cash Workflow

CASH_DUE permits execution and does not claim receipt of money. Only authorized Finance confirmation of the exact accepted amount/currency produces PAID and a receipt.

## K. Bank Transfer Workflow

Eligible Market/currency primary account → private proof reservation/upload/submission → UNDER_REVIEW → authorized confirmation or reasoned rejection. Submission never means paid.

## L. Execution Clearance

The underlying initial `trips.started_at` transition enforces payment clearance under the same organization advisory lock as payment and operational commands. Preparation remains available. Legacy started Trips are not retroactively stranded.

## M. Bank Accounts

Privileged `finance.accounts.manage` command and localized configuration page; permission granted to SUPER_ADMIN, not automatically to Finance/Operations/Driver. No real bank details seeded or hardcoded. Single active primary account per organization/Market/currency, revisions and bounded audit evidence.

## N. Market/Currency Isolation

Relational Market/currency constraints and Order-derived payment facts. Account projection and reservation match the authoritative Order Market and currency. Hosted SA/SAR and EG/EGP verification remains pending.

## O. Transfer Proof

Application accepts PDF/JPEG/PNG up to 2 MiB. Images are decoded/re-encoded and metadata stripped. PDF screening is structural only, not malware scanning or sanitization; downloads use attachment disposition. Database bounds metadata and binds object paths to an authorized reservation.

## P. Private Storage

Existing private documents bucket, explicit TRANSFER_PROOF purpose, separate policies excluding generic files.read authority. Owner and Finance access only; short-lived signed download URLs, no overwrite. Hosted expiry/public-access tests remain pending.

## Q. Transfer Attempts

Numbered attempts retain submitted/rejected/confirmed history and bank instruction snapshots. Only incomplete uploads may be removed; submitted evidence cannot be deleted by clients. Interrupted removal can be resumed.

## R. Finance Review

Bounded 30-row queue, status filter, customer, Market, currency, exact amount, method, bank/proof submission facts and detail links. Finance notes are absent from customer projections.

## S. Cash Confirmation

`finance.verify`, exact integer amount/currency, timestamp/actor, unique receipt transaction, immutable receipt, replay-safe confirmation.

## T. Transfer Confirmation

Only the current submitted attempt may be confirmed. PAID, transaction, receipt and notification commit together. No client-controlled paid flag.

## U. Transfer Rejection/Reupload

Mandatory bounded customer-safe reason, separately protected Finance note. Rejected proof remains immutable; replacement creates a new numbered attempt.

## V. Trip Start Gate

Tested locally for missing method, pending transfer and cash. Driver/staff use the same database guard. Independent-connection confirm-vs-start and switch-vs-start passed in CI 35656720462. Hosted application assertions remain pending.

## W. Driver UX

Driver projection provides only execution clearance. Start button disabled while blocked, clear localized message and manual refresh. Server/database remains authoritative.

## X. Operations UX

Method/status clearance projection and blocked-start explanation; assignment/planning remain usable. No Finance verification authority added.

## Y. Finance UX

Localized review, private proof download, explicit full-amount confirmation, reasoned rejection and cash collection. Account configuration separately privileged.

## Z. Customer UX

Checkout, Market-specific instructions, bounded proof form, retry identity, incomplete upload cleanup, rejection/reupload and safe receipt view. Hosted mobile/AR/EN acceptance pending.

## AA. Payment Transactions

Reuse append-only transactions with bounded event codes, actor, accepted amount/currency and optional Finance reference/note. Unique confirmation prevents duplicate financial receipt.

## AB. Receipt/Invoice Foundation

Payment receipt copies immutable accepted commercial/tax facts. Operational proof of received money only; no Saudi/Egypt statutory electronic invoicing certification claimed.

## AC. Notifications

Reuse existing recipient-scoped notifications for submitted proof and financial outcomes. No proof URL, bank details or private reviewer note in notification payload. Notification delivery never authorizes execution.

## AD. RLS

Local negative checks cover customer/tenant/role isolation, raw mutation denial, proof access and suspended membership. Full hosted negative matrix remains required.

## AE. Security

Same-origin mutations, authenticated SSR clients, strict input schemas, no service credentials in application/browser, bounded upload, private storage and no raw database error logging. Bounded hosted logs/bundle/header/cookie review remains pending.

## AF. Audit

Finance changes generate explicit transaction and bounded audit evidence. Generic transaction audit copying is replaced to avoid placing private Finance notes in generic audit JSON.

## AG. Concurrency

`scripts/test-payment-concurrency.mjs` uses separate PostgreSQL connections for duplicate proof submission, duplicate cash confirmation, confirm-vs-reject, confirm-vs-dispatch and method-switch-vs-dispatch. All five financial race groups passed in exact-HEAD Foundation CI 35656720462, alongside the existing Operations/Driver/Tracking concurrency suites.

## AH. SA Cash Journey

Not yet executed on a Phase 6 Preview.

## AI. SA Transfer Journey

Not yet executed on a Phase 6 Preview.

## AJ. EG Cash Journey

Not yet executed on a Phase 6 Preview.

## AK. EG Transfer Journey

Not yet executed on a Phase 6 Preview.

## AL. Rejection/Reupload Journey

Database integration passes; real hosted application/storage journey pending.

## AM. Accessibility

Authenticated bank administration AR/EN axe checks passed. Mobile journey checks exposed overflowing Finance status navigation. DOM measurements identified the non-wrapping Finance navigation; filters now wrap with 44px touch targets and current-filter semantics. Horizontal overflow checks remain mandatory. Checkout proof selection before hydration lost the React file-change event; input is now disabled until hydration and the hosted test waits for it to become usable. All affected journeys must pass on a rebuilt Preview before acceptance.

## AN. AR/EN

Centralized dictionaries and locale routing implemented. Hosted RTL/LTR verification pending.

## AO. Tests

Local checkpoint: 31 test files / 151 tests PASS, strict typecheck PASS using official types, 24 local browser checks PASS from the implementation checkpoint. Current hydration correction is under repeat build/CI/hosted verification.

## AP. CI

Official type generation [35618884338](https://github.com/Rmdn96/Naql365/actions/runs/35618884338) PASS for schema checkpoint `fca8ad6f99b5da78dfea100c604279c3df1aeb65`. Types imported verbatim from its artifact. Foundation CI [35618884336](https://github.com/Rmdn96/Naql365/actions/runs/35618884336): quality PASS, fresh migrations/SQL PASS, operational concurrency assertions PASS but cleanup failed with FK 23503 because new Payment rows precede Order deletion. Cleanup order corrected. Subsequent exact-HEAD Foundation CI [35656720462](https://github.com/Rmdn96/Naql365/actions/runs/35656720462) PASS for b3dd3f440df134032013cd25ec42208b0057aa26: both quality/build and Supabase migrations/RLS jobs succeeded, including independent-connection concurrency and generated-type comparison. The earlier failed run is not counted as PASS.

## AQ. Hosted Preview

Protected genuine Preview: https://naql365-staging-oa4z7ev7w-naql365.vercel.app, READY for source b3dd3f440df134032013cd25ec42208b0057aa26. Vercel target is Preview (API target null), project/source checked independently. Staging upgraded from 27 to 31 repository migrations on 2026-09-22; hosted SQL assertions and official generated-type comparison PASS, 59/59 public tables have RLS. Auth uses four exact Preview callbacks without wildcards. Hosted browser acceptance is in progress; deployment alone is not acceptance. Zero Production deployments and zero Production-scoped variables verified.

## AR. Regression

Operational SQL regression fixtures explicitly choose CASH through payment_command when the Phase 6 schema exists. Older upgrade fixtures remain paymentless. Local Phase 0–5 suite passes; hosted regression must use the accepted Phase 6 Preview.

## AS. Cleanup

First hosted acceptance attempt completed with failures in browser assertions and mobile layout; scoped synthetic fixture cleanup PASS. A diagnostic rerun is in progress. Independent cleanup audit after failed runs found zero rows in 28 business/Auth/Storage/replay groups and retained SA/EG configuration. Final cleanup and automation credential removal remain required. Local SQL fixtures rollback; CI concurrency cleanup PASS.

## AT. Files Changed

Migrations 28–31, payment domain/infrastructure/API and UI, customer acceptance redirect, Driver/Operations clearance, notification codes, official database types, regression fixtures, upgrade/unit/integration/concurrency tests, CI and this report. Final exact list will be taken from accepted baseline diff.

## AU. Commits

- `6fdd01de5b621118a3726cb53121f8559672d479`: gap analysis before migration.
- `af76312`: approved owner policies.
- `fca8ad6f99b5da78dfea100c604279c3df1aeb65`: financial schema/authority and initial tests.
- Further implementation/checkpoint commits are not final acceptance commits.

## AV. Known Limitations

Docker Desktop is unavailable locally; official Supabase CLI reconstruction/type generation uses the existing isolated GitHub workflow. Hosted database evidence is available; hosted browser acceptance remains in progress. PDF scanning not implemented; no compliance certification. This is a work-in-progress report, not a release approval.

## AW. Deferred Items

Gateway/provider credentials, partial payments, refunds, settlements, statutory e-invoicing integration, Production and Phase 7.

## AX. Acceptance Matrix

| Gate                                 | Result  | Evidence                                                                               |
| ------------------------------------ | ------- | -------------------------------------------------------------------------------------- |
| Git baseline                         | PASS    | Remote develop/main verified against accepted SHAs                                     |
| Gap analysis                         | PASS    | Committed before migrations; both policies approved                                    |
| Existing schema reuse                | PASS    | Extended original entities and authoritative dispatch                                  |
| Preliminary pricing                  | PARTIAL | Local regression; hosted pending                                                       |
| Sales final Quote                    | PARTIAL | Local regression; hosted pending                                                       |
| Quote acceptance                     | PARTIAL | Checkout routing implemented; hosted pending                                           |
| Checkout                             | PARTIAL | Implemented, build/typecheck pass                                                      |
| CASH method                          | PARTIAL | Database integration passes; hosted pending                                            |
| BANK_TRANSFER method                 | PARTIAL | Database integration passes; hosted pending                                            |
| Cash remains unpaid until collection | PARTIAL | Database integration passes                                                            |
| Cash execution allowed               | PARTIAL | Database guard tested; hosted pending                                                  |
| Bank account configuration           | PARTIAL | Privileged command/UI; hosted pending                                                  |
| SA/SAR bank isolation                | PARTIAL | Relational constraint; hosted pending                                                  |
| EG/EGP bank isolation                | PARTIAL | Relational constraint; hosted pending                                                  |
| Transfer proof                       | PARTIAL | Reservation/submission tested; hosted upload pending                                   |
| Private Storage                      | PARTIAL | Database policies; hosted expiry/denial pending                                        |
| Proof ≠ Paid                         | PARTIAL | Integration passes                                                                     |
| Operational planning while pending   | PARTIAL | Engine unchanged; hosted pending                                                       |
| Start Trip payment gate              | PARTIAL | Local guard passes; hosted/races pending                                               |
| Driver blocked state                 | PARTIAL | UI/server projection implemented                                                       |
| Finance queue                        | PARTIAL | Bounded projection/UI implemented                                                      |
| Finance confirmation                 | PARTIAL | Authorized transaction integration passes                                              |
| Automatic execution unlock           | PARTIAL | Clearance integration passes                                                           |
| Transfer rejection                   | PARTIAL | Required reason integration passes                                                     |
| Reupload/history                     | PARTIAL | Integration passes                                                                     |
| Cash confirmation                    | PARTIAL | Integration passes                                                                     |
| Payment transactions                 | PARTIAL | Immutable/idempotent integration passes                                                |
| Invoice/receipt foundation           | PARTIAL | Snapshot/uniqueness integration passes                                                 |
| Customer isolation                   | PARTIAL | Local negatives; hosted pending                                                        |
| Tenant isolation                     | PARTIAL | Local negatives; hosted pending                                                        |
| Market isolation                     | PARTIAL | Constraints; expanded tests pending                                                    |
| RLS                                  | PARTIAL | Local tests and initial official SQL pass                                              |
| Audit                                | PARTIAL | Bounded events implemented                                                             |
| Notifications                        | PARTIAL | Existing infrastructure extended                                                       |
| Concurrency                          | PASS    | Exact-HEAD CI 35656720462; all independent-connection financial and prior-phase suites |
| SA Cash hosted journey               | BLOCKED | Await complete local/CI gates                                                          |
| SA Transfer hosted journey           | BLOCKED | Await complete local/CI gates                                                          |
| EG Cash hosted journey               | BLOCKED | Await complete local/CI gates                                                          |
| EG Transfer hosted journey           | BLOCKED | Await complete local/CI gates                                                          |
| Rejection/reupload journey           | PARTIAL | Hosted pending                                                                         |
| AR/EN                                | PARTIAL | Dictionaries implemented                                                               |
| Mobile                               | PARTIAL | Hosted acceptance pending                                                              |
| Accessibility                        | PARTIAL | Hosted authenticated axe pending                                                       |
| Migrations                           | PASS    | CI fresh reconstruction, populated27 upgrade, actual Staging27→31 and hosted SQL PASS  |
| Generated types                      | PASS    | CI strict diff and hosted official CLI public schema comparison PASS                   |
| Regression                           | PARTIAL | 146 local tests pass; hosted pending                                                   |
| CI                                   | PASS    | 35656720462 PASS for b3dd3f4; final feature HEAD rerun still required                  |
| Hosted Preview                       | BLOCKED | Not deployed before successful gates                                                   |
| Cleanup                              | PARTIAL | No hosted fixtures; remote fixture rerun pending                                       |
| Scope compliance                     | PASS    | No merge/main/Production/Phase7 changes                                                |

## 2026-09-24 continuation evidence

- Exact source `48a256e0d7f1e51b3ada11c778f136bfc51896f4` passed [CI 35984453892](https://github.com/Rmdn96/Naql365/actions/runs/35984453892), including both required jobs.
- Rebuilt genuine protected Preview: https://naql365-staging-3b7p0k7jf-naql365.vercel.app, deployment `dpl_2UpkAmdGA1R5Uy8J3kA7HYTtPHPz`, READY, independently verified Preview classification and source. Four exact Staging Auth callbacks configured.
- Final-run bank administration passed, but all four financial journeys stopped in predecessor request/pricing/acceptance steps. These runs do not establish payment acceptance. Two isolated diagnostics also failed; fixture cleanup passed after each run.
- Safe diagnostics observed one pricing HTTP 400, then a successful pricing response on a later run followed by a visible enabled Quote acceptance button whose click produced no response command or error state. Controls could accept interaction before React hydration. A shared hydration guard now disables affected inputs/actions until their handlers are available. The hosted acceptance helper explicitly delays Next.js scripts and requires the SSR acceptance button to remain disabled before releasing scripts.
- This correction still requires its own CI and rebuilt-Preview acceptance. No failed run is counted as PASS. Existing earlier hosted successes remain historical evidence only.
- Bounded review of 200 serverless records plus error/5xx queries found zero 5xx, zero error records and no credential/auth-query patterns; this is a bounded sample, not an exhaustive log guarantee.
- Secret-pattern scan passed for 309 tracked files; production dependency audit reported zero known vulnerabilities. Remote develop/main and required protections remained unchanged. Vercel Production deployments and Production-scoped variables remained zero.

- Hydration correction passed 151 local tests, 24 desktop/mobile tests, build/lint/types/format and [CI 35988173482](https://github.com/Rmdn96/Naql365/actions/runs/35988173482) for `a506177015deda7083b6be5f455f1a42b27b6cf7`. Preview https://naql365-staging-9jjqolytt-naql365.vercel.app is genuine Preview/READY for that SHA.
- The new delayed-script test initially unregistered its interception before pending requests completed. An isolated protected-page reproduction demonstrated 302/307 script responses and “already handled” route errors with that sequence. Keeping interception active until hydration completed produced twelve HTTP 200 script responses and zero route errors. The harness was corrected without changing deployment protection; its affected financial run is not accepted as PASS.

- [CI 35990016957](https://github.com/Rmdn96/Naql365/actions/runs/35990016957) passed for `cb9a03d73c5129f18c02669f4510dd8247817282`. A subsequent hosted run failed during synthetic identity provisioning; cleanup succeeded. Provisioning now reports only bounded Auth status/code and a distinct membership stage.
- The next run passed SA CASH end-to-end, including delayed-script Quote acceptance. SA BANK_TRANSFER reached authorized Finance confirmation but Driver Start did not send an execution command before hydration; the scenario failed and is not accepted. Driver execution feedback now shares the hydration guard. The delayed-script assertion is reused for the newly unlocked Driver Start action. This additional correction requires rebuilt Preview and complete hosted acceptance.
- Full dependency audit (production and development) reported zero known vulnerabilities on 2026-09-24.

## AY. Final Decision

PHASE 6 PARTIAL — NOT READY

Continue with complete CI/concurrency, broadened Finance/Market/security tests, protected Staging migration/Preview, four hosted journeys and Phase 0–5 regression, private Storage and log review, scoped cleanup, then exact-head final checks. Do not merge or deploy Production.
