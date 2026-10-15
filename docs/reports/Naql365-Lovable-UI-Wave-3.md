# Naql365 Lovable UI V2 — Wave 3 Customer Experience

Current decision: **IN PROGRESS — hosted acceptance pending**.

Branch: `feature/lovable-ui-experience-v2`. Accepted baseline: `2e10349cd6ca84fb42f64a7187513c393b1ece49`; baseline application `04ac38b152a5a847b539d29fb4d9fa9befe4ce82`. No merge or Production authorization.

## Design Lab and integration review

Existing [Naql365 Design Lab](https://lovable.dev/projects/45d7c85b-e937-48ee-8d57-251cc16a57b8) generated Wave 3 customer concepts via its authenticated browser interface. The connector lacked `projects:write`; the authorized UI workflow was used instead. The project was unpublished, workspace-only in the owner's one-member workspace, with database disabled. No backend credentials were supplied or integration enabled. Export comparison against the accepted Wave 2 lab archive is recorded with file hashes in `evidence/lovable-wave3/generated-diff-review.json`.

Accepted concepts: compact customer navigation, next-action panel, bounded request rows, semantic surfaces, route facts, money/tax/expiry hierarchy, distinct payment methods/status, eight-step progress. Rejected: generated router/runtime, synthetic LAB records/amounts/tax calculations, preview state selectors and authorization predicates, independent localStorage theme implementation, package/lockfile/instruction changes. Canonical Next.js server actions, loaders, validation and existing theme cookie remain authoritative.

## Existing data and scope

| Surface                       | Existing safe source                                               | Presentation scope                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer dashboard            | `customerRequests`, `customerQuotes`, canonical enrollment/profile | Next action prioritizes an already-returned SENT or VIEWED Quote, otherwise latest returned Request or new Request; bounded recent list, secondary profile |
| Request wizard/detail/history | Existing request/page-access loaders, eight-step draft/commands    | Grouped fields, localized progress, save/error/review hierarchy; no validation or workflow changes                                                         |
| Final Quote/decision          | `customerQuoteDetails`, existing accept/reject commands            | Route, final amount, tax, validity and response hierarchy; no commercial calculation or lifecycle changes                                                  |
| Checkout                      | Existing `PaymentDetails` and payment commands                     | Cash/transfer separation, proof vs Finance review/confirmed distinction; same private proof access                                                         |
| Tracking                      | `customerProgress`, existing authorized tracking                   | Recorded lifecycle/Stop facts only; no fabricated ETA/location/POD                                                                                         |
| Guest                         | Existing capability/session/page-access authority                  | Same scoped shared presentation; no reference-only access or capability disclosure                                                                         |

No global statistics, complete Order-history projection, new query/RPC, schema or backend is added. All 47 migrations must remain byte-identical to baseline. Existing application Auth/RBAC/RLS, Finance/manual pricing, Guest capabilities and lifecycle authority remain unchanged.

## Canonical implementation and before/after

| Before                                                           | Wave 3 integration                                                                                                                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer actions spread between profile, lists and journey pages | Localized Overview / My requests / Quotes navigation and a next-action panel using already-returned facts; profile remains secondary                                                               |
| Shared legacy surfaces did not consistently follow Dark tokens   | One scoped Customer V2 stylesheet for account, forms, Request summary, final Quote, checkout and tracking; existing Light/Dark/System authority is reused                                          |
| Wizard navigation had weak visual grouping                       | Eight-step position, current/previous-step treatment, grouped fields and reachable sticky navigation; existing draft/save/submit logic is unchanged and position does not certify field completion |
| Checkout actions lacked a strong method hierarchy                | Distinct Cash/Transfer choices, decorative accessible icons and a customer-safe payment-state summary; proof submission remains separate from Finance confirmation                                 |
| Commercial and route facts competed visually                     | Bounded route cards, final-total/tax/validity hierarchy, readable history rows and responsive contained tables                                                                                     |

Application files changed from the accepted baseline:

- `src/components/ui/customer-workspace.tsx` — server-rendered localized navigation only.
- `src/components/requests/account.tsx` — next action, recent activity and secondary profile hierarchy; no new loader.
- `src/components/requests/wizard.tsx` — progress presentation only.
- `src/components/payments/checkout.tsx` — payment method/status presentation; existing commands remain untouched.
- `src/styles/customer-v2.css` — semantic theme surfaces, spacing, responsive forms/cards/tables, focus and action hierarchy.
- `src/app/[locale]/layout.tsx` — scoped stylesheet import.
- `src/app/[locale]/(account)/account/requests/page.tsx` and `quotes/page.tsx` — Customer navigation.
- `src/app/[locale]/guest/requests/[id]/page.tsx` — shared Customer presentation scope.

No Auth action/callback/cookie code, database types, dependency manifest/lockfile, environment manifest or backend/domain/infrastructure source changes are included. Final Quote decisions, eight-step validation, private proof handling and accepted snapshots keep their existing authority.

## Verification plan

- Full unit/integration, E2E, SQL/RLS/generated types and six independent concurrency suites; lint/types/format/build and tracked/history scans; exact-head CI.
- Existing 6/6 baseline role-session evidence retained. Customer shared presentation changes require additional hosted Customer regression; no Auth source change.
- Protected canonical Vercel Preview only: `https://naql365-staging-ui-v2-naql365.vercel.app`.
- Risk-based hosted matrix: AR/EN and SA/EG real Customer/Guest journeys; final Quote accept/reject, cash and transfer proof/rejection/retry/confirmation, tracking. Each representative surface verifies Light/Dark/System, RTL/LTR and widths 360/390/768/1280/1440 with overflow, labels, focus and axe smoke. Controlled loading/error evidence must be labelled, with no application bypass.
- Synthetic ledger-owned fixtures only; independent scoped cleanup and temporary credential material disposal. No owner records or catalogue activation changes.

## Historical verification checkpoints

- Initial new navigation unit assertions incorrectly assumed serialized HTML attribute ordering: two failures. Corrected to inspect the actual current-link element; the focused two tests pass. No application change was needed for that test defect.
- First local lint included an exported Lovable archive inside the checkout's ignored temporary folder. Generated lab runtime is not canonical source; the archive was moved to the adjacent review directory. It is not shipped, lint rules were not weakened.
- The first hosted invocation used an incorrect script argument layout and selected legacy visual tests as well as business journeys. A dedicated operator wrapper now requires the bounded `--stage3-business` selection. The initial validation capture also assumed that Next enforces per-step validation; it now exercises the existing final-submit validation without changing application validation.
- Hosted accessibility found two genuine Dark-theme contrast defects: the inherited light wizard save-status surface (`823382f…`, repaired in `f372738…`) and the inherited white commercial-summary surface (`f372738…`, repaired in `da3751c…`). Scoped semantic surface tokens repair these without changing commercial facts.
- The `da3751c…` run then stopped at Cash selection: generated CSS glyphs polluted the accessible button name. `452d540…` replaces those glyphs with explicitly decorative `aria-hidden` spans. Exact action-name assertions remain unchanged; focused AR/EN component tests cover the correction.
- The failed hosted runs, partial indexes and independent cleanup results are retained under `evidence/lovable-wave3/historical-*`. They are not final acceptance passes.
- A local full-suite run alongside hosted browser capture produced 312 passes and one 30-second timeout in the existing market-fixture isolation test. No assertion or timeout was weakened. Exact-head CI and a later isolated rerun determine its final disposition.
- The isolated market-fixture test subsequently passed with the five focused navigation, payment-name and matrix-definition tests (6/6). This supports a local concurrent-run timeout classification, not a demonstrated application regression.
- The first `452d540…` capture run passed both Guest delivery journeys and Quote rejection but stopped after 254 captures: Next's inline streaming replacement removed the real loading fallback even while external scripts were delayed. Independent cleanup passed for all 16 identities and owned relations. A test-only response interception now preserves the actual SSR fallback by suppressing replacement scripts; the untouched application response is restored before continuing. This is controlled presentation evidence, not a live prolonged-loading claim.
- Manual image inspection also found a full-page capture artifact: focusing a below-fold action scrolled the viewport and painted an offscreen fixed skip link into the image. The harness now resets scrolling before capture. The provisional images/index remain historical; final evidence uses a separate directory. No application change was made for either capture issue.

Hosted results, exact application/evidence SHA and CI will be added after execution. Wave 3 is not yet ready for owner review.

The `452d540…` candidate completed 353/353 capture/hash checks, 2/2 Customer business cases and the remaining 8/8 hosted cases in scoped batches; both cleanups passed. Its successful evidence remains historical for that application candidate. Final source review found an inherited dashboard presentation gap: opening a sent Quote changes it to VIEWED, but the pending-action filter included SENT only. The smallest UI filter correction now retains VIEWED as pending, matching the existing Quote decision component without changing decision authority. Five server-rendered component cases cover SENT/VIEWED versus ACCEPTED/REJECTED/EXPIRED. The final hosted matrix adds both Markets' pending-VIEWED dashboard state (371 required combinations) and will be rebuilt against the new application SHA rather than relabeling old captures.
