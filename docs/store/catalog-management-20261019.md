# Store UI and dynamic catalog — local owner review

Status: STORE UI & DYNAMIC CATALOG READY FOR OWNER REVIEW. Local-only; no deployment or commerce activation authorization.

## Source and boundaries

- Branch: feature/unified-egypt-mvp. Clean starting local/remote HEAD: baa6759a2f12c2ad0344a2a8f64b0eada72f649d. A later remote read still returned that SHA.
- Intake commit: c3adaecfe7c35269c3953f6007c9f3691eca0bf4.
- Catalog contracts: f4a0468f1031a3730f191a6ac8684839b5c18e4f; pending-image review follow-up: b1803e99a18a76cdf8f2ff0ef8a2ff00d0838ec1.
- Application implementation: 777bfd44e975bf038dd9ef06e4b1d5306f65cc4d. The delivery commit adds this evidence only.
- No push, merge, cloud database write, permission activation, product publication, payment activation, deployment, Production access, DNS or Hostinger action was performed.
- Pre-edit Preview observation: protected canonical alias pointed to dpl_3F1HSGR57BGejSZAr2eUDhJ61b7d at the accepted starting release. This task does not deploy the new source.
- Accepted baseline hosted CI 39250645685 / 39250667051 is reused for unchanged behavior, not claimed as CI for these new commits.

## Design-lab reference

The existing Lovable project 45d7c85b-e937-48ee-8d57-251cc16a57b8 was inspected read-only at design revision 64f7e4dc9a355863ce3258f24e36851970dad8b9, including store-preview.tsx and store-admin-preview.tsx. That revision is a design artifact, not a canonical Git commit. Semantic product cards, coherent Store navigation and separation of internal/retail presentation were retained. TanStack routing, demo selectors, placeholder business data, demo permissions and simulated command results were not imported. No generation, project creation or lab publication was performed.

## Customer-facing integration

Desktop/mobile navigation, footer and the Transport hero now link to Store even while commerce is paused. A dedicated homepage section presents Transport plus packing supplies immediately after the hero. Featured cards and category links use only existing approved public database projections; they are absent when authority is unavailable. No intake drafts or synthetic fixtures are imported by runtime code.

Existing catalog, product details, category/search query views, cart, registered checkout and independent Store order/history routes remain authoritative. Customer navigation now distinguishes Transport requests, Store orders, Shop again and Cart. SA preferences and existing authorization remain intact; Saudi Store commerce is not enabled.

The paused experience is visible and explicitly non-purchasable. It is not labeled Coming Soon. No supplier agreement, price, tax, delivery, checkout or payment authority is invented. AR/EN, RTL/LTR and semantic Light/Dark/System styles are retained.

## Dynamic administration

Authorized Staff can create additional products beyond the 30 intake proposals, define permanent SKU/slug, edit bilingual draft names/descriptions, select category and manage up to 30 bilingual public specification rows. Specification labels support units, package quantities, dimensions in cm, ply and NEW/USED condition; unprovided facts remain unspecified. Existing SKU/slug identity stays immutable.

Categories can be created, edited and approved again after edits or suspension. Product pause/resume and listing publication use existing governed commands and actual revision references. Editing draft content does not publish it. Approved prices remain frozen; changing retail requires a new version and approval. Search/state filters run before server-side keyset pagination; page counts describe displayed rows only.

Catalog, categories, publication/images and retail tabs require canonical catalog access. Supplier reference/entitlement/supplier/agreement tabs require both sourcing management and supplier-cost visibility. Policy metadata requires policy management. Direct routes and commands independently enforce permissions, organization and selected EG Market; Transport permissions do not grant Store access. Existing Staff navigation still gates orders, Store payments and reconciliation independently.

### Three-price contract

A is an immutable internal supplier public-reference observation, including unconfirmed/null amounts. B remains the versioned contractual supplier offer under an approved agreement. C remains a separately approved retail-price version, and is the only product selling price projected publicly. No markup, margin percentage, copied cost or automatic retail is applied.

An authorized sourcing view can show C minus B only for the actual approved selected offer/price pair. It is labeled a provisional product difference before delivery/tax allocations, with both versions, never net profit. Approved order snapshots and Migration 50's fee/tax/entitlement allocation remain authoritative for Finance and reconciliation.

### Product media

The dedicated private store-product-media bucket and registry are separate from payment proofs. Authorized image uploads require a rights reference, JPEG/PNG/WebP signature validation, a bounded multipart body, at most 4 MiB input and 40 million decoded pixels. The server strips metadata and produces bounded WebP (at most 1600px and 2 MiB), verifies stored bytes against the upload hash and finalizes an immutable UUID object.

Uploaded READY drafts remain discoverable after Refresh for a later publisher; the server returns at most 20 unattached candidates per listing. Publication requires catalog manage plus publish, bilingual alt text, at most five distinct authorized images and a matching listing revision. Replace/reorder removes a selection, not historical bytes. Images are not publicly readable merely because upload succeeded.

