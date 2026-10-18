# Store Wave 6C — implementation readiness review

Prepared 18 October 2026. **Architecture refinement and implementation planning only.** No proposed object, permission, function or route in this package is implemented or migration-approved.

- Accepted architecture: `0bdd3ec0885ec46d313f8c40651e896c3eeb0e8d`; [Wave 6A index](../README.md).
- Owner-accepted Lovable design reference: `64f7e4dc9a355863ce3258f24e36851970dad8b9`, project `45d7c85b-e937-48ee-8d57-251cc16a57b8`. This is a lab revision, not a GitHub/application commit.
- Accepted application: `67100f64dda4e5b47f7f82c65d4c1fccdbe7f72a`.
- Documentation branch: `feature/store-wave-6c-readiness`, based directly on accepted architecture. The separate Wave 6B local preparation remains preserved on its original branch; its historical access checkpoint is not a review of the subsequently owner-accepted design.
- Current migrations: **47**, subtree `20ae191f7838e46c61a1ff3d92dd058483aad6ff`; migration 48 remains a proposal, not a file.

## Fixed scope and unresolved gates

Egypt only, EGP only, registered Customers only, one storefront and one supplier per placed order V1. No owned inventory, availability-confirmation step before checkout, supplier portal or self-publication. Suppliers prepare/deliver; Naql365 sets retail prices and administers customer orders. Separate Store aggregates from Transport. SA Store checkout/pricing/fulfillment stay unavailable without changing Saudi Transport.

Supplier COD custody and Naql365 electronic collection are distinct. Finance must verify actual electronic receipt before funded-order release. Vodafone Cash/InstaPay are proposed methods, not activated providers. Legal seller, tax, invoicing, eligible accounts, contract entitlement, delivery/return responsibilities and settlement timing remain approval gates. Missing configuration is not zero tax or default commercial consent.

## Deliverables

| Requested deliverable                  | Specification                                                 |
| -------------------------------------- | ------------------------------------------------------------- |
| Final proposed V1 schema               | [01 — Schema](01-v1-schema.md)                                |
| Migration 48 design proposal           | [02 — Migration plan](02-migration-48-proposal.md)            |
| Command/API contracts                  | [03 — Commands](03-command-api-contracts.md)                  |
| Security/RLS implementation plan       | [04 — Security](04-security-rls-plan.md)                      |
| Finance/settlement invariant test plan | [05 — Financial tests](05-finance-invariant-tests.md)         |
| Lovable-to-Next.js port map            | [06 — UI port map and evidence limit](06-lovable-port-map.md) |
| Incremental implementation roadmap     | [07 — Roadmap](07-implementation-roadmap.md)                  |
| Outstanding decisions                  | [08 — Owner decisions](08-owner-decisions.md)                 |
| Rollback/migration safety              | [09 — Safety](09-rollback-migration-safety.md)                |

“Executable specification” means precise contracts and future acceptance criteria, **not executable SQL/code delivered now**. Proposed technical limits, allocation rules, grant combinations and maker/checker requirements need approval before implementation. Approval of this package alone does not authorize a migration, application work, real payments or release.

## Evidence and readiness limits

Canonical sources and existing architecture were inspected. The exact Lovable files/diff could not be read: no Lovable tools are exposed in this session; integration discovery reports unavailable/not installed, and Computer Use returned native-pipe OS error 2 before navigation. The owner-supplied revision is accepted as the reference, not falsely described as inspected. The port map distinguishes inspected canonical targets from candidate visual components and makes exact lab file/diff review a mandatory pre-port gate. No regeneration or substitute design was attempted.

This package is ready for **owner architecture review** subject to the explicit decision register and UI-source review limitation. It is not unconditional implementation or launch readiness. Documentation format, local links, credential-pattern scans and documentation-only/migration tree integrity are the checks for this task; future Store test plans are not claimed as executed.
