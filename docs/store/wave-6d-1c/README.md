# Store Wave 6D-1C — Economical recovery readiness

**STORE WAVE 6D-1C — READY FOR OWNER REVIEW**

**Migration application recommendation: NO-GO.** The local synthetic recovery
drill passed. The owner subsequently approved the bounded encrypted Staging export,
but no live data export has occurred: verified TLS connectivity remains blocked.
Migration 48 requires a new, separate apply authorization even after recovery passes.

## Baseline and scope

- Implementation branch: `feature/store-wave-6d-1a-catalog-foundation`.
- Accepted implementation: `96eb4e9047025b4cb9065e00435e6ac167063b24`.
- Accepted develop: `29baff49a143e2ed24856c80cbc08c9b65c3f941`.
- Only approved cloud source: `zuvyfeflkzlciuaauxba`, organization
  `hjfxhwznfgjgywsdsqzn`, eu-central-1, `ACTIVE_HEALTHY`.
- The separate project named Naql365 is reserved for future Production. It was
  not selected, inspected as a restore target, or used for this task.
- No cloud DDL/DML, migration apply/repair/reset, role grants, scope seed, Store
  publication, customer-data export, Production, DNS or Hostinger action occurred.

## Current evidence

| Gate                                       | Result                      | Meaning                                                                                                                          |
| ------------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Source and migration integrity             | PASS                        | Original 47 Git migration blobs unchanged; Migration 48 checksum matches                                                         |
| Live migration ledger                      | PASS                        | Exactly the accepted 47 versions; no Migration 48                                                                                |
| Read-only application drift comparison     | PASS within inspected scope | 77 relations, 138 function definitions/security flags/ACLs and 92 policies match the platform-compatible accepted reconstruction |
| Compatible local environment               | PASS                        | Cached PostgreSQL 17 image; Docker 29.6.2; approximately 13.7 GiB host free space at preflight                                   |
| CLI backup capability                      | PASS, dry-run only          | Installed `db dump` supports schema, data/COPY and password-free role metadata; default dump is schema-only                      |
| Synthetic archive exists/access/decryption | PASS                        | AES-256-GCM archive outside Git; DPAPI-wrapped key; decrypted hash matches                                                       |
| Corrupted ciphertext                       | Rejected                    | GCM authentication failed as required                                                                                            |
| Synthetic isolated restore                 | PASS                        | 81 table row digests, 47 ledger entries, functions, RLS, grants, constraints, indexes and column contracts match                 |
| Synthetic authorization smoke              | PASS                        | Anonymous table privilege absent; unauthenticated authenticated-role query sees zero Orders                                      |
| Synthetic cleanup                          | PASS                        | Both run-owned containers and their anonymous data volumes removed; container absence independently checked                      |
| Live backup                                | BLOCKED, not created        | Direct endpoint network failure; linked session pooler TLS CA validation failure                                                 |
| Live restore and measured live RTO         | NOT RUN                     | No approved live backup material exists locally yet                                                                              |

The current backup-list API still returns `backups: null`, empty physical backup
metadata, `pitr_enabled: false`, and `walg_enabled: true`. This proves neither an
accessible dated provider backup nor recoverability. Exact subscription tier is
not exposed by the inspected CLI organization response and remains unverified.
The owner-approved local strategy does not depend on buying PITR or another project.

The live schema comparison is limited to the inspected application metadata; it is
not a forensic assertion that every managed Auth/Storage/extension object or live
business row equals a local installation. Recheck drift and ledger immediately
before any later apply authorization.

## Measured synthetic results

- PostgreSQL `pg_dump --format=custom` plus `pg_dumpall --roles-only
--no-role-passwords`; two isolated databases with no networking or published ports.
- Only migrations 1–47 were reconstructed, with the existing Phase 3 synthetic
  fixture and a clearly synthetic migration ledger. Migration 48 was not executed.
- Backup duration: **0.895 seconds**.
- Restore duration: **1.753 seconds**; subsequent verification: **3.286 seconds**.
- Encrypted database archive size: **748,730 bytes**.
- These timings cover a tiny synthetic application database, not live Staging
  provisioning, full incident recovery, a cloud SLA or a guaranteed live RTO.
- Auth and Storage compatibility stubs are explicit test scaffolding. Their
  inclusion does not establish recovery of real Supabase authentication, sessions,
  managed services, encryption roots, Realtime or Storage file bytes.

## Historical attempts preserved

Attempt 1 restored all row hashes but failed a raw metadata digest. Attempt 2
narrowed the differences. Neither attempt is relabeled PASS. PostgreSQL logical
dump/reparse compresses dropped-column ordinal gaps, can reorder ACL entries or
represent owner-only ACLs as defaults, and flattens one legacy pure-AND bounds
expression. The final harness compares sequential column order and explicit
default ACLs, sorts ACL sets, and accepts only the reviewed exact bounds expression
for that one constraint. No general expression stripping, RLS weakening, timeout
increase or assertion removal was used. Final data and security comparisons passed.

## Decisions and next action

See the [recovery runbook](RECOVERY-RUNBOOK.md) and
[governance decision register](GOVERNANCE-DECISIONS.md).

The owner approved encrypted export only after the synthetic prerequisites passed.
Those prerequisites now pass. A further owner action is required to supply the
public CA certificate downloaded from the exact Staging project's Database Settings.
Then retry the bounded read-only session-pooler connection with `verify-full`.
Do not downgrade TLS, reset credentials, create a login role or alter enforcement.

After connectivity succeeds, verify size/capacity, take a consistent application
backup, restore it locally under the approved scope and measure the actual result.
Do not claim that these pending actions have happened. Key custody, Storage coverage
and governance still need explicit decisions. The source migration stays inert.

## Evidence and validation

Sanitized evidence lives in [evidence/](evidence/). Backup ciphertext and wrapped
keys are outside the repository under the current user's local application-data
recovery directory; no dump, key or connection string belongs in Git.

Reproduction: set `NAQL365_SYNTHETIC_RECOVERY=1` and run
`node scripts/test-store-local-recovery.mjs` on Windows with the cached PostgreSQL
17 image. This command only creates and removes its own isolated local containers.
The script contains no cloud export/restore path.

## Official references

- [Supabase CLI backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase SSL enforcement and CA configuration](https://supabase.com/docs/guides/platform/ssl-enforcement)

## Additional vault check

A subsequent hardening attempt stopped before backup because the Windows PowerShell
Set-Acl module could not load. The harness uses the supported .NET directory ACL API
instead; the final full drill passed with an owner-only inherited vault ACL. The
final restore/verification timings above supersede the earlier successful drill,
without relabeling the earlier metadata comparison failures. An independent observer
verified that both labeled containers and their two anonymous volumes were absent.
