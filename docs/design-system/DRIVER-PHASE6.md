# Unified Driver experience — Phase 6

## Source and scope

Accepted baseline: `b5c9614bcddb0ca06eceeee978384ece1300b75d`, Next.js 16.4.1. Branch: `feature/unified-design-system-phase-6`. Original Driver Preview: `Rmdn96/naql365-design-lab@2997c92bb5b00dfbf15ae0d1ccdb289d47c4d891`. Source hashes are in `DRIVER-SOURCE.json`; real routes and unsupported preview features are mapped in `DRIVER-ROUTE-MAPPING.md`.

The original `.dx` shell, cards, grid, timeline, action, form and state CSS is imported with formatting only. Original Hand/Truck and state Lucide icons and the official centralized Brand/BrandMark are reused. The adapter is Driver-scoped and consumes Phase 1 tokens. Its shared Lovable stylesheet import supplies the existing `.cx` semantic tokens; no alternative palette or global design system is introduced.

## Canonical integration

- Independent Phase 2 Driver login, its form/action, origin validation and session handling remain unchanged.
- The Driver family uses a shared branded header, theme preferences, skip link and localized direction. Public chrome is suppressed only for Driver routes; other families retain their existing components/styles.
- Today/upcoming/completed navigation, language links, logout, bounded pagination and assigned-trip projections are retained.
- Detail uses the original two-column desktop/action-first mobile hierarchy and stop timeline. Actual status, schedule, vehicle, redacted contact/instructions and action semantics remain authoritative.
- Existing execution, issue/photo, tracking, signature/upload and POD controls are styled in place. Their source files and all domain, service, API, RPC, Auth, Finance, RLS, Storage and database contracts remain unchanged.
- Localized loading and safe render-error states expose no raw exception. The error state says the current state is unverified and asks the Driver to refresh before repeating an action. Existing access redirects and forbidden logout remain authoritative.

No demo records, lab controls, fake GPS, offline command queue, ETA, map, Driver signup, earnings or financial authority is imported. There are no new tracking/device permissions. The source preview's separate conceptual views remain sections of the existing real list/detail routes.

## Verification design

`test-driver-presentation.mjs` uses the same accepted component-only Vite boundary strategy as the other presentation harnesses. It blocks APIs, uses explicit synthetic data and does not establish Auth/RLS acceptance. It checks AR/EN, RTL/LTR, Light/Dark/System, 360/390/768/1280/1440px dashboard/detail, representative remaining states, axe, overflow, cards, disabled execution, POD readiness and redacted history. Optional local baseline capture is hash-verified; standalone hosted mode requires no neighboring checkout.

`test-driver-workspace.mjs` uses the guarded isolated local Supabase helper and an owned loopback production server. It creates only random synthetic identities/organizations, valid UUID fixtures and a synthetic accepted CASH order. Fixture DDL is denied. The test uses real Driver login/logout, scoped RPC denials, browser actions through completion, foreground tracking projection, private POD upload and cross-user/public access denial. Supported Storage cleanup, scoped row cleanup, Auth deletion and deleted-credential reuse denial run in finally. Credentials remain in memory; ignored ownership evidence contains IDs only.

Foundation adds both Driver harnesses and their appropriate failure/restricted artifacts. Existing assertions, workflow timeouts and retry settings are unchanged. Local generic E2E is run with one worker and zero retries. No cloud workflow is executed in this phase.

## Evidence and limitations

Final check receipts and screenshots are outside Git in `deliverables/naql365-driver-phase6-20261023/`; the external final report is the acceptance record. Failed development diagnostics are retained separately from final passing receipts. All 51 migrations and generated database types must match the accepted parent.

The local stack lacks pgTAP display functions. Native SQL/RLS assertion bodies execute unchanged inside rollback transactions; only plan/pass/finish display calls are omitted. Full 209-assertion pgTAP and all eight concurrency suites are reused from accepted Foundation 39928829142 because their source/security contracts are unchanged. The owner-managed database is not used for destructive concurrency reconstruction.

Reference captures use the unchanged approved Lovable source. Comparison captures are component-only synthetic states, while real authenticated local Driver screenshots are separately identified. Pixel equality is not claimed: canonical fields, pagination, server-selected actions, native preferences, guarded routes and redacted history replace source slots and review controls. Original preview controls never imply production functionality. Original-source contrast differences retain the already accepted canonical action-color correction.

The new harness initially needed explicit tracking Auth-listener stubs in its component-only mode and the shared token import in the real frame. Preparatory real-browser diagnostics and an owned SQL helper conflict are preserved externally. The helper body was verified before removal; final fixture setup creates no helper functions. These were local harness/setup investigations, not changes to operational authority.

Fresh runtime audit is clear; existing eight development-tool findings (six High/two Moderate), including braces, remain unresolved. A clean runtime audit is not comprehensive security certification.

Full Driver migration does not authorize deployment, cloud database changes, account/role changes, Store activation or payment configuration. Multi-context identity architecture remains separate.
