# Phase 6 — Payments and Finance gap analysis

Date: 2026-09-21. Status: repository inspection complete for the payment design; both owner decisions below were explicitly approved on 2026-09-21. This is not Phase 6 acceptance.

## Verified baseline

Remote protected develop: a42d9f1f676e63a7786d73aa70a6213f061be796.
Main: 184ac2374a7e9611b4b265efc7dac21b57b7a2b1, unchanged.
Feature branch: feature/phase-6-payments-bank-transfer-finance, created from origin/develop with a clean starting tree. There are 27 migrations. Required CI contexts, strict branch checks, one independent approval, last-push approval, stale-review dismissal and admin enforcement remain active. No Production or Staging mutation has been performed for Phase 6.

## Existing entities to extend

| Area                    | Observed implementation                                                                                                   | Phase 6 gap / intended reuse                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| payments                | Foundation migration: UUID, organization, Order FK, timestamps; no method, status, amount, Market or uniqueness per Order | Extend this table, do not create a second payment system; derive customer, Market, currency and exact minor-unit total from accepted Order; establish one settlement per Order |
| payment_transactions    | Payment FK; non-null provider and provider_event_id; unique organization/provider/event                                   | Retain entity and uniqueness, deliberately support internal cash/transfer events without pretending there is an external gateway; append-only state/evidence history           |
| invoices                | Organization/Order identity and timestamps only                                                                           | Extend platform receipt/invoice foundation with accepted snapshot associations; issue received-payment evidence only after confirmation; no statutory tax certification        |
| TypeScript payment port | src/domain/payments/ports.ts describes future provider intent/webhook only                                                | Leave future provider boundary unused; add manual-payment domain/validation and server services, no fake provider                                                              |
| Generated types         | payments, payment_transactions and invoices match the minimal foundation schema                                           | Regenerate with official Supabase workflow after approved additive migrations; never hand-invent types                                                                         |
| FINANCE                 | FINANCE has portal.access and finance.read; SUPER_ADMIN also has finance.read                                             | Add explicit confirmation/review and bank-configuration permissions; do not grant CUSTOMER/DRIVER/SALES verification authority                                                 |
| RLS                     | Finance SELECT policies; authenticated raw financial writes revoked                                                       | Preserve raw write denial; owned customer projections, Finance tenant access, minimized operational clearance; no raw Driver access                                            |

No existing payment lifecycle, cash confirmation, transfer attempts, bank account configuration, checkout service or receipt issuance command was found. Existing generic financial audit triggers are available but are not a substitute for a transaction/evidence record.

## Commercial facts and checkout

Phase 2 pricing evaluations, distance snapshots and quote_pricing_details separate calculated price, manual adjustment and mandatory adjustment reason. Sent Quote Versions freeze commercial facts. The current Market-aware respond_to_quote command creates an Order from the accepted version transactionally, with existing uniqueness/replay rules. Orders carry accepted total/subtotal/tax, currency, customer and request relationships. Phase 3.5 preserves versioned tax and Market provenance.

Checkout must read this Order snapshot and verify the owning active customer and accepted version; no client amount/currency/tax input is authoritative. Preserve the existing preliminary-versus-final Sales flow and clarify its UI labels where necessary. No repricing is required. Full settlement only: partial payments, deposits, split tender and refunds remain out of scope.

## Execution engine: exact interception point

The current authoritative implementation is public.operations_command in 20260914000200_shared_driver_execution.sql. It obtains the actor/mutation advisory lock (namespace33), then the organization lock (namespace34), authorizes the actor, checks replay intent and locks operational rows. public.driver_execute delegates execution to this same engine. Staff uses src/infrastructure/operations/service.ts; Driver uses src/infrastructure/driver/service.ts.

The action named dispatch is physical Start Trip: READY becomes EN_ROUTE_TO_PICKUP, started_at is assigned, the first Stop becomes EN_ROUTE and the assignment becomes execution_active. Therefore this action MUST be gated for both staff and Driver. Job creation, create_trip, plan, assign and ready are preparation and must remain available while transfer verification is pending. arrive/start_service/complete_stop/depart already require started_at and enforce current Stop/dependencies; inspect/retest all alternate paths after integration. Do not create a parallel Driver payment gate.

