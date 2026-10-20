# Commerce CI targeted remediation — local review

Date: 2026-10-20. Branch: `feature/unified-egypt-mvp`.

## Source and scope

Starting local/remote SHA: `6f81f2478ca342db9dac3d49fd0a952c2351af41`; clean working tree and accepted ancestry verified. Failed hosted Foundation run: [39404581302](https://github.com/Rmdn96/Naql365/actions/runs/39404581302). Passed Database Types run: [39404584021](https://github.com/Rmdn96/Naql365/actions/runs/39404584021).

Implementation commit: `ad4d2057f86b12eda98e0307dd84e596e0b9449e`. This report is a subsequent local documentation commit; the final proposed delivery SHA is returned separately. No push or cloud change was performed. Canonical application code, all database migrations, dependencies, environment/deployment configuration and financial rules are unchanged.

## Finding 1 — proven copy mismatch

`tests/e2e/store.spec.ts` expected the pre-Commerce homepage heading. Updated only the exact AR/EN expected strings to `كل ما تحتاجه للخطوة القادمة` / `Everything for your next move`. The exact-heading, Transport/Store navigation, paused catalog, accessibility and overflow assertions remain. Application copy is unchanged. The eight Store desktop/mobile E2E tests pass, including all four previously failing locale/device cases.

## Finding 2 — proven server ownership/cleanup defect

The Store and Commerce browser harnesses both used port 3017. Staff uses 3013. Each starts `scripts/guarded-next.mjs`, which runs Next.js through `spawnSync`. On POSIX, their cleanup terminated only the outer wrapper with `server.kill()`. A surviving Next.js descendant could retain the port across successive builds. Startup discarded server output and accepted any HTTP 200 from `/en/login`, without verifying that the newly spawned server was still alive. Thus an old listener could satisfy readiness while the new server failed to bind. This is a harness lifecycle defect, not evidence of missing commercial authority in production code.

A bounded real Linux Node 24 process experiment, using an already-installed Docker image with network disabled, reproduced the process mechanism:

```
parentOnlyCleanupLeavesServer: true
nextServerError: EADDRINUSE
oldReadinessWouldStillPass: true
```

The fixed helper was exercised against real nested Linux processes:

```
ownedGroupCleanup: true
portReusable: true
conflictingServerNotReusedOrKilled: true
earlyExitDenied: true
```

`browser-server.mjs` now rejects an occupied port before build/start, starts an owned detached POSIX process group, rejects early child failure, and terminates/verifies release of the whole owned server tree. Windows retains tree cleanup. Guarded build/start and environment attestation remain. The existing 60-second startup ceiling is retained; no browser assertion timeout, global timeout, retry count or business assertion was increased. Bounded readiness/port-release polling is conditional infrastructure health checking, not a sleep added to hide the failed product assertion. Unrelated listeners are neither reused nor terminated.

Staff, Store and Commerce share this lifecycle helper. Its two real-process unit tests cover nested-server teardown/port reuse, refusal to hijack another listener, and early-exit denial. The type declaration preserves strict TypeScript checks; no ignore directive or relaxed compiler option.

### Attribution limit

The actual hosted failure recorded zero product cards but did not capture the public RPC result or server startup stderr. The lifecycle defect and false-readiness mechanism are proven on Linux. A complete Linux Next.js/browser replay of the original empty-card failure was **not** completed locally. An intentionally retained-server experiment on Windows still passed the Commerce journey, so that is not represented as a reproduction of the hosted UI symptom. Linux application-tooling preparation encountered package/network limitations and was not treated as application failure.

This patch fixes the demonstrated ownership defect. Confirming that it fully resolves the hosted zero-card symptom still requires an explicitly authorized new exact-head CI run. It is not claimed that every possible fixture/server/application cause was independently ruled out in the original hosted process.

## Product lifecycle and boundary evidence

No synthetic product is hardcoded into the homepage. Existing local SQL fixture creates one supplier, approved agreement, published category, product/listing, approved supplier offer and retail price, typed policies and test-only organization grants. Existing eligibility and public projection enforce these authorities. No migration, RLS or publication rule changed.

The Commerce harness now records sanitized counts/codes before browser assertions. Standalone and post-Staff/Store execution both reported:

- Suppliers/products/published categories/approved prices/approved offers: one each.
- Eligible listing count: one.
- Anonymous public `store_shop_v1`: no error, AVAILABLE, one item.
- Homepage server response: HTTP 200, EG, one `.commerce-products .store-product` card.

The diagnostic contains no supplier cost, margin, customer record, credential or payment-account detail. The existing exact card-count assertion is retained. Any later hosted discrepancy can now be located between fixture authority, public RPC and application rendering instead of being labeled a timeout.

## Local verification

| Check                                                                       | Result                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone Commerce with authority diagnostics                              | 8 grouped checks PASS, cleanup and credential reuse denial PASS                                                                                                                                                                     |
| Exact browser ordering: Staff → Store → Commerce on the same local database | PASS, sequentially; no parallel fixture harnesses                                                                                                                                                                                   |
| Staff regression                                                            | All six Staff roles, AR/EN, normal login/refresh/navigation/denial/logout; owned fixture cleanup PASS                                                                                                                               |
| Store regression                                                            | 13 checks PASS, including dynamic catalog/images, checkout, immutable snapshots, proof denial and cleanup                                                                                                                           |
| Commerce after preceding harnesses                                          | 8 checks / 5 captures PASS; SQL/RPC one eligible product and homepage one card; cleanup=true; credentialReuseDenied=true                                                                                                            |
| Cart coverage                                                               | Homepage add, quantity badge, double-click prevention, quantity edit, navigation/refresh persistence, removal, consumed-cart reset, immutable order snapshot, cross-Customer isolation, guest login, paused product-mutation denial |
| Focused unit tests                                                          | 3 files / 14 tests PASS, including 2 new lifecycle tests                                                                                                                                                                            |
| Corrected Store E2E                                                         | 8 PASS, AR/EN × mobile/desktop; exact heading and security assertions retained                                                                                                                                                      |
| Local SQL/RLS                                                               | 12 files / 209 assertions PASS on local PostgreSQL 17                                                                                                                                                                               |
| TypeScript, lint, formatting, production build, whitespace                  | PASS                                                                                                                                                                                                                                |
| Tracked/history secret-pattern checks                                       | PASS; heuristic coverage only                                                                                                                                                                                                       |
| Linux process cleanup regression                                            | PASS in isolated network-disabled disposable container; container removed                                                                                                                                                           |

Local evidence: `test-results/staff-local-1792492761065`; Store `test-results/store-local-1792492961798/evidence.json`; final Commerce `test-results/store-local-1792493053223/{evidence.json,catalog-boundary.json,homepage-boundary.json}`. Evidence is ignored by Git. No local browser servers remain listening on ports 3013/3017/3000 after verification.

The first local build attempt failed on the missing declaration for the new JavaScript helper; a real declaration was added and typecheck/build then passed. No test was skipped or weakened. Accepted hosted evidence for 409 unchanged unit/integration tests, database reconstruction/types and unrelated concurrency/Driver behavior is reused rather than reported as a fresh full Foundation run. New hosted CI has not been run.

## Migration and security integrity

All 51 committed migration blobs match the accepted baseline. Migration 51 remains `20261019000200_store_catalog_management.sql`, SHA-256 `7acd143c5e5a3d35ef9f6633bd26e7c346d5c42d93fdbfe6a398546c0ab99d22`. No schema or generated database-type change. Existing Windows checkout EOL differences were not rewritten and are not claimed as literal raw-checkout byte equality.

The known development-tool braces advisory remains unresolved. The exact unchanged lockfile's preceding same-day audit reported zero runtime advisories and five affected High development packages along one advisory chain. No dependency change, audit fix or claim of remediation.

## Changed files and remaining actions

- `tests/e2e/store.spec.ts`: exact approved copy.
- `scripts/browser-server.mjs`, `scripts/browser-server.d.mts`: test server lifecycle and types.
- `scripts/test-staff-workspace.mjs`, `scripts/test-store-workspace.mjs`: use owned lifecycle; existing business/security assertions preserved.
- `scripts/test-commerce-workspace.mjs`: owned lifecycle plus sanitized authority/RPC/homepage boundary diagnostics; all eight grouped assertions preserved.
- `tests/unit/browser-server.test.ts`: real nested-process regression coverage.
- This report.

GO for owner review of the local patch and proposed SHA; NO-GO for alias handoff until a separately approved push and exact-head Foundation/Database Types pass, including hosted Commerce. Do not infer hosted success from this local run. If hosted product visibility still fails, use the new boundary evidence before changing application behavior.

All test identities/fixtures and disposable containers were cleaned. Automatic execution review rejected deletion of the separate local source/dependency tooling copies, returning only `blocked by policy`, including a verified literal-path attempt. No bypass attempted. Retained copies are `C:/Users/DELL/AppData/Local/Temp/naql365-commerce-linux-deps` and `C:/Users/DELL/AppData/Local/Temp/naql365-commerce-linux-source.tar`; they contain repository source/dependencies, not live customer data, credentials or backups. This is separate from successful test-account/database cleanup.

No Git push/merge, Staging or Production writes/access, migration application, Vercel deployment/alias/configuration changes, real publication/payments, operational grants, Hostinger/DNS change or paid resource.
