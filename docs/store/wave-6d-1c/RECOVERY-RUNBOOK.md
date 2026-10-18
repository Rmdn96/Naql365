# Local recovery runbook — approval-gated Staging backup

Status: synthetic tooling validated; live customer-data export is not authorized
under the latest instruction. Earlier conditional approval is historical only.
No cloud restore is authorized. Migration 48 apply is a separate decision.

## Identity, isolation and responsibility

The source must be project `zuvyfeflkzlciuaauxba` in organization
`hjfxhwznfgjgywsdsqzn`, proven through official metadata and the deployment manifest.
The destination is a newly created, run-owned local PostgreSQL 17 database. The
separate future Production project named Naql365 is never a destination.

The owner authorizes data scope, custody, retention, interruption windows and any
eventual cloud recovery. The operator performs the encrypted backup and measured
local restore. An independent reviewer compares signed/hash-indexed evidence and
identifies excluded services. A designated custodian controls decryption access.
If the required person or resource is unavailable, stop before export.

## Preflight gates

1. Verify exact accepted SHA, original 47 migration blobs, Migration 48 filename
   and SHA-256; verify that no migration execution is part of the recovery command.
2. Read official project metadata, migration ledger, application schema/ACL inventory
   and Storage metadata scope. Require the approved project and 47-version baseline.
3. Require a new explicit bounded customer-data export approval. The latest owner
   instruction supersedes the prior conditional approval; synthetic success and
   secure local storage do not themselves authorize live export.
4. Obtain the project's public CA through the official Dashboard. Use the official
   linked session pooler when direct IPv6 connectivity is unavailable. Verify the
   exact project-scoped database user and session port in memory without printing
   connection strings. Use `sslmode=verify-full`; fail closed on certificate errors.
5. Use existing authorized database access only. No password reset, new login role,
   broader grants or security-setting changes are part of this runbook. A CLI
   `--dry-run` may expose credentials: capture it privately in memory, never log it.
6. Read database/application sizes. Budget at least the encrypted archive, source
   snapshot overhead, restored database, indexes/WAL/temp files, and operating-system
   headroom. A planning allowance of three times the estimated database size plus
   5 GiB is a starting gate, not a proof that a larger live restore fits. Confirm
   Docker VM disk capacity as well as Windows capacity. Stop if either is uncertain.
7. Record source/target engine and extension versions, image digest, expected owners,
   network isolation, existing sessions, backup start time and source transaction.

## Backup scope and consistency

