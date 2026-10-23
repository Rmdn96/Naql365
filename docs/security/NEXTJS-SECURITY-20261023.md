# Next.js runtime security remediation — 2026-10-23

## Baseline and scope

Accepted parent: `0ac5aab8d55ba01fdf48bd2a72dbb4516c25e41f` on `feature/unified-design-system-phase-4`. Isolated implementation branch: `feature/nextjs-security-remediation`.

Next.js changes from **16.3.8 to exactly 16.4.1**, the first patched Next.js 16 release named by all three vendor advisories. Node 24.18.0 satisfies Next's `>=20.9.0` engine requirement. Existing React/React DOM 19.2.8 satisfy its peer range and remain unchanged. No codemod, application compatibility change or new dependency is required by local build/type/lint validation.

## Official advisory review

| Advisory                                                                                         | Vendor patched version | Project observation                                                                                                                                    | Remediation                                                        |
| ------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) | 16.4.1                 | No `use cache` directive or Cache Components configuration found; vendor still recommends upgrading.                                                   | Installed Next version leaves the affected range ending at 16.4.0. |
| [GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) | 16.4.1                 | Image optimization is used; existing Sharp 0.35.5 already satisfies the vendor workaround. Windows testing does not reproduce the Linux/glibc exploit. | Upgrade Next; retain fixed Sharp.                                  |
| [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) | 16.4.1                 | App Router and Server Actions are present.                                                                                                             | Upgrade required; no application workaround substituted.           |

## Exact dependency scope

Only the root `next` pin changes. The lockfile updates `next`, `@next/env`, and the eight required `@next/swc-*` platform packages from 16.3.8 to 16.4.1, with corresponding registry integrity records. Every other lockfile package record is unchanged.

React, React DOM, Sharp, TypeScript, Tailwind, ESLint and `eslint-config-next` remain pinned to their accepted versions. The existing lint configuration has no Next runtime peer requirement and passes local validation; its package version is not a duplicate Next runtime. There is one installed Next runtime and one lockfile Next path.

Fresh `npm ci` succeeds in the new worktree. npm emits existing ESLint support/deprecation and unrs-resolver script-allowlist warnings; no npm allowScripts policy is changed. No forced audit fix, broad upgrade or override is used.

## Audit boundaries

Fresh runtime audit (`npm audit --omit=dev --json`): **zero reported vulnerabilities**, including zero Critical/High. All three named advisories no longer include the installed Next version. This is a version/graph/vendor-advisory verification, not an exploit test or complete security certification.

Full dependency audit still reports **8 development-only findings: 6 High and 2 Moderate**. Affected package chains include braces, micromatch, fast-glob, the existing Next ESLint tooling, Vite, Vitest and its mocker. The braces advisory is not represented as remediated. Those toolchain changes require a separate scoped review.

## Preservation and evidence

Application source, tests, design assets, business/security services, Auth actions, API/RPC contracts, build/deployment configuration, all 51 migrations and generated database types are unchanged. No new migration is created or applied to Supabase. Existing isolated test fixtures are used only locally; no cloud account, role, data or environment is accessed or modified.

The external evidence directory is `deliverables/naql365-nextjs-security-20261023/` at the workspace root, outside this checkout. It contains vendor-review metadata, exact dependency diffs, clean-install receipt, complete audit JSON, test logs/results, local SQL evidence and Customer visual comparison hashes. Original Phase 1–4 and Lovable worktrees remain preserved.

## Local validation outcome — BLOCKED, no commit

- Runtime audit: **0 vulnerabilities**. Full audit: **8 development-only findings** (6 High / 2 Moderate), unchanged toolchain scope.
- Full unit/integration: **494/494 PASS**; Transport UUID and bilingual quote-state regressions retained.
- Customer presentation: **78 captures, 10 quote states, 2 profile-feedback checks PASS**; all 78 captures pixel-identical to accepted Phase 4 references.
- Transport presentation: **4 Guest/Customer AR/EN journeys, 48 captures, 20 quote-state checks PASS**.
- Real isolated-local Commerce: **8/8 PASS**; RPC/SSR/DOM each show one eligible product. Cleanup and deleted-credential reuse denial PASS; local Auth/product/order/fixture counts return to zero.
- Local SQL/RLS: **12/12 original native assertion bodies PASS**, rollback transactions. Unavailable pgTAP display calls are omitted; no fresh hosted pgTAP total is claimed.
- Production build, TypeScript, ESLint, formatting and secret-pattern scans PASS.
- Generic E2E: **89 PASS / 1 FAIL**, zero retries and unchanged assertions/deadlines. The Arabic mobile Customer unavailable-state test stops at `tests/e2e/customer-design.spec.ts:24` waiting for the theme control to become enabled.