A same-origin validated image endpoint and Next.js custom loader provide bounded responsive widths (64–1600). Reads recheck registry-backed RLS and return private/no-store headers; paused, unpublished or unauthorized images are denied. Caller-controlled remote URLs, paths and proof-bucket selection are not accepted.

## Owner catalog and photographs

See [intake summary](catalog-intake/README.md), [30 bilingual proposals](catalog-intake/initial-products.eg.json) and [photo inventory](catalog-intake/image-import-manifest.json). All 30 amounts are A only; every B and C is null. No import/seed/publication was executed. NEEDS_DETAILS is an intake flag, not a new database publication state. Products 3, 10, 25, 26 and 28 need clarification.

Five of ten mentioned original photographs were actually transferred. Their original bytes and SHA-256 values are retained for internal review. Candidate matches: 50×50×70 to product 5; six 300m tape rolls to 16; foam 100m/2mm to 14. The 30×30×40 photograph needs orientation/dimension confirmation before matching 8. The used 38×38×58 photograph must not match listed used product 3 (40×55×35). No photograph was published. Five other original files and publication rights/matches remain owner inputs.

## Local additive Migration 51

- File: [20261019000200_store_catalog_management.sql](../../supabase/migrations/20261019000200_store_catalog_management.sql).
- SHA-256: 7acd143c5e5a3d35ef9f6633bd26e7c346d5c42d93fdbfe6a398546c0ab99d22.
- Two private tables: store_supplier_reference_prices and store_product_media; composite scope FKs, bounded values, indexes, RLS, raw-access revocation and immutable history triggers.
- New public RPCs: store_catalog_admin_v2 and store_catalog_extension_v1. Existing store_catalog_ui_command_v1 retains its signature and forwards sourcing commands to the existing governed implementation.
- Existing organization catalog mutex, authorization recheck, durable command receipts and audit events are reused. No Finance command, posting or payment rule is changed. No new permission definition, global role grant or Store scope seed is added.
- The new bucket is private, with purpose-specific SELECT/INSERT policies and no customer update/delete policy. It is installed locally only.
- Migrations 1–50 retain their exact accepted Git blobs. Migration 48: 0816abc8bf7ef64258adfddc7f92633786b8d30bff9c00453caecfbb37459ebd; 49: 4869cf60cffeae5696d22d16c4d13c439c3ca07ed538a47e18ec9bee0691ca99; 50: 179c4b9aca3e097146fe0638453efd24b73cf05b7b06954d748547f74081e3b6. Existing Windows checkout EOL differences are recorded by the integrity script and were not rewritten.

Migration 51 has NOT been applied to Staging. The new admin/media contract requires separate schema approval before deploying this application. Application rollback to the accepted release can leave unused additive objects in place; do not run a destructive automatic down migration or delete uploaded history.

## Verification

- Focused unit/integration: 294 PASS in 57 files, including all unit tests, catalog governance, media validation, Store purchasing/security and new catalog-management SQL reconstruction in PGlite. Unchanged historical integration evidence is reused; this is not a claim that every unrelated Vitest integration file was rerun successfully.
- Full local PostgreSQL 17 reconstruction: 51 migrations installed. Official Supabase CLI public database types generated.
- Full SQL/RLS files: 12 PASS; management contributes 31 assertions, including a product outside the intake set, >30 products with correct filtered pages, stale revisions, private costs, reference replay, selected provisional difference, draft-media discovery and public denial.
- Catalog concurrency: 13 scenarios / 12 independent barrier races; checkout/receipt concurrency: 4 scenarios. Final artifact rechecks are recorded in the accompanying evidence.
- Real local Store browser: 13 checks / 8 captures PASS. NEW-SYNTHETIC-31 is created and edited via the website, receives governed offers/prices, two actual uploaded images, persisted draft discovery, reordered bilingual images and a registered order. New approved retail and final pause leave the placed order item snapshot unchanged. Actual Finance receipt verification and independent supplier fulfillment commands succeed.
- AR/EN, representative 360/390/1280, Light/Dark/System, no page overflow and axe smoke are covered. This is not WCAG certification.
- Local identities/files/fixtures were ownership-checked and removed; deleted identity reuse was denied. The test scope was paused before disposal. No pre-existing Staging records or private Storage objects were touched.
- Final public E2E: 71 PASS / 1 timeout in the full 72-case run. The same English mobile Stage 1 case passed in isolation with one worker in 12.4 seconds and the unchanged 30-second limit. Thus all 72 unique cases passed on the final application source, but the parallel full run was not completely green. No assertions, retries or timeout limits were weakened; record this local contention/flakiness risk for exact-head hosted CI. Lint, TypeScript, production build, formatting and tracked/history secret-pattern checks passed.

### Failed or interrupted attempts

Initial high-parallelism Vitest runs exhausted local resources and were interrupted. A bounded one-worker focused run passed without timeout/assertion changes. The test database shim now explicitly models the existing service_role and verifies the narrow boolean-only Storage policy helpers while retaining denial of raw private tables and other helpers.

