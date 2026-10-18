# Wave 6C-F — catalog foundation final design gate

Prepared 18 October 2026. **Technical review and documentation only.** No SQL executed, migration file created, application change, grant, Supabase/Lovable modification, payment configuration, merge or deployment.

- Accepted Wave 6C parent: `0f5614199ab018fbd69fdde2773e7d514945186a`.
- Branch: `feature/store-wave-6cf-catalog-design`.
- Accepted application remains `67100f64dda4e5b47f7f82c65d4c1fccdbe7f72a`.
- Accepted Lovable design: `64f7e4dc9a355863ce3258f24e36851970dad8b9`; the supplied nine source paths are recorded, not falsely claimed inspected.
- Migration baseline: 47 committed files; subtree `20ae191f7838e46c61a1ff3d92dd058483aad6ff`.

## Review outcome

The catalog foundation can avoid changes to existing identity/Market/Customer/permission relationships. Correct FK column order and same-product/same-listing keys are specified. Mutable draft content must not leak into published products. Existing role-permission links are global; permission definitions and role grants must be reviewed separately.

Recommended first slice is **10 new private relations**, reduced from the proposed 11 by deferring `store_files` and all Storage/media-upload operations. No table is deleted now; this is a proposal change only. Versioned content is retained using frozen publication payloads and append-only offer/price/policy versions without adding product-history tables. Initial public media output is empty, not a live URL placeholder.

| Deliverable                                                    | Document                                             |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| Baseline, actual FK review, dependency and constraint findings | [01 — Schema review](01-schema-baseline-review.md)   |
| Exact proposed next migration scope and ordering               | [02 — Migration 48](02-exact-migration-48-design.md) |
| Exact permission codes, RLS, private cost and grants           | [03 — RLS/grants](03-rls-grants-review.md)           |
| Version/publication/command/idempotency contracts              | [04 — Commands](04-catalog-command-contracts.md)     |
| Catalog-only acceptance matrix                                 | [05 — Tests](05-catalog-test-matrix.md)              |
| Exact Lovable source-access status and required approvals      | [06 — Blockers](06-source-status-owner-approvals.md) |

“Validated against schema” here means static review of the committed migration chain and corroborating generated types. No live database/schema drift check, SQL compilation, fresh reconstruction or RLS execution was performed; those remain mandatory implementation gates. The accepted Wave 6C UI port map is deliberately unchanged because the nine actual Lovable source contents remain inaccessible.

The package is ready to request **explicit implementation approval of the catalog-only scope**, not permission to start now or a claim that legal/commercial/UI-source gates are resolved. Follow [the decision list](06-source-status-owner-approvals.md); no follow-on work occurs automatically. Formatting, local links, credential-pattern checks and documentation/migration tree integrity are the validation for this task.

[Machine-readable baseline evidence](baseline-evidence.json) records all 47 committed migration blob IDs, static key assertions, proposal counts and the unchanged prior UI-map blob. It explicitly records nine required Lovable files and zero files read; it is not live database or design-source evidence.
