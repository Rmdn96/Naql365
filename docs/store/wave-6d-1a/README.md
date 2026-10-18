# Store Wave 6D-1A — catalog foundation local delivery

**Local implementation complete; ready for Staging review. Cloud apply remains BLOCKED.**
This is not Store publication, Staging SQL authorization or Production acceptance.

## Baseline, scope and source

- Repository: Rmdn96/Naql365.
- Branch: `feature/store-wave-6d-1a-catalog-foundation`.
- Canonical base: origin/develop, `29baff49a143e2ed24856c80cbc08c9b65c3f941`.
- Design: [final Wave 6C-F](../wave-6cf/README.md), with the owner's subsequent
  authorization for ten tables, seven definitions and local migration implementation.
- Migration: [20261018000100_store_catalog_foundation.sql](../../../supabase/migrations/20261018000100_store_catalog_foundation.sql).
- Migration SHA-256: `0816abc8bf7ef64258adfddc7f92633786b8d30bff9c00453caecfbb37459ebd`.
- Total proposed source migrations: **48**; accepted migrations 1–47 unchanged.
- No Store page, route, Next.js action, customer navigation, runtime integration,
  product/price/configuration seed, bucket, order, checkout, payment or settlement.
- No push, PR creation, merge, deployment, protected-branch change, dependency
  update, cloud SQL, Supabase credential change, DNS/Hostinger change or Phase 8.

The implementation commit is supplied in the delivery response, avoiding a
self-referential hash inside its own report. The previous local security-report
branch/commit is preserved separately, not silently incorporated here.

## Implemented security and contracts

See [exact contracts](CONTRACTS.md) for ten table names, seven RPC signatures,
payloads, state transitions, typed validation and permission conjunctions.
See [Staging review procedure](STAGING-REVIEW.md) for pre-apply blockers and rollback.

- Private RLS tables and explicit ACL revocation; postgres-owned definer RPCs with
  empty search_path and independent Auth/context/permission checks.
- Exactly one active canonical staff membership; no cross-organization union,
  email/metadata authority, SUPER_ADMIN shortcut or automatic role grants.
- Existing Market composite keys reused; EG/EGP validated by trigger/commands.
  Same-product offer and same-listing price selection enforced by composite FKs.
- Public read returns NOT_AVAILABLE without an owner-provisioned unpaused scope.
  No scope is installed. Staff commands cannot provision or modify it.
- Supplier cost/agreement evidence confined to sourcing projection with all
  required grants. Public/retail DTOs use explicit allowlists. Generic audit_change
  is not attached to any Store commercial table.
- Approved versions immutable; product/category drafts separated from frozen
  publication content, category parent/path and selected price/offer/policies.
- Store-only org mutex; fresh post-wait permission/context checks, expected
  revisions, durable canonical intent hashes and atomic resource/event/receipt.
- Actor subject snapshots are identifiers, not authority. Approval-profile FK
  retention implications remain an explicit pre-Staging owner review item.

Seven permission definitions produce seven normal permission-definition audit
inserts through the existing audit trigger. They produce **zero role grants** and
no Store/business records. Populated-upgrade validation checks every original
audit row remains byte-equivalent and allows only those seven exact new metadata
events; it does not ignore the audit table or private commercial changes.

## Local verification results

| Gate                                          | Result / reproducible command                                                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh SQL reconstruction                      | PASS, all 48 files using official CLI on disposable local Supabase/PostgreSQL 17                                                                                       |
| Original migration integrity                  | PASS, `node scripts/verify-store-catalog-migration.mjs`; 47 accepted Git blobs byte-identical                                                                          |
| Populated 47→48 upgrade                       | PASS, `node scripts/test-store-catalog-upgrade.mjs` with explicit disposable-local flags; all previous public data, role grants, non-Store functions and RLS unchanged |
| SQL/RLS suite                                 | PASS, 9 files / **110 TAP assertions**; 102 catalog assertions plus 8 existing-suite wrappers                                                                          |
| Catalog races and abort                       | PASS, **9 independent-connection barrier races + 1 rollback scenario**, plus independent cleanup observer                                                              |
| Existing concurrency                          | PASS, all six Operations, Driver, Tracking, Payment, Manual Pricing and Guest suites                                                                                   |
| Full unit/integration                         | PASS, **354/354**, 70 files; `vitest run --maxWorkers=2`, unchanged assertion/time limits                                                                              |
| Final focused catalog integration             | PASS, 1/1; executes the catalog SQL assertions in PGlite and verifies rollback/unavailability; included in 354, not added twice                                        |
| Full application E2E                          | PASS, **60/60**, unchanged application runtime; isolated test output directory                                                                                         |
| Restricted staff local browser                | PASS, **12/12** AR/EN role journeys, 60 synthetic captures; login/refresh/direct-login/grants/drawer/axe/logout and cleanup                                            |
| Official public DB types                      | Generated by official CLI from clean local schema; seven RPC additions only, no private tables in client types                                                         |
| Strict TypeScript / lint / production build   | PASS                                                                                                                                                                   |
| Formatting / tracked and history secret scans | PASS; secret scans are heuristic, not proof of absence of every possible secret format                                                                                 |
| Exact-head hosted CI                          | NOT RUN: local-only unpublished implementation; no old CI is claimed for this new commit                                                                               |

All test data is disposable/run-owned. No owner identity or business record was
used. Hosted role/session evidence is not substituted for these local results;
no new hosted Store acceptance is claimed.

## Changes outside the migration

- Official `src/infrastructure/supabase/database.types.ts`: seven RPC declarations.
  No Next.js runtime implementation or Auth/Finance/Driver command source changed.
- `supabase/tests/store_catalog.test.sql`: authorization, data integrity, cost
  privacy, public snapshots, suspension, money/input limits, RLS and dedupe checks.
