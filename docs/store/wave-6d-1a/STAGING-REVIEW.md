# Migration 48 — Staging review and future application procedure

This run is **local implementation only**. No cloud SQL, migration apply, grants,
Store activation, product/price seed, bucket, payment setup or deployment is authorized.

## Identity and current preflight

- Intended Staging: `zuvyfeflkzlciuaauxba`, project `naql365-staging`, eu-central-1.
- Read-only official CLI project metadata returned `ACTIVE_HEALTHY` on 2026-10-18.
- `config/deployment-manifest.json` binds Staging to that project and has
  `production: null`. No Production project is selected or configured by this slice.
- First metadata attempt was denied by a stale inherited SUPABASE_ACCESS_TOKEN.
  Excluding that environment override from the read-only child process allowed the
  existing CLI login to work. No credential was generated, reset, printed or persisted.
- **Live migration history: NOT VERIFIED.** Expected baseline is 47, not inferred
  as a current live fact from earlier acceptance reports.
- **Live schema drift: NOT VERIFIED.** Repository reconstruction is not a substitute
  for deployed schema/grant comparison.
- **Staging recovery point and tested restore: NOT VERIFIED.** No provider-plan
  backup/PITR capability, retention window, RPO/RTO or restore guarantee is assumed.
- A synthetic LOCAL baseline archive was created during the upgrade test; it is
  outside Git and is not a backup of Staging or proof of a Staging restore.

**Staging application is BLOCKED** until the live history, drift and recovery
requirements below are independently evidenced and the owner approves the exact
implementation commit and migration checksum. This package is for review, not apply.

## Review decisions still required

1. Confirm exact typed policy schemas and technical caps in the implementation
   contracts. They validate data shape and accountable evidence references, not
   legal seller/tax/return/delivery correctness.
2. Approver fields on approved policies, agreements, offers and prices reference
   profiles with RESTRICT. Receipt/event actor subject snapshots have no Auth FK.
   Review retention/anonymization implications before any real-user data deployment;
   do not silently change existing Auth account deletion workflows.
3. No catalog maker/checker segregation was invented. The database records the
   authenticated approver; a stricter separation requires a separate owner decision.
4. This migration defines seven permissions and grants none to existing roles,
   including SUPER_ADMIN. Any subsequent grant must disclose its global role impact.
5. Canonical STOREFRONT_SCOPE provisioning, identity replacement and activation
   remain separately owner-controlled; no ordinary Store RPC can perform them.
   The migration installs no scope row and the Store remains unavailable.

## Future pre-apply procedure — not executed

Use an authorized operator in a separately approved Staging window:

1. Verify repository commit, branch, clean tree and exact migration SHA-256 from
   this delivery. Re-run `node scripts/verify-store-catalog-migration.mjs`.
   Confirm migrations 1–47 match their accepted Git blobs. No extra pending file.
2. Read linked project reference and official project metadata; require exact
   `zuvyfeflkzlciuaauxba`. Stop on mismatch, inaccessible metadata or Production.
   Do not print tokens, URLs containing credentials, API keys or operator passwords.
3. Under explicit permission for cloud introspection, read remote migration
   history and schema/ACL inventory. Require exactly the accepted 47 versions,
   no unexpected Store objects, unchanged existing functions/RLS/grants and no
   competing migration 48. Resolve drift before applying; never renumber history.
4. Obtain a verified recovery point appropriate to the actual provider plan,
   record backup timestamp/RPO, integrity and restore ownership. Demonstrate a
   restore in a controlled isolated target and record its tests. No blind full
   restore over live Transport data or financial facts.
5. Review the complete additive DDL, generated public types, seven RPC ACLs,
   definer ownership, test evidence and unresolved security/retention decisions.
   Confirm Store tables and functions are absent from the active application UI.
6. Only after owner authorization, use the official linked-project migration tool
   in dry-run mode. Its pending set must contain **only**
   `20261018000100_store_catalog_foundation.sql` with the reviewed checksum.
   Do not use include-all, remote reset, migration repair or history rewriting.
7. After final owner approval of the dry-run/recovery evidence, apply that exact
   migration using the normal transactional migration mechanism. Stop on error;
   verify transaction outcome and migration ledger rather than retry blindly.
8. Verify ten private Store tables, RLS enabled/default-deny, explicit ACLs,
   seven new definitions/zero new role grants, exactly seven public RPCs,
   zero scope/product/price records, no Store buckets/orders/payments and unchanged
   Transport rows/snapshots/permissions/functions. Do not create hosted fixtures
   unless separately authorized and ledgered.
9. Test public Store projection returns NOT_AVAILABLE; existing Customer/Staff/
   Driver and Transport smoke remains intact on the approved canonical Preview.
   Schema success does not approve commercial publication, payment collection or UI.

## Failure/withdrawal

DDL should be applied transactionally. A pre-commit failure must roll back all new
objects/definitions and leave history unadvanced. If committed but unused, retain
the inert additive schema pending a reviewed forward correction. Do not drop tables,
erase migration history, invent scope rows or widen permissions to unblock a check.
Any destructive rollback requires separate proof of no dependencies/records and
owner review. No automatic migration down or partial financial restore is safe.

## Local reproduction

Normal Linux CI uses the repository's unmodified local ports. This Windows host
reserved 54271–54370, so tests used an isolated temporary Supabase config with
API 55321 / DB 55322 / shadow 55320 / mail 55324 and project_id naql365.
The canonical `supabase/config.toml` is unchanged.

Set `NAQL365_LOCAL_SUPABASE_WORKDIR` only to that disposable temporary project
when reproducing local tests. Local helper permits only loopback HTTP and the
configured port 54321 or 55321. No cloud URL is accepted. The populated-upgrade
script additionally requires `NAQL365_ALLOW_LOCAL_RECONSTRUCTION=1`, confines its
workdir to the OS temporary directory and uses `--local` exclusively. It resets
the disposable database; never point it at a shared development database.
