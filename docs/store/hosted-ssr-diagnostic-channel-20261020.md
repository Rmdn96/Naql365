# Hosted SSR diagnostic channel repair — 2026-10-20

## Scope and baseline

Branch: `feature/unified-egypt-mvp`.
Starting local and remote commit: `65a9b0da08a50f1d855bd3ba36b27735c937e6ce`.
The working tree was clean; the sole registered worktree had no overlapping UI changes.
This delivery adds diagnostic evidence only. It does not establish or fix the hosted product-visibility root cause.

Previous hosted evidence: Foundation `39463231308` failed Commerce; Database Types `39463290141` passed. The direct anonymous RPC returned one eligible product while SSR HTML and the DOM contained zero product cards. No server diagnostic records were captured.

## Proven diagnostic limitation and repair

Previously, `ssr-boundary.json` was created only from a stdout callback. That callback accepted only lines starting exactly with `CATALOG_SSR `. There was no independent server startup acknowledgement or artifact when zero lines arrived. This explains the missing artifact mechanically, but does **not** prove why hosted server records were absent. ANSI/indentation handling is defensive; no claim is made that it caused the prior failure.

The opt-in diagnostic channel now:

- Acknowledges initialization and readiness inside the actual Node.js Next.js instrumentation hook, around the existing environment attestation. Those protections remain unchanged.
- Emits strict allowlisted records with build-ID digest, build/runtime phase, process ID, request-local numeric ID, bounded sequence, stage and result classification.
- Records client initialization, RPC start/response/throw, response validation, approved projection count, component input count and existing fail-closed fallback classification. Original exceptions and results retain their semantics.
- Writes independently to a harness-owned `test-results/store-local-<timestamp>/ssr-server.ndjson` file. It also retains the structured stdout channel. Writes are gated by `APP_ENV=local` and explicit diagnostic opt-in. The sink is restricted to the ignored local evidence directory, bounded to approximately 64 KiB and 128 records per module instance; the collector accepts at most 256 records per channel. Instrumentation and application bundles may each have their own sequence; use phase/process/request/stage together.
- Creates `ssr-boundary.json` before build/start and refreshes it during capture and in catch/finally, including an empty artifact if startup never emits. Startup readiness is checked independently before fixture/product assertions.
- Preserves direct RPC, final SSR HTML and DOM counts in the existing separate machine-readable boundary files. No catalog response, credentials, cookies, personal data, supplier prices, raw exceptions or arbitrary exception fields are recorded.
- Retains an unauthenticated local failure screenshot only before the first synthetic login. Native Playwright traces are intentionally excluded because they may retain headers and submitted values; the sanitized structured boundary timeline is the retained trace. Failure metadata records screenshot availability.

The existing Foundation `if: always()` artifact upload already includes `test-results/store-local-*/`; no workflow edit is necessary. Local tests cannot prove GitHub upload completion; that remains part of the next exact-head hosted verification.

## Local evidence

Successful complete Commerce run: `test-results/store-local-1792517869846/`.

- Direct RPC: AVAILABLE, one eligible product.
- Actual server: ready acknowledgement, client ready, RPC HTTP 200, validated projection one, component input one.
- Response HTML: one product card. Browser DOM: one product card; EG selected.
- Eight grouped Commerce checks and five AR/EN mobile/desktop/theme captures passed, including add-to-cart, quantity badge, persistence, removal, customer isolation, guest login, checkout reset, Transport CTA and paused mutation denial.
- Cleanup and deleted-credential reuse denial passed.
- Artifact contained 130 validated server-file records and 130 stdout records, zero rejected records. Startup ran in the same actual Next.js process as catalog requests. Records are synthetic local diagnostics only.

Deliberate final failure run: `test-results/store-local-1792518114547/`.
The harness-only `NAQL365_COMMERCE_DIAGNOSTIC_FAILURE=1` switch fails after the unchanged direct-RPC/SSR/DOM eligibility assertions, before authentication. This tests evidence retention; it does not alter server responses, database authority or mark the run successful. Observed result: exit code 1 with `SIMULATED_DIAGNOSTIC_FAILURE`; ten server-file records and ten stdout records, zero rejected records, structured artifacts and guest screenshot retained. Cleanup and credential reuse denial both passed. The guest screenshot was visually inspected and contains only the public synthetic catalog.

Focused regressions cover file retention on early failure, stdout loss, ANSI/split stdout lines, output caps, malformed/extra/private fields, staging/production gate denial, owned server lifecycle, exact exception rethrow, product rendering and cart projection. Existing business assertions remain intact. No waits, retries or timeout increases were added.

Focused unit/regression validation: 36 tests across six files passed. The complete Commerce run and the deliberate failure run each completed a guarded production build successfully. Final TypeScript, ESLint, repository formatting, tracked secret-pattern and history secret-pattern checks passed. No hosted run was started in this task.

## Migration and security integrity

All 51 accepted migration Git blobs remain identical. Nine existing Windows working copies use CRLF relative to their LF Git blobs; the comparison confirms only checkout line endings and identical Git-clean-filter hashes. No migration file was edited.

Migration 51: `20261019000200_store_catalog_management.sql`.
SHA-256: `7acd143c5e5a3d35ef9f6633bd26e7c346d5c42d93fdbfe6a398546c0ab99d22`.

No UI design, catalog authority, pricing, Finance, session, cache, environment decision, permission or schema changes. No dependencies changed. The pre-existing development-tool advisory is not claimed remediated. Secret scans are heuristic checks, not proof of every possible secret format.

Only the existing isolated local synthetic test database was used by the requested harness, with verified cleanup. No cloud database access/writes, Git push, merge, deployment, alias change, Production access or Hostinger action occurred.

## Changed files

- Server initialization: `src/instrumentation.ts`.
- Strict event contract and local-only transport: `src/infrastructure/store/catalog-diagnostic-schema.ts`, `src/infrastructure/store/catalog-trace.ts`.
- Boundary calls only: `src/infrastructure/store/service.ts`, `src/components/store/introduction.tsx`.
- Owned-server stdout handling and durable evidence collection: `scripts/browser-server.mjs`, `scripts/catalog-evidence.mjs`, `scripts/catalog-evidence.d.mts`, `scripts/test-commerce-workspace.mjs`.
- Focused regressions: `tests/unit/browser-server.test.ts`, `tests/unit/catalog-evidence.test.ts`, `tests/unit/catalog-trace.test.ts`, `tests/unit/store-ssr.test.ts`.
- This evidence report. No workflow, dependency or migration changed. UI markup and styles remain unchanged.

## Next authorized hosted verification

Obtain separate approval for the final local commit. Verify an approved deployment-prevention mechanism before any future push; do not assume a Git push cannot deploy. Run Foundation and Database Types on that exact SHA, retaining the existing always-upload evidence step.

Compare startup acknowledgement, file versus stdout channels, correlated request records, direct RPC, projection, component input and final HTML/DOM. If startup records are absent, stop at channel initialization. If client/RPC/projection fails, use its classification rather than changing catalog authority. If the hosted run still fails, preserve the failure and report the first proven boundary; no speculative application fix is authorized by this delivery.

Recommendation: GO for separately authorized hosted diagnostic verification; NO-GO for declaring the original hosted root cause fixed or handing off a Preview on this evidence alone.