The retained trace records a script request for `/_next/static/chunks/209aaqjv6z8gh.js` failing with **`net::ERR_NO_BUFFER_SPACE`** before hydration. The homepage/account HTML returns HTTP 200, the built chunk exists, and the final theme control remains disabled/aria-busy while the cart remains loading. The precise underlying OS resource limit and reproducibility are not established. This is not evidence of a missing build asset or a proven Next.js application regression.

No speculative application fix, assertion change, timeout increase or retry is made. As required on validation failure, the dependency/documentation changes remain **uncommitted** on the isolated security branch. Git HEAD remains the approved parent. **NO-GO for hosted CI until the required generic E2E gate is completed after separately authorized bounded resource diagnosis/revalidation.** No further code change is justified by current evidence.

NAQL365 — NEXT.JS SECURITY REMEDIATION BLOCKED

## Latest bounded diagnosis and acceptance — READY FOR CI

This section supersedes the earlier blocked acceptance checkpoint, while preserving its evidence and history.

- The prior trace proves a failed JavaScript request (`net::ERR_NO_BUFFER_SPACE`) before Customer hydration. The underlying OS resource cause remains unproven.
- Read-only snapshots found no competing test harness or app listener before execution. Dynamic TCP ports remain 49152–65535; current connection counts do not demonstrate exhaustion. Free physical memory ranged roughly 781–1109 MB of 8050 MB. No matching TCP exhaustion events were returned. Memory performance counters are unavailable and are explicitly treated as unknown, not zero.
- No registry, network configuration, firewall, antivirus or resource limit was changed. Unrelated processes were left running. Only owned temporary loopback test servers were created and stopped.
- The exact Arabic mobile Customer test executed once in isolation: **1/1 PASS**, original 30-second timeout and browser settings, zero retries. Its trace records the chunk loading HTTP 200, 14 JavaScript requests, no failed script and no `ERR_NO_BUFFER_SPACE`. A separate single GET returned identical built bytes/checksum and JavaScript MIME type.
- The unchanged full generic suite then executed **once: 90/90 PASS**, one worker, zero retries and unchanged assertions/deadlines. The previously failing Arabic mobile case passed within that run in 2.8 seconds. The original failure was not reproduced; this does not prove it is permanently eliminated.
- A fresh runtime audit again reports **0 vulnerabilities**; full audit still has **8 development-only findings** (6 High / 2 Moderate). Next remains exactly 16.4.1; its clean-install lockfile hash and exact ten-package Next/env/SWC scope are unchanged.
- Recent identical-source/dependency evidence is explicitly reused: **494/494 unit/integration**, production build, TypeScript, ESLint, Customer/Transport/Commerce and SQL/RLS checks. The evidence manifest records source/dependency and artifact hashes. No claim of a fresh rerun is made for those suites.
- Formatting and secret scans are refreshed for this completed report. All 51 migrations, generated database types, application/test source and approved Lovable assets remain unchanged.

New evidence: `deliverables/naql365-nextjs-browser-diagnosis-20261023/` outside this checkout. Prior failed-run evidence remains intact. One initial CLI selection matched no tests; it was corrected before the single actual isolated test execution, without changing a test.

**GO for separately authorized exact-head hosted CI**, including Linux/native dependency verification. No push, merge, deployment, cloud database operation or commercial activation is authorized by this local completion. The original intermittent resource cause remains a documented observation for future CI diagnosis; no application workaround or weakened assertion was introduced.

NAQL365 — NEXT.JS SECURITY REMEDIATION READY FOR CI
