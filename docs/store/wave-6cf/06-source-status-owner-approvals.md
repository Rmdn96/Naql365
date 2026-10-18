# Exact Lovable source status, blockers and owner approvals

## Accepted source target and actual access result

Project `45d7c85b-e937-48ee-8d57-251cc16a57b8`; accepted revision `64f7e4dc9a355863ce3258f24e36851970dad8b9`. The user supplied the following verified source locations. Their **contents have not been read in this session**; a path supplied by the owner is not evidence of content inspection.

| Required exact-revision file                  | Read status / disposition                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/components/naql/store-preview.tsx`       | BLOCKED — not read, no accepted/rejected code claim                               |
| `src/components/naql/store-admin-preview.tsx` | BLOCKED — not read                                                                |
| `src/components/naql/store-primitives.tsx`    | BLOCKED — not read                                                                |
| `src/lib/naql/store-concept.ts`               | BLOCKED — not read; mock state/authorization/calculations not assumed safe        |
| `src/lib/naql/store-content.ts`               | BLOCKED — not read; prices/payment/stock/legal placeholders not assumed compliant |
| `src/lib/naql/store-admin-content.ts`         | BLOCKED — not read; private cost separation not assumed proven                    |
| `src/routes/store-preview.tsx`                | BLOCKED — not read; lab router never an approved canonical runtime                |
| `src/routes/store-admin-preview.tsx`          | BLOCKED — not read                                                                |
| `src/styles.css`                              | BLOCKED — not read; shared Wave 1–5 compatibility not assumed                     |

On 18 October 2026 no authorized Lovable project/file/diff tools were exposed; provider discovery still reported not installed/available only. Computer Use failed at native-pipe connection with OS error 2 before browser input. No local exact-revision Store source export was found in inspected repository design/report/Store docs. No undocumented API, credentials, browser session extraction, substitute design or regeneration used. The open Lovable URL/accepted revision does not prove file content or full diff.

**The accepted Wave 6C [UI port map](../wave-6c/06-lovable-port-map.md) remains byte-identical.** Only after authorized exact-source read may its path/symbol/disposition columns be updated. This new status document records the blockage instead of fabricating a completed review. Read all nine files plus complete parent diff and transitive imports when access returns; flag dependencies, mock commands, payment assumptions, source costs in public models, persona selectors, theme storage and routing. A source export with verifiable revision provenance is an acceptable read-only alternative; no new generation is needed.

## Technical findings and unresolved blockers

| ID  | Finding / status                                                                                 | Required action / affected gate                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| B01 | Existing Market composite keys support required Store FKs; static resolved                       | Exact future DDL reconstruction verifies target/order and deployed drift before apply; no existing-key alteration proposed                        |
| B02 | Price/listing selection cycle and same-product/same-listing integrity resolved in design         | Create draft/listing first, add exact target UNIQUE/FKs later, atomic selected version publication                                                |
| B03 | Private cost confidentiality would be weakened by generic audit_change or draft-public merge     | Use private Store events and approved snapshot projections; prove CF20–CF23 at implementation                                                     |
| B04 | Existing role_permissions is global                                                              | Owner approves zero automatic grants and explicitly reviews any later global role assignment; no new tenant-grant subsystem silently added        |
| B05 | Unnecessary file metadata/Storage scope in first slice                                           | Approve reduction from 11 to 10 tables, empty media contract, defer media security/workflow                                                       |
| B06 | Canonical Store scope/bootstrap cannot come from arbitrary caller org or ordinary policy.approve | Approve owner-controlled scope policy/configuration procedure separately; no live/default scope row in migration                                  |
| B07 | Exact policy schemas, grant set and actor-retention behavior not implementation-approved         | Approve technical policy-kind validation, actor FK/deletion impact, optional approval segregation and explicit caps before exact SQL is accepted  |
| B08 | Lovable nine-file/full-diff inspection blocked                                                   | Enable authorized source access or provide revision-verifiable export before any UI port; **not a reason to regenerate or weaken authorization**  |
| B09 | SQL compilation/RLS/actual live schema drift are not tested in documentation mode                | Required future implementation/isolated reconstruction gates; no SQL execution allowed now                                                        |
| B10 | Legal seller/tax/invoice/collection/supplier/return/delivery decisions remain unresolved         | Keep drafts/private until complete approved publication policy. Catalog-only foundation approval is not commercial activation or payment approval |

No proven need to modify existing Auth, Customer, Market, Transport lifecycle or migrations 1–47 was identified. If later SQL cannot satisfy the reviewed FKs/semantics without such changes, stop for a revised owner decision. No current application defect is inferred from these design findings.

## Explicit approval checklist — no implementation begins automatically

1. Approve/revise **catalog-only, 10 private relations**, deferring store_files/media/Storage and all cart/order/payment/fulfillment/settlement functionality.
2. Approve the seven exact permission definitions and public RPC execution surface; **zero role_permissions/user_roles grants**, no SUPERA wildcard/bypass. Any later existing-role grant must disclose its global effect.
3. Approve frozen public product/category snapshots, explicit selected price/offer versions, common Store-only org mutex, durable mutation receipts and safe private audit; technical bounds remain proposals until accepted.
4. Approve owner-controlled canonical EG/EGP scope and activation governance without seeding a live scope/product/price/legal approval in migration. No arbitrary tenant/country or default FX/tax.
5. Provide exact future SQL authorization/environment only after the accepted design becomes a reviewed migration diff with CF tests. This document itself is not Migration 48 permission.
6. Resolve B07 before final SQL approval and B08 before UI integration. Legal/commercial approvals remain separate gates; tax, merchant eligibility or return policy are not inferred from design acceptance.

This package is ready for the owner's explicit decision with these conditions visible. It does not claim that all blockers are cleared or that the source/UI/SQL has passed acceptance. No merge, deployment, Supabase/Lovable edit, payment setup or implementation occurred.