Supabase CLI test-db over the alternate Windows local port returned a LegacyDbConnectError. The same full SQL files were run successfully through native local PostgreSQL 17 with pgTAP; no cloud connection or TLS downgrade was used. The normal default local DB port was Windows-reserved, so an isolated temporary local workdir uses alternate supported ports.

New browser harness attempts exposed transient publication-feedback/remount synchronization and a redundant Finance login after an already-authenticated redirect. The harness now checks successful responses plus independently committed revision and authoritative session redirects. Interrupted attempts cleaned run-owned resources. Existing financial/security assertions were retained.

The initial full E2E result was 70 PASS / 2 FAIL: axe found the new paused Store notice using a light fixed background with dark-theme text (contrast 1.64). Only that Store notice was switched to semantic surface/text tokens; axe assertions were retained. Initial traces are retained separately. The post-fix full run also had one Stage 1 30-second timeout during axe/browser work; its trace and 12.4-second isolated PASS are retained. One initial focused selector matched no tests, was corrected, and is not counted as acceptance. E2E artifacts now use a dedicated child output directory and logs are outside its cleanup area, preserving other test evidence.

## Dependency security

Current npm audit reports five High affected package entries in one development-tool chain: eslint-config-next 16.3.8 → @next/eslint-plugin-next 16.3.8 → fast-glob 3.3.1 → micromatch 4.0.8 → braces 3.0.3. The underlying [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) / CVE-2026-93687 concerns stack exhaustion from deeply nested patterns; its advisory lists no patched version. npm's suggested eslint-config-next 14.2.35 is an incompatible downgrade, not a safe compatible fix.

Production-only audit returns zero known advisories in the available registry data. No direct customer-request path into this lint-only chain was identified; malicious build inputs remain a development/CI risk. This is not proof of universal exploit absence. Dependencies and lockfile were not changed; keep the issue visible and assess a compatible upstream fix separately.

## Owner inputs and next action

1. Confirm missing product facts, five missing original photos, matches and image rights.
2. Approve actual supplier agreement and B entitlement, independent C retail versions, delivery regions/fees and allocations, legal/tax/invoice/returns/checkout authority. Reference A prices do not supply these approvals.
3. Separately approve real Vodafone Cash/InstaPay receiving destinations, CASH agreement and named narrow operational Store/Finance access. Nothing in this task activates them.
4. Approve a normal feature-branch push and exact-head hosted CI. Then review Migration 51 and separately authorize any Staging apply/deployment, preserving existing recovery/data controls. Do not deploy new administration against the old 50-migration contract.

Local code is for protected Staging review, not authorization to sell or launch Production. The existing six hosted payment journeys and accepted Transport/Driver evidence are preserved; they were not repeated as a large hosted matrix.

## Complete changed-file inventory (application delivery)

```text
docs/store/catalog-intake/README.md
docs/store/catalog-intake/image-import-manifest.json
docs/store/catalog-intake/initial-products.eg.json
docs/store/catalog-intake/source-photos/1-161716.jpg
docs/store/catalog-intake/source-photos/2-161710.jpg
docs/store/catalog-intake/source-photos/3-161711.jpg
docs/store/catalog-intake/source-photos/4-161718.jpg
docs/store/catalog-intake/source-photos/5-161715.jpg
playwright.config.ts
scripts/generate-db-types.mjs
scripts/test-store-catalog-concurrency.mjs
scripts/test-store-purchase-concurrency.mjs
scripts/test-store-workspace.mjs
scripts/verify-store-catalog-migration.mjs
src/app/[locale]/(portal)/portal/store/[[...path]]/page.tsx
src/app/[locale]/page.tsx
src/app/api/store/media/[id]/route.ts
src/app/api/store/media/route.ts
src/components/public/landing.tsx
src/components/shell/public-shell.tsx
src/components/store/catalog-admin.tsx
src/components/store/catalog-controls.tsx
src/components/store/catalog-editor.tsx
src/components/store/experience.tsx
src/components/store/introduction.tsx
src/components/store/product-image.tsx
src/components/ui/customer-workspace.tsx
src/domain/store/model.ts
src/infrastructure/store/access.ts
src/infrastructure/store/catalog.ts
src/infrastructure/store/media.ts
src/infrastructure/supabase/database.types.ts
src/styles/store.css
supabase/migrations/20261019000200_store_catalog_management.sql
supabase/tests/store_catalog.test.sql
supabase/tests/store_catalog_management.test.sql
tests/e2e/store.spec.ts
tests/helpers/database.mjs
tests/integration/deployment-attestation.test.ts
tests/integration/store-catalog-management.test.ts
tests/unit/customer-workspace.test.ts
tests/unit/store-admin-presentation.test.ts
tests/unit/store-management.test.ts
```

This documentation-only report and [sanitized final evidence](catalog-management-20261019.evidence.json) are additional delivery files. Local raw logs/screenshots remain outside Git in the task deliverables directory.
