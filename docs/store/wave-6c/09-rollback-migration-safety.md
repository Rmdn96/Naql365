# Rollback and migration safety plan

Planning only. No database, backup, SQL, migration file, Auth configuration, deployment or rollback is performed in Wave 6C. “Migration 48” denotes a proposed next slice, not permission to apply it to Staging or Production.

## Baseline preservation

Accepted architecture parent `0bdd3ec0885ec46d313f8c40651e896c3eeb0e8d`; accepted application-changing SHA `67100f64dda4e5b47f7f82c65d4c1fccdbe7f72a`. Record all 47 migration file hashes and subtree `20ae191f7838e46c61a1ff3d92dd058483aad6ff` before future work. Verify baseline schema/role grants and commercially immutable Transport Quote/Order/payment/POD snapshots on a controlled populated database before upgrade. Do not silently backfill/reclassify Transport rows into Store or change existing Customer identities.

Use a separate future feature branch for each reviewed slice. Review complete schema/function/grant/generated-types diff. If another migration already became number 48, stop for sequencing reconciliation rather than rewrite/renumber accepted history. Never include live catalog, prices, tax defaults, collection destinations, supplier IDs or new role grants as undocumented activation seeds.

## Future pre-apply gate

1. Owner approves exact slice and environment. Read canonical origin/deployed artifact/project identity with credentials withheld; confirm intended Staging project, not a visually similar Production project. UI design acceptance is insufficient.
2. Verify a suitable recovery point/backup and a separately tested restore procedure in an isolated environment, its data-loss window and credential handling. No backup availability or recovery SLA is assumed from a provider plan.
3. Fresh reconstruction and populated 47→candidate upgrade both pass; generated official types are exact; RLS/direct function/Storage negatives and independent races pass. Confirm no baseline migration or unrelated schema/grant change.
4. Estimate index/constraint/lock cost on representative data; new Store tables should not scan/rewrite Transport. DDL must be transactional where supported. If a concurrent/nontransactional step is necessary, document its resumability and separately approve it; do not mix hidden nontransactional work into a claimed atomic migration.
5. Deploy schema before compatible application readers/writers; all Store functions unavailable/disabled until approved configuration and explicit activation. Old Transport application continues to operate against additive schema. Ensure no app build expects missing Store commands.

## Failure and withdrawal scenarios

| Point                                          | Safe response                                                                                                                                                      | Forbidden shortcut                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Transactional DDL fails before commit          | Roll back transaction, inspect partial tooling evidence and re-read migration history/objects before retry                                                         | Marking migration applied or editing old migration to disguise failure                           |
| Schema installed, no Store records/activation  | Keep additive inert schema while fixing forward; roll application back if needed. Destructive drop only under separately reviewed proof of no dependencies/records | Auto-dropping tables or deleting migration history                                               |
| Store draft/catalog records exist              | Pause publication/new placements; preserve drafts and audit. Restore compatible prior UI/commands or fix forward                                                   | Cascade-delete supplier/product rows referenced by orders                                        |
| Placed orders/received funds/settlements exist | Freeze new placements and privileged execution as appropriate, retain read/reconciliation/refund recovery, use forward corrective migration/compensating events    | Reverting money by restoring only part of a database, rewriting snapshots or dropping new tables |
| External transfer/refund result unknown        | Preserve durable execution intent/reservation and exact safe evidence, reconcile receiving party independently                                                     | Reissue payment merely because a server response failed                                          |
| Lost/mismatched application artifact           | Restore known compatible build/canonical origin, preserve policy snapshot references and callback/security restrictions                                            | Weaken Auth/origin/RLS or silently point to another backend                                      |

A database restore after live money movement can resurrect already executed intents or lose receipt facts. Any disaster recovery therefore requires a separate incident plan: halt execution, reconcile external movements and restored dedupe/reference state before resuming. A backup is not a financial reversal. Migration down scripts are not an automatic safe rollback for posted commerce.

## Stop/rollback runbook contract

Future runbook records actor/approver, exact artifact and migration checksums, environment/project, pause scopes, baseline verification, safe error classifications and unaffected Transport checks. Separate new-catalog publication, order placement, physical handoff and external money execution controls; preserve ongoing customer/support reads and Finance access to resolve obligations. No shutdown command may strand verified funds without a recovery path.

After a future withdrawal, verify customer ownership, staff permissions, private file authorization, replay/dedupe and business snapshot integrity. Resume only after owner approves reconciliation and exact-head checks. Keep failures/interrupted runs in evidence. Do not change main/develop, Production/DNS/Hostinger or apply SQL under this documentation-only task.