Use a single database clearance predicate and enforce it inside the authoritative transition under the same organization lock as Finance confirmation and method changes. Projections display its result; Realtime does not authorize execution. No payment command may mutate Quote/Order commercial fields. Preserve multi-Trip aggregate completion, history, POD and active-assignment resource constraints.

## Owner-approved decisions before migrations

### 1. Upgrade behavior for paymentless accepted Orders

Phase 5 legitimately has accepted Orders and started/completed Trips without any Payment. Populated upgrade must preserve them. The Phase 6 specification defines CASH and BANK_TRANSFER clearance, but does not define a payment method or execution entitlement for these existing Orders. Silently backfilling CASH or PAID would invent a customer choice or receipt of money. Conversely, stopping an already-started Trip could strand execution/POD.

Owner-approved policy: do not invent payment methods or receipts; preserve already-started Trips so they can finish; require explicit CASH selection or confirmed BANK_TRANSFER before any not-yet-started Trip, including additional Trips of an existing multi-Trip Order. Completed historical facts remain unchanged. Orders with no chosen method may still be planned, but new physical starts are blocked. Implement this policy without inventing historical payment facts.

### 2. Method switching after physical execution starts

Sections49-50 permit an authoritative switch before proof/collection, but a CASH_DUE Order can already have an active Trip without financial evidence. Switching it to BANK_TRANSFER would create an unverified transfer on an executing Order, conflicting with the new execution rule. For a multi-Trip Order it also changes the conditions for later Trips.

Owner-approved policy: permit method changes only before any Trip of the Order has started AND before any proof submission/review/cash confirmation; freeze the selected method after the first physical start or financial evidence. Same-method replay remains safe. No silent change, automatic pause, cancellation or refund is introduced. Both directions and switch-vs-start races will be tested.

Owner explicitly approved both rules: «أعتمد القاعدتين». Implementation may proceed. Initial selection for a paymentless legacy Order is not a method switch; existing started Trips remain protected history. All subsequent method changes are frozen once any Trip has started.

## Transfer attempts, bank accounts and evidence

Add Market/currency-scoped privileged bank configuration, with explicit active/default selection; customer never chooses an arbitrary foreign account. Instructions are returned only for an eligible owned Order. Preserve submitted instruction facts in an immutable attempt snapshot so later account editing cannot rewrite history. Use synthetic Staging accounts clearly marked TEST ONLY, never real bank details in source.

Attempts must be numbered per Payment, preserve rejected proof/reviewer/time/reason and allow a new attempt after rejection. Submission is not settlement. Finance confirm/reject operates on the current valid submitted attempt under the shared lock. Record safe customer rejection guidance separately from internal Finance notes. Confirmation records the full accepted amount/currency, actor and timestamp exactly once; duplicate cash/transfer confirmations must not duplicate transactions or receipts.

## Private file architecture

Foundation has private attachments, pod-files and documents buckets and file_objects. Request uploads already use reservation, immutable object paths, finalization and cleanup. Driver issue/POD services use bounded image normalization via sharp and signed access. Reuse these patterns, not their request/Trip ownership assumptions.

Important existing risk to avoid: registered_private_files_read allows generic files.read access to foundation objects. Financial proofs must not become readable merely through that broad permission. Introduce purpose-specific financial authorization and review all OR-combined Storage policies when associating proofs with file_objects. Reuse file metadata where suitable; do not attach proofs as ordinary Request files.

JPEG/PNG should be decoded/re-encoded with bounded dimensions/bytes. PDF needs bounded content validation and attachment delivery, not HTML embedding or a claim of malware scanning. Reserve/finalize must validate stored object metadata and current ownership; signed URLs generated on demand with short expiry. Old submitted evidence remains immutable; temporary upload cleanup must not erase reviewed attempts. Exact technical size/count bounds will be documented and tested.

## Projections, UX and notifications

Customer: accepted Order checkout, CASH_DUE message, correct SA/SAR or EG/EGP instructions, private proof upload, pending verification text, rejection/reupload and safe history/receipt. Finance: bounded queue, proof view on demand, confirmation/rejection and cash collection. Operations: method/status/clearance. Driver: clearance only, no bank details or financial history. Preserve AR/EN, RTL/LTR, focus, errors and phone usability.