- `tests/integration/store-catalog.test.ts`: actual catalog SQL execution and
  rollback verification in isolated PGlite.
- `tests/integration/deployment-attestation.test.ts`: exact count 47→48 for the
  newly authorized migration; all attestation assertions retained.
- New Store integrity/upgrade/concurrency scripts and local Supabase test helper.
- Seven existing local test scripts now read the same validated local configuration
  through that helper; loopback checks remain, default port remains 54321. Only
  an isolated configured 55321 alternative is accepted for reserved Windows ports.
  No test's business/authorization assertions were removed or weakened.
- CI adds integrity and catalog concurrency gates; deployment triggers unchanged.
- This documentation and sanitized evidence. Application/package files and old
  migration blobs remain unchanged except the generated public type declaration.

## Forty-two design acceptance groups

All groups are accounted across actual tests; this is **42 groups**, not 42 new
unit tests or visual screenshots. Detailed raw local logs are indexed in evidence.

| IDs       | Evidence                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CF01–CF03 | Full reconstruction, populated upgrade, exact migration/types and composite-FK metadata assertions                                                                  |
| CF04–CF08 | Wrong org/Market, wrong product offer/listing price, invalid scope/country, global scope uniqueness and owner-only pause/commands                                   |
| CF09–CF17 | Customer/Driver/unauthorized staff/SUPER_ADMIN denial, independent sourcing permission omissions, editor/publisher/policy conjunctions, ambiguous/suspended context |
| CF18–CF21 | All-table RLS/ACLs, private helper execution denial, definer/search_path checks, DTO whitelists, no generic commercial audit or mutable events                      |
| CF22–CF26 | Frozen draft/public content, immutable approved amounts, absent/zero/fractional/overflow money, wrong/missing policy/state, future/expired/revoked eligibility      |
| CF27–CF29 | Product/supplier/selected-source suspension, unchanged selected versions, category depth/cycles and concurrent A↔B reparent                                         |
| CF30–CF33 | Same-key replay/conflict, one stale-revision winner, one receipt/event, transaction abort with no successful residue                                                |
| CF34–CF36 | Independent barriers for publication versus price approval/source revocation and membership/grant loss including cached replay                                      |
| CF37–CF40 | Fresh post-commit visibility, single-statement public projection, bounded keysets/search/envelope, empty media, ten tables/seven RPCs/official types                |
| CF41      | Full existing SQL/RLS, 354 unit/integration, 60 E2E, six Transport concurrency suites and 12 restricted-role local browser journeys                                 |
| CF42      | Rollback fixtures, committed-fixture ledger/ownership guards, independent cleanup, final disposable local teardown; no new cloud credential                         |

No HTTP Store adapter/cache exists in this slice. The future no-store adapter
requirement remains explicit; no browser cache behavior is fabricated as tested.
Local races use separate psql backends, pg_stat_activity lock-wait barriers and
an independent observer, rather than relying on Promise.all timing alone.

## Preserved failures and corrections

1. Windows reserved 54271–54370: both DB 54322 and API 54321 failed to bind.
   Isolated temporary config used 55322/55321; canonical config/security unchanged.
2. Initial shared trigger accessed a missing `new.terms` field on a different
   table. Fixed new migration guard to use the row's explicit JSON fields.
3. Scope-pause fixture advanced revision; a negative scope test supplied the old
   revision and received PT409. Corrected its fixture revision so it proves 42501.
4. PGlite omits service_role. Unconditional REVOKE failed reconstruction there;
   the new migration now revokes it when it exists. Real Supabase ACLs are unchanged
   in strength; no new role is created to conceal the dependency.
5. First populated comparison rejected the seven authorized permission audit
   inserts. Comparison now proves all old rows unchanged and asserts exactly
   seven permission-only new rows, preserving the audit privacy invariant.
6. Unit run had a stale exact-47 assertion plus five 30-second resource timeouts
   under concurrent workloads. The authorized count is now exactly 48; final
   full suite uses two workers, retaining all timeouts/assertions, and passes.
7. Initial Playwright run stalled before a test result using a shared output
   directory. It was stopped; isolated output/reporter run completed all 60.
8. Inherited operator environment overrides caused local type-generation password
   failure and an initial metadata-token denial. Overrides were excluded in those
   child processes; credentials were not printed, reset or changed.
9. Nine existing Windows checkout files contain mixed EOLs. Accepted canonical Git
   blob bytes remain identical; the integrity manifest reports checkout hashes
   separately. No historical migration file was normalized or rewritten.

Earlier attempts remain historical failures/interruption evidence, not passes.
See [history](evidence/history.json). Full local logs/private synthetic backup
were kept outside Git; only reviewed safe text/JSON evidence is included. Committed
text logs normalize line endings/trailing whitespace; pass/fail content is retained.
The synthetic backup was disposed after verification; the local Supabase instance
was stopped without backup and its project containers are absent. No temporary
cloud credential was provisioned. See [disposal](evidence/local-disposal.json).

## Staging and remaining risks

Project metadata identity is verified, but actual live migration history, schema
drift, provider backup/recovery point and a proven isolated restore are **not**.
No cloud introspection SQL was executed. These block Staging apply and must be
reviewed using [the explicit procedure](STAGING-REVIEW.md).

Retention/approver FK behavior, policy evidence governance and any future role
grants/scope provisioning require owner review before real data. Legal seller,
tax, invoice, supplier agreement, delivery/returns and payment eligibility are not
invented or approved by this foundation. Known npm development-chain High findings
remain for separate remediation/security approval; no dependencies changed.

**NAQL365 — STORE WAVE 6D-1A LOCAL IMPLEMENTATION COMPLETE — READY FOR STAGING REVIEW**.
