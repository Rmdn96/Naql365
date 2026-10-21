# Transport public catalogue fixture contract correction — 2026-10-21

## Proven cause

Starting branch: `feature/unified-egypt-mvp`; clean local and remote HEAD `69fe669849994a594fd6ce66308545b4b6260ebc`.
Hosted reference: Foundation `39551253325`, Types `39551257936`, artifact `12324425239`.

The retained Guest concurrency fixture exposes the Phase 2 Transport catalogue through `private.customer_enrollment`. `phase2.test.sql` generated market, region and city identifiers using `md5(...)::uuid`. PostgreSQL's UUID type accepts these arbitrary 128-bit values. They do not necessarily contain the UUID version/variant bits required by the existing `z.uuid()` response contract.

With the original fixture, the actual anonymous `public_market_catalogue()` response failed the unchanged application validator at exactly:

| Field path         | Issue            | Expected    | Actual | Classification      |
| ------------------ | ---------------- | ----------- | ------ | ------------------- |
| `[0].id`           | `invalid_format` | UUID string | string | Invalid UUID format |
| `[0].cities[0].id` | `invalid_format` | UUID string | string | Invalid UUID format |
| `[0].cities[1].id` | `invalid_format` | UUID string | string | Invalid UUID format |

No payload values are retained in this report. All other response fields validated. The authoritative SQL projection returns stored IDs unchanged. Generated types declare the JSON RPC as `Returns: Json`; they cannot establish its nested runtime contract. Production table defaults use `gen_random_uuid()`; this demonstrated defect originates in the synthetic fixture generator, not Store publication or a missing field in the RPC.

Guest concurrency deliberately retains its disposable local fixtures until final teardown. Staff and Store cleanup only their own organizations and therefore correctly leave that enrolled Transport organization intact. On an isolated Commerce run without that prior fixture, the Transport catalogue is empty and parses successfully. This accounts for the local/hosted difference without attributing it to Linux or browser timing.

## Correction

Only test fixture generation changes: a session-local `pg_temp.phase2_fixture_uuid` produces deterministic custom UUIDv8 identifiers by setting version and variant bits. All Phase 2 fixture references use the same generator, including the manual-pricing harness's namespace substitutions. No extra extension is required. The helper exists only in the test connection and is not an application migration, permission or RPC.

`src/` is unchanged. Strict Zod validation, error propagation, SQL RPC, Auth/RLS, pricing, Store/Finance/payment authority and all 51 migrations are unchanged. No cleanup assertion, timeout or browser assertion was weakened.

## Regression and reproduction

Added `tests/integration/transport-catalogue-contract.test.ts`. It reconstructs the database, loads the exact shared Phase 2 fixture, enables its synthetic enrollment as the Guest harness does, switches to `anon`, executes the real SQL RPC, and sends that result through the real `publicCatalogue()` parser. Only the Supabase transport boundary is adapted to the embedded PostgreSQL query. The test asserts one market, one service and two cities; empty fallback cannot pass.

The regression was run before the correction and failed with exactly the three UUID issue paths above. It passes after correction. All 58 tests in the six dependent integration files pass.

Before correction, the complete sequence was reproduced against isolated local PostgreSQL: schema reconstruction → 12 SQL/RLS files → eight concurrency scripts → Staff (60 captures PASS) → Store (13 groups/eight captures PASS) → Commerce FAIL. Commerce direct Store RPC had one eligible product; homepage HTTP 200 showed the route error boundary, SSR zero and DOM zero. Cleanup and credential-reuse denial passed. Its runtime trace first throws `ZodError` at `public-catalogue-parse`, matching hosted evidence.

Pre-fix Commerce evidence: `test-results/store-local-1792567567882/`. Sanitized issue evidence: `test-results/transport-contract/rejected-contract.json`.

Local setup initially lacked the pgTAP extension after reset; installing it in the disposable local database enabled the normal SQL test suite. An intermediate fixture-edit delimiter error was corrected before successful validation. These were local setup/edit failures, not alternate causes of the accepted hosted defect.

## Boundaries and next step

No cloud database access/writes, migration edits, Git push, deployment, merge, Vercel/Hostinger/DNS changes, Store activation or Lovable integration. Local reconstruction and fixture writes used only the existing isolated synthetic PostgreSQL environment.

A separately authorized exact-head hosted Foundation and Database Types run is required before claiming hosted resolution. No application or migration deployment is needed for this fixture-only correction.

## Final local verification

- Full unit/integration suite: **455 PASS in 92 files** (`vitest --maxWorkers=2`); no assertions removed. The six directly affected integration files separately passed 58 tests.
- Clean local schema reconstruction: **51 migrations PASS**. All 12 SQL/RLS files PASS.
- Exact ordered concurrency sequence: Store catalog, Operations, Driver, Tracking, Payment, Store purchase, Manual pricing and Guest — **all eight PASS**.
- Ordered browser sequence: Staff **60 captures PASS**; Store **13 groups/eight captures PASS**; Commerce **all eight groups/five captures PASS**. Browser harnesses each complete a guarded production build.
- Commerce direct Store RPC: one eligible item. Transport catalogue RPC HTTP 200 and parsing READY. Homepage composition READY. Store projection/render: one item. SSR HTML: one card. Browser DOM: one card; error boundary not visible. All ownership, paused mutation denial, cart, checkout reset and credential reuse assertions remain intact.
- TypeScript, ESLint, formatting, tracked-file and history secret scans: **PASS**. Scans are heuristic, not exhaustive proof of absence of all secrets.
- Browser fixtures cleaned and deleted credentials rejected. Guest/manual concurrency fixtures intentionally remain until local teardown; final local schema reset removes those disposable fixtures after evidence capture.

Post-fix Staff evidence: `test-results/staff-local-1792568056751/`.
Post-fix Store evidence: `test-results/store-local-1792568296163/`.
Post-fix Commerce evidence: `test-results/store-local-1792568380659/`.
Commerce `ssr-boundary.json` SHA-256: `7003e15ccd896592d00e83e3197bced43b74dc2419ba8a6b7f8152c32e2dd83e`.
Zero rejected diagnostic records. A late generic route-error observer event remains, as in prior passing local evidence; no browser assertion failed. Its trigger is unproven and is not claimed fixed. It is distinct in evidence from the initial Transport parsing failure: initial parsing/composition and product assertions now pass.

All 51 migration Git blobs remain identical to the accepted source. Migration 51 SHA-256 remains `7acd143c5e5a3d35ef9f6633bd26e7c346d5c42d93fdbfe6a398546c0ab99d22`.

Changed files: `supabase/tests/phase2.test.sql`, `tests/integration/transport-catalogue-contract.test.ts`, and this report. No `src/`, migration, dependency or workflow change.

Recommendation: **GO for separately authorized exact-head hosted CI**, not deployment. The fixture defect is proven and the complete relevant local sequence now passes. Hosted resolution must still be verified against the new commit.