The economical path is a logical PostgreSQL backup, not a provider physical clone.
The installed Supabase CLI supports `db dump`, `--data-only --use-copy`, `--role-only`
and explicit schemas. Its default schema-only output is not a data backup. The
official guide also treats the migration ledger separately.
[Supabase backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Use a reviewed, consistent snapshot for `public`, `private` and
`supabase_migrations`, retaining all interdependent application tables, sequences,
functions, triggers, constraints, ACLs and RLS. A single custom-format `pg_dump`
with matching PostgreSQL tools can preserve schema and data in one snapshot. If
separate CLI schema/data/history dumps are used, coordinate an exported read-only
snapshot or an explicitly approved consistency window; three unrelated dump times
are not automatically one coherent recovery point.

Capture only supported password-free role/privilege metadata. Never export
`pg_authid`, role password hashes, Auth session/refresh tables, provider secrets,
management tokens, Vault encryption roots or other protected system contents.
Keep managed Auth/Storage schemas excluded unless a separate explicit scope and
safe procedure are approved. Preserve a documented prerequisite map for referenced
Auth user identities and Storage objects. An application-only archive cannot recreate
excluded managed identities or credentials in a blank production platform.

Where a managed-schema FK requires parent identities in a local validation target,
use a reviewed, secret-free identity placeholder adapter derived from the approved
application references; keep it isolated and label it as test scaffolding. Do not
claim normal password login, managed Auth integrity or full-platform recovery from
such a target. Never substitute these placeholders into live Staging.

Set sessions read-only, bound connection/statement timeouts, monitor long-running
snapshot/lock impact and abort safely if it threatens Staging availability. Leave
Staging online; a consistent read may still impose I/O and retain old row versions.

## Encryption and access

For the validated synthetic path, archive bytes pass directly from local pg_dump
to memory and AES-256-GCM encryption; only ciphertext is written outside Git.
Each random 256-bit data key is wrapped with Windows DPAPI CurrentUser. Decryption
and digest verification succeeded; a modified ciphertext was rejected. No plaintext
dump or password-bearing role archive was written to disk.

For live data, use the same reviewed authenticated-encryption envelope or a
reviewed streaming equivalent with restricted directory ACLs, bounded memory and
no plaintext temporary files. Store keys separately from ciphertext where practical.
Do not put ciphertext, keys, plaintext SQL, raw query results or customer records
in Git, CI artifacts, screenshots or the report.

DPAPI currently binds recovery to this Windows user's protected profile. It is not
independent off-device key escrow. Before relying on it for disaster recovery, the
owner must approve a separately protected recovery-key custody/escrow method and
verify decryption by the intended custodian. Losing the Windows profile or this
single disk can make the existing local-only copy unusable. No unapproved key
export, external upload or paid service has been performed.

## Local restore and acceptance

1. Verify archive timestamp, ciphertext digest, authenticated decryption and approved
   source identity. Fail on truncation, wrong key or changed ciphertext.
2. Create only a run-owned local target with no published ports or external network
   during restoration. Reject an existing or non-local target. Disable no RLS,
   constraints, triggers or authorization checks to force success.
3. Install the reviewed platform prerequisites, then restore supported role metadata
   and the database in dependency order with stop-on-error/transactional semantics.
   Do not replay provider-admin login credentials or blindly alter the recovery
   operator's own role. Document any explicit placeholder prerequisite.
4. Measure restore start/end separately from setup, decryption and verification.
   Record every failed attempt; never relabel failure as success.
5. Compare row counts and deterministic per-table digests, sequence positions,
   migration ledger, function definitions, owners/ACLs, RLS enablement and policies,
   role memberships, indexes and FK/check/unique constraints. Validate actual
   cross-tenant denial with run-owned synthetic checks; do not modify owner records.
6. Logical metadata comparison must preserve semantics. Record dropped-column
   ordinal compaction and equivalent default ACL representation explicitly. The
   synthetic harness allows only one reviewed pure-AND deparser normalization;
   no arbitrary SQL-expression normalization is approved.
7. Require no Store objects, Store scope or Store grants in the recovered baseline.
   The recovery drill must not execute Migration 48.
8. Independently inspect cleanup: delete only labeled run-owned local containers and
   volumes; verify absence. Retain only owner-approved encrypted archives and
   sanitized evidence. Review key disposal/retention separately from container cleanup.

## RPO, RTO and operational recovery

- **Measured synthetic restore:** 1.753 seconds; verification 3.286 seconds. These
  values apply only to the small synthetic database and compatibility stubs.
- **Actual Staging RTO:** unknown until the approved live archive is restored and
  service prerequisites are tested. Planning budget: two hours including setup,
  integrity review and service verification; this is a proposed target, not an SLA.
- **RPO:** recommend a verified snapshot immediately before the eventual change
  window, with a recorded maximum acceptable backup age (proposed: 15 minutes).
  This is not a promise of zero loss. Transactions after the snapshot are absent.
- Since Staging stays online, record writes after the snapshot and require a
  separately approved reconciliation/recovery decision. Never overwrite legitimate
  Transport/Finance activity by restoring an old database blindly.
- Successful local restore proves archive readability and application-database
  recovery within the tested scope. It does not authorize any cloud restore or
  guarantee availability of Auth/Storage/Realtime, encryption roots or service config.

## Storage recovery gap

Database backups retain Storage metadata, not file object bytes. A separate
authorized inventory, encrypted object export, digest/size checks and isolated
object restoration are needed for proof/POD/attachment recovery. This task did not
export file objects or expose private/signed URLs. Existing metadata references
alone do not prove that the referenced files can be recovered.
[Supabase database backup limitations](https://supabase.com/docs/guides/platform/backups).

## Current blockers and next approval

The source's direct endpoint failed networking; the official linked session
pooler failed CA validation using the available trust bundle. No live export has
started. Obtain the official Staging CA and repeat `verify-full`; do not use
`require`, `verify-ca`, an arbitrary certificate or disabled validation as a workaround.
[Supabase TLS verification](https://supabase.com/docs/guides/platform/ssl-enforcement).

After successful live recovery validation, return a measured evidence package and
the exact unchanged migration checksum to the owner. Applying Migration 48, Store
grants, scope provisioning, activation and any cloud restore each remain outside
the present authorization.
