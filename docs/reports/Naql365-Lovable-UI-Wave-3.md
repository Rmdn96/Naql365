# Naql365 Lovable UI V2 — Wave 3 Customer Experience

Current decision: **IN PROGRESS — hosted acceptance pending**.

Branch: `feature/lovable-ui-experience-v2`. Accepted baseline: `2e10349cd6ca84fb42f64a7187513c393b1ece49`; baseline application `04ac38b152a5a847b539d29fb4d9fa9befe4ce82`. No merge or Production authorization.

## Design Lab and integration review

Existing [Naql365 Design Lab](https://lovable.dev/projects/45d7c85b-e937-48ee-8d57-251cc16a57b8) generated Wave 3 customer concepts via its authenticated browser interface. The connector lacked `projects:write`; the authorized UI workflow was used instead. The project was unpublished, workspace-only in the owner's one-member workspace, with database disabled. No backend credentials were supplied or integration enabled. Export comparison against the accepted Wave 2 lab archive is recorded with file hashes in `evidence/lovable-wave3/generated-diff-review.json`.

Accepted concepts: compact customer navigation, next-action panel, bounded request rows, semantic surfaces, route facts, money/tax/expiry hierarchy, distinct payment methods/status, eight-step progress. Rejected: generated router/runtime, synthetic LAB records/amounts/tax calculations, preview state selectors and authorization predicates, independent localStorage theme implementation, package/lockfile/instruction changes. Canonical Next.js server actions, loaders, validation and existing theme cookie remain authoritative.

## Existing data and scope

| Surface                       | Existing safe source                                               | Presentation scope                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Customer dashboard            | `customerRequests`, `customerQuotes`, canonical enrollment/profile | Next action prioritizes an already-returned SENT Quote, otherwise latest returned Request or new Request; bounded recent list, secondary profile |
| Request wizard/detail/history | Existing request/page-access loaders, eight-step draft/commands    | Grouped fields, localized progress, save/error/review hierarchy; no validation or workflow changes                                               |
| Final Quote/decision          | `customerQuoteDetails`, existing accept/reject commands            | Route, final amount, tax, validity and response hierarchy; no commercial calculation or lifecycle changes                                        |
| Checkout                      | Existing `PaymentDetails` and payment commands                     | Cash/transfer separation, proof vs Finance review/confirmed distinction; same private proof access                                               |
| Tracking                      | `customerProgress`, existing authorized tracking                   | Recorded lifecycle/Stop facts only; no fabricated ETA/location/POD                                                                               |
| Guest                         | Existing capability/session/page-access authority                  | Same scoped shared presentation; no reference-only access or capability disclosure                                                               |

No global statistics, complete Order-history projection, new query/RPC, schema or backend is added. All 47 migrations must remain byte-identical to baseline. Existing application Auth/RBAC/RLS, Finance/manual pricing, Guest capabilities and lifecycle authority remain unchanged.

## Verification plan

- Full unit/integration, E2E, SQL/RLS/generated types and six independent concurrency suites; lint/types/format/build and tracked/history scans; exact-head CI.
- Existing 6/6 baseline role-session evidence retained. Customer shared presentation changes require additional hosted Customer regression; no Auth source change.
- Protected canonical Vercel Preview only: `https://naql365-staging-ui-v2-naql365.vercel.app`.
- Risk-based hosted matrix: AR/EN and SA/EG real Customer/Guest journeys; final Quote accept/reject, cash and transfer proof/rejection/retry/confirmation, tracking. Each representative surface verifies Light/Dark/System, RTL/LTR and widths 360/390/768/1280/1440 with overflow, labels, focus and axe smoke. Controlled loading/error evidence must be labelled, with no application bypass.
- Synthetic ledger-owned fixtures only; independent scoped cleanup and temporary credential material disposal. No owner records or catalogue activation changes.

## Historical verification checkpoints

- Initial new navigation unit assertions incorrectly assumed serialized HTML attribute ordering: two failures. Corrected to inspect the actual current-link element; the focused two tests pass. No application change was needed for that test defect.
- First local lint included an exported Lovable archive inside the checkout's ignored temporary folder. Generated lab runtime is not canonical source; the archive was moved to the adjacent review directory. It is not shipped, lint rules were not weakened.

Hosted results, exact application/evidence SHA and CI will be added after execution. Wave 3 is not yet ready for owner review.