Phase 5 notifications are reusable but currently constrained to Trip event codes, mandatory Trip association and CUSTOMER/STAFF audiences. STAFF RLS currently recognizes Operations/Dispatcher only. Extend these deliberately for Payment association, Finance and assigned Driver recipients; do not broadcast Finance notes or proof URLs. Reuse read_at ownership/idempotency. Refresh can retrieve clearance immediately after confirmation; command authorization always rechecks current data.

## Audit and concurrency

Reuse audit_logs and explicit payment transactions. Existing generic audit records should not be expanded to dump bank instructions, proof URLs or private reviewer text. Append bounded action/state/actor/reference evidence with tenant and Market context.

Add an independent PostgreSQL connection harness alongside the existing Operations/Driver/tracking harnesses: accepted-Order replay, payment choice replay, duplicate proof, attempt numbering, two confirmations, confirm-versus-reject, cash duplicate, confirm-versus-start, start-before-confirm, and permitted method switch versus start. Prove there is no interval in which unverified transfer starts; an early start may safely fail and be retried after confirmation. Preserve namespace34 lock ordering to avoid a second incompatible execution lock.

## Migration and acceptance plan

Additive migrations extend existing financial entities, introduce only missing bank/attempt/evidence facts, install constraints/RLS/commands and shared clearance, then update projections and notifications. Inspect actual existing rows before constraints; never manufacture PAID or rewrite commercial snapshots. A populated27-migration fixture must include accepted Orders, started/completed Trips, POD and live location, comparing preserved facts after upgrade. Owner decisions above determine the new eligibility assertions.

Existing tests/helpers/database.mjs and integration upgrade patterns supply isolated database fixtures; scripts/test-operations-concurrency.mjs, test-driver-concurrency.mjs and test-tracking-concurrency.mjs establish real independent-connection CI. Extend CI without skipping those gates. Official Supabase types must match. Local unit/integration, SQL/RLS, build, E2E and hosted acceptance remain required.

Hosted guarded runners already provide explicit Staging project checks, exclusive fixture locks, in-memory credentials, sanitized reporter output and scoped finally-cleanup. Reuse acceptedOrder fixtures and full Driver/Operations journeys, adding explicit checkout choices rather than bypassing the payment gate for old tests. Prove SA cash, SA transfer, EG cash, EG transfer, rejection/reupload and Finance/start races on one genuine protected Preview. Re-run meaningful Phase0-5 regression, then independently verify cleanup including new bank/proof/financial records and revoke temporary bypass credentials. No Production or Phase7 work.

## Migration inventory reviewed

1. 20260909000100_identity_and_domain.sql
2. 20260909000200_private_storage.sql
3. 20260909000300_role_integrity_indexes.sql
4. 20260910000100_customer_request_intake.sql
5. 20260910000200_storage_upload_completion_guard.sql
6. 20260910000300_request_revision_conflict.sql
7. 20260910000400_pricing_quote_schema.sql
8. 20260910000500_pricing_quote_commands.sql
9. 20260910000600_pricing_quote_rls.sql
10. 20260910000700_persist_quote_expiry.sql
11. 20260912000100_operations_schema.sql
12. 20260912000200_operations_commands.sql
13. 20260912000300_pod_and_tracking.sql
14. 20260913000100_market_foundation.sql
15. 20260913000200_market_commands.sql
16. 20260913000300_market_snapshot_guards.sql
17. 20260913000400_market_relationship_metadata.sql
18. 20260913000500_market_tracking_projection.sql
19. 20260913000600_initial_market_geography.sql
20. 20260914000100_internal_driver_authority.sql
21. 20260914000200_shared_driver_execution.sql
22. 20260914000300_driver_projections_and_issues.sql
23. 20260914000400_driver_private_evidence.sql
24. 20260914000500_bounded_driver_projection.sql
25. 20260915000100_completed_driver_assignment.sql
26. 20260919000100_live_tracking_authority.sql
27. 20260919000200_tracking_projection_notifications.sql
