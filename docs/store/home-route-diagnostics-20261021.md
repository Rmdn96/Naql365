# Home route failure diagnostics — 2026-10-21

## Result

The hosted homepage exception is **not reproduced or identified locally**. This is a diagnostic-only delivery, not a root-cause fix. A separately authorized exact-head hosted run is required.

Starting branch: `feature/unified-egypt-mvp`.
Starting local and remote SHA: `eae5789f6894d2741e1d80e3cc924e0f61a5eeeb`.
Preflight found a clean tree and one registered worktree, with no overlapping Lovable edits. No new visual integration was performed.

Hosted reference: Foundation `39511181166`, Types `39511187479`, restricted artifact `12306196589`. The prior inspected artifact showed startup readiness, direct anonymous Store RPC AVAILABLE with one product, but zero SSR/DOM cards and the homepage route error boundary. It did not identify the throwing dependency. Missing Store traces alone do not implicate `publicCatalogue`.

## Execution and instrumentation

Home resolves locale, runs `selectedPublicCountry()` and `publicCatalogue()` concurrently, selects Transport services/cities, resolves canonical origin and nonce, then creates JSX containing Landing and StoreIntroduction. StoreIntroduction runs later during React rendering. Metadata is a separate route prerequisite.

Added bounded stages: home entry and locale, market selection, Transport public catalogue, catalogue client/RPC/parser, and JSX composition. The existing Store client/RPC/projection/render diagnostics remain. Composition success means JSX was created, not that all descendants rendered successfully.

Next.js `onRequestError` observes only opted-in local AR/EN homepage render errors. It records an allowlisted exception class and, for AppError, an approved code. It does not export messages, stacks, request paths, headers, cookies, payloads or arbitrary error properties. Classification failure falls back to Unknown. Original exceptions are rethrown unchanged; no retry or fallback was introduced. The browser artifact additionally records whether the known English route-error heading is visible.

The existing file collector, structured stdout channel, quotas and failure artifact upload are reused. No workflow or cache configuration changed. `if: always()` still includes `test-results/store-local-*/`.

## Local evidence

| Check                                              | Result                                                        |
| -------------------------------------------------- | ------------------------------------------------------------- |
| Focused homepage/SSR/Commerce/lifecycle unit tests | 57 PASS in 10 files                                           |
| Windows complete Commerce                          | 8/8 groups, 5 captures, cleanup PASS, credential reuse denied |
| Linux-built Next.js complete Commerce              | 8/8 groups, 5 captures, cleanup PASS, credential reuse denied |
| Windows final guarded production build             | PASS                                                          |
| Linux guarded production build/start               | PASS                                                          |
| TypeScript, ESLint, formatting                     | PASS                                                          |
| Secret pattern/history scans                       | PASS; heuristic checks, not exhaustive proof                  |

Windows evidence: `test-results/store-local-1792560259963/`.
Direct Store RPC one; runtime Transport catalogue RPC HTTP 200; parser success; home composition success; Store projection one; render input one; SSR one; browser one. No runtime throw records. 150 file records, 130 stdout records, zero rejected. The extra 20 file records came from build-time probing, whose captured stdout is not forwarded by the Windows harness. Build-phase market exceptions are not runtime failure evidence.
`ssr-boundary.json` SHA-256: `a2d297bd37929da45f24ff6c7a25c19dba846a04824092b87754a99f1d03596a`.

Linux evidence: `test-results/store-local-1792560374296/`.
Direct Store RPC one; SSR one; DOM one; routeErrorVisible false on the initial guest page. 151 file and stdout records, zero rejected. One late `route-error / Error` record was observed after the application diagnostic sequence reached its existing cap. All browser checks passed; this event's exact trigger is unknown and must not be represented as reproduction of the hosted missing homepage.
`ssr-boundary.json` SHA-256: `b9cdfc29b3e84dea3b656f883938e9b97bf45054aebfb387135095c914287568`.

Linux used the cached Node 24 Alpine container, matching Next.js 16.3.8, copied canonical source, isolated build/start, a loopback proxy to the existing local synthetic Supabase, and the same fixture/assertions. Browser execution remained Windows. The container was removed. This is not a full Ubuntu GitHub-runner reproduction, nor a rerun of the entire preceding SQL/concurrency/Staff/Store pipeline. The Linux snapshot preceded only a defensive classifier exception guard subsequently unit-tested; homepage behavior was identical. The final Windows build includes that guard.

Deliberate-failure tests prove that a thrown homepage-stage TypeError is written to the real file collector and retained in the machine-readable artifact before test cleanup, without its private message. Tests also cover market/catalogue/composition failures, response parse failure, RPC failure, exact exception identity, no retries, local opt-in, and request-data exclusion. Existing early-failure artifact retention tests remain passing. Hosted upload completion can only be verified in the next hosted run.

## Integrity and boundaries

All 51 migration Git-clean-filter content hashes match the starting SHA; no migration file was edited. Migration 51 SHA-256 remains:
`7acd143c5e5a3d35ef9f6633bd26e7c346d5c42d93fdbfe6a398546c0ab99d22`.

No changes to UI markup content, business rules, Auth/RLS, pricing approval, payment authority, supplier confidentiality, database types or dependencies. Unchanged Transport/Finance/Driver evidence was reused. No cloud DB access or writes, Git push, deployment, alias change, merge, Production/Hostinger action or operational activation occurred. Only existing isolated local synthetic harness fixtures were used and cleaned.

## Next step

GO for separately authorized exact-head hosted diagnostic verification; NO-GO for declaring the hosted defect fixed or handing off a Preview based on these results.

Compare the first runtime home request, not build probes: entry → locale → market/catalogue → RPC/parser → composition → Store projection/render → SSR/DOM. If entry is absent but the route-error hook fires, inspect the route prerequisites outside Home. If an operation throws, use its stage/classification and preserve the failure. A generic Error alone is not a proven internal cause. Keep the existing assertions and always-upload artifacts. No speculative business fix is proposed.
