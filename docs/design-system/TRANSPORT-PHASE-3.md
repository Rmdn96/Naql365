# Unified Transport presentation — Phase 3

## Provenance and scope

- Parent: `d530a4cc142769a66aad6fe3fc22875cc4053324` (`feature/unified-design-system-phase-2`).
- Local implementation branch: `feature/unified-design-system-phase-3`.
- Visual authority: `Rmdn96/naql365-design-lab`, `2997c92bb5b00dfbf15ae0d1ccdb289d47c4d891`.
- Original source and asset checksums: [TRANSPORT-SOURCE.json](TRANSPORT-SOURCE.json).
- Phase 1, Phase 2 and Commerce integration worktrees remain separate.

## Presentation mapping

| Original Lovable source            | Canonical adaptation                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `transport-home-preview.tsx`       | Real `/ar/transport` and `/en/transport` landing routes; hero, assurances, process, clarity, FAQ and final CTA composition |
| `route-scene.tsx`, `route-map.jpg` | `TransportRouteScene`, original image bytes, SVG path and illustrative nodes                                               |
| Customer Preview wizard/progress   | Existing eight-step `RequestWizard`, scoped horizontal progress and form presentation                                      |
| Customer Preview panels/snapshots  | Existing `RequestSummary`, review controls and immutable submitted request display                                         |
| Customer Preview quote/money/route | Existing `QuoteDetailView`, `QuoteActions` and `JourneyRoute` with canonical amounts and decisions                         |
| Customer Preview timeline          | Existing authorized `OrderProgress`/`RouteMotif`; actual Trip/POD DTOs, without fabricated completed stages                |
| Original branding                  | Phase 1 `BrandLink` → official `Brand`/`BrandMark`                                                                         |

Only factual, relevant bilingual source copy is imported. Lab records, example prices, preview state selectors, action dialogs and commercial coverage examples are excluded. The new landing renders service names and pickup hubs from the strict canonical `public_market_catalogue` projection for the selected public Market. Missing local configuration produces an honest empty state; RPC/validation errors still propagate.

## Routes and layout boundaries

The shared Transport frame covers `/[locale]/transport`, `/request[/…]`, `/guest[/…]`, and `/account/requests[/…]`, `/account/quotes[/…]`, `/account/orders[/…]`, including existing payment subroutes. It replaces their legacy public chrome while retaining the canonical pages, guards and actions.

The accepted homepage, Store, Customer account root, independent Phase 2 Auth pages, Staff and Driver layouts keep their own layout families. The Transport frame reuses canonical role-aware `IdentityLink`, Market preference control, theme control, mobile dialog and cart link. It preserves contact and approved-only legal links. It adds a keyboard skip target and retains native dialog focus restoration.

`transport.css` uses scoped aliases of Phase 1 tokens. It does not replace root tokens or add another styling framework. Native controls follow explicit Light/Dark and System appearance. No alternative logo or font is introduced.

## Preserved contracts

Existing wizard, summary and quote component changes are class hooks only. Their handlers and state transitions are unchanged. All infrastructure, domain, Auth actions, RPCs, schemas and 51 migrations are unchanged.

This preserves draft revisions, autosave, mutation idempotency, validation, private attachments, Guest capabilities, Customer ownership, manual Sales pricing, quote response authority, Finance confirmation, payment separation, Market/organization isolation and tracking/POD permissions. Public preference cookies do not become request ownership or Market authority. Multi-context account experiments are excluded.

## Validation and evidence scope

- Full unit/integration: 485 tests, including the Transport UUID contract regression and isolated PostgreSQL authorization assertions.
- Complete generic E2E: 86 tests (78 existing plus eight Transport presentation cases).
- Focused Transport checks additionally cover native theme schemes, keyboard skip navigation, mobile menu Escape/focus restoration and canonical identity navigation.
- Actual canonical React components: four AR/EN Guest/Customer HTTP-fixture journeys covering autosave, reload persistence, required-field denial, focus and submission; five quote states across four contexts; summary, quote, wizard and tracking presentation checks.
- Local PostgreSQL 17: all 12 original native SQL assertion bodies passed in rollback transactions. Only pgTAP display/planning calls were omitted because the owner-managed stack lacks pgTAP. No business assertions were removed and no migration was applied to that stack.
- Concurrency scripts were not rerun against the owner-managed stack: they retain disposable fixtures until teardown. The unchanged eight-suite evidence from accepted Foundation run `39773999187` remains relevant; a fresh disposable hosted run is the next verification gate.
- Production build, TypeScript, ESLint, formatting, source/history secret-pattern scans and migration/provenance checks passed locally.

The component harness uses controlled HTTP and Next.js presentation adapters. It is not a claim of a new live Supabase Auth browser acceptance run. Real authorization is independently covered by PostgreSQL tests. No cloud customer, order, payment, grant or Storage fixture was created.

The Foundation quality job now executes `scripts/test-transport-presentation.mjs` after installing Chromium, and retains its synthetic evidence on failure. No hosted workflow was triggered by this local work.

## Visual acceptance

Evidence is stored outside Git in the workspace delivery directory `naql365-transport-phase3-20261022`: paired Phase 2/Phase 3 route screenshots, unchanged original Lovable Transport and Customer Preview screenshots, component screenshots and checksum manifests.

Coverage includes AR/EN, RTL/LTR, Light/Dark/System and widths 360, 390, 768, 1280 and 1440. Existing Auth/account screenshots are unchanged in the captured matching states. Homepage/request/login/account/request-detail transitions were inspected. Unconfigured private routes show genuine access-denial states; authorized request, quote and tracking presentation uses explicitly synthetic component fixtures.

Justified differences from the lab:

- Real navigation and required Market/theme/cart/identity controls replace lab toolbars and demo actions.
- The lab's Saudi coverage examples and synthetic service cards are not commercial application data.
- The Transport landing lab has one dark appearance; Light/System use the approved canonical token variants.
- Canonical forms retain required addresses, shipment items, attachments, revision/save/error messages and permission-dependent actions absent from the simplified preview.
- Canonical status, quote validity, amounts and POD/payment state come from governed services; the lab's sample records and completed timeline are not imported.
- Some small lab labels use larger readable text and 44px control targets. Pixel-perfect parity is not claimed for these necessary controls or differing data states.

## Reproduction

Use a guarded, unconfigured local production build for generic E2E and GET-only visual checks. The scripts reject a configured build for those captures. Never point them at Staging or Production.

```text
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run build
node scripts/test-transport-presentation.mjs
npm run test:e2e
node scripts/test-transport-design.mjs
npm run check:secrets
node scripts/check-secret-history.mjs
```

The visual runner accepts `NAQL365_TRANSPORT_OUTPUT`, `NAQL365_TRANSPORT_BASELINE` and `NAQL365_TRANSPORT_SOURCE` for an external evidence directory, the accepted local Phase 2 build, and the unchanged approved Lovable checkout. It owns and cleans its loopback servers. Original font requests are fulfilled from the app's bundled Alexandria/Inter files, without sending data to a font service. The original lab's generated route-tree bytes are preserved around its dev server.

Current npm audit: zero runtime findings; eight development-tool findings (six high, two moderate), including braces/ESLint and Vite/Vitest chains. They remain open. Dependency manifests are unchanged; no unrelated upgrade or advisory waiver was made.

## Next gate

Review the local commit and visual evidence, then separately authorize an exact-SHA feature push and hosted Foundation/Database Types verification. Cloud authenticated smoke and protected Staging review require their own approval. No deployment, migration, alias change or commercial activation is implied by local acceptance.
