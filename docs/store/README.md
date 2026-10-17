# Naql365 Store — Wave 6A architecture review

Status: **NAQL365 STORE — WAVE 6A ARCHITECTURE READY FOR OWNER REVIEW**.

Prepared 17 October 2026. Research and design only; none of the proposed Store tables, permissions, routes, commands or states is implemented or migration-approved by this package.

- Branch: `feature/store-wave-6a-architecture`.
- Accepted parent delivery: `ddd070328b3cef432bc51664beb26eaf472cd299`.
- Last accepted application-changing commit: `67100f64dda4e5b47f7f82c65d4c1fccdbe7f72a`.
- Existing migrations: **47**, immutable subtree `20ae191f7838e46c61a1ff3d92dd058483aad6ff`.
- GitHub remains canonical; Next.js/Supabase remain the application/backend. Lovable generation, implementation and hosting changes are outside this task.

| Deliverable                            | Document                                                       |
| -------------------------------------- | -------------------------------------------------------------- |
| 1. Product requirements                | [01 — PRD](01-product-requirements.md)                         |
| 2. Rules and state machines            | [02 — Business rules](02-business-rules-state-machines.md)     |
| 3. ERD/schema specification            | [03 — Data model](03-schema-specification.md)                  |
| 4. Payment and settlement architecture | [04 — Financial controls](04-payments-supplier-settlements.md) |
| 5. Security/RBAC/RLS                   | [05 — Security](05-security-rbac-rls.md)                       |
| 6. Customer/admin UX sitemap           | [06 — UX](06-ux-sitemap.md)                                    |
| 7. Supplier expansion                  | [07 — Expansion](07-multi-supplier-strategy.md)                |
| 8. Implementation roadmap and gates    | [08 — Roadmap](08-implementation-roadmap.md)                   |
| 9. Open decisions and risk register    | [09 — Decisions](09-open-decisions-risks.md)                   |
| 10. Repository architecture review     | [10 — Review summary](10-architecture-review-summary.md)       |

## Reading and approval contract

Owner-fixed requirements are the single storefront, staff-controlled publication, supplier-owned stock and physical delivery, separate cost/selling price, no pre-checkout supplier availability confirmation, and independent financial/fulfillment dimensions. Technical proposals in these documents require subsequent approval before code or schema work.

Recommended V1: registered Customers first, one fulfillment supplier per order, separate Store aggregates and financial records, staff-administered supplier communication, and explicit Market activation. Guest checkout has a Store-specific security design but remains gated; existing Transport capabilities cannot authorize Store resources.

Legal/accounting questions are not answered by the architecture. Merchant-of-record, invoice issuer, tax treatment, collection-account eligibility, returns, liability and Saudi payment methods remain open. An architecture approval is neither production approval nor approval of a live collection destination.

## Documentation validation

Completed for this package: directory formatting PASS; 16 local document links including one heading anchor PASS; tracked/history credential-pattern scans PASS; 11-file documentation-only scope PASS; 47-migration baseline unchanged. Secret scans are heuristic checks, not proof that every possible secret format is detectable. No application acceptance test is claimed for proposed Store behavior.

Required checks: Prettier for this directory, tracked and history secret-pattern scans, local Markdown link resolution, and a baseline diff proving that only `docs/store/` changed. No application test, SQL, Supabase administration, fixture, migration, Lovable generation or deployment is required to validate this documentation-only change. Final commit/check results are recorded in the owner handoff, avoiding a self-referential commit hash inside its own document.
