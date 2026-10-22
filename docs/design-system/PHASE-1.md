# Unified visual foundation — Phase 1

Visual source: Rmdn96/naql365-design-lab@2997c92bb5b00dfbf15ae0d1ccdb289d47c4d891.
Starting application: 4d1a642264b631e295f9b1a1ac33f104fa396b11.

## Shared contracts

- `components/design-system/brand.tsx` owns the original SVG geometry and bilingual wordmark. Public/Auth/Customer/Staff/Driver/mobile size variants use the same mark. A linked logo keeps the caller's destination and accessible label; an unlinked logo is an image, not a new focus target. The Staff drawer retains its close-button focus order. Existing public/Auth BrandLink and Commerce Brand paths are compatibility wrappers, not separate artwork. Existing favicon already uses this mark and is retained.
- `styles/foundation.css` contains the exact approved Lovable light/dark/system palette under prefixed `--naql-*` roles, typography, spacing, radii, focus and the approved accessible action color. `lovable.css` aliases its existing scoped variables to those roles, preserving accepted Commerce composition. Older `--theme-*` / `--v2-*` palettes remain deliberately unchanged until each later route migration is reviewed. There is no global reset or wholesale legacy palette replacement.
- `components/design-system/theme.ts` is the one browser preference store: `html[data-theme]`, existing `naql365_theme` cookie, `naql365-theme-change` event and unsubscribe behavior. Both existing controls retain their labels, hydration gating, UI and imports through compatibility wrappers. HTTPS Secure/SameSite behavior is preserved; there is no network/Auth operation.
- `DesignFoundation` identifies visual layout ownership (`public`, `auth`, `customer`, `staff`, `driver`) without adding a DOM wrapper or moving authorization. It is adopted by existing Commerce/Auth/Staff roots. Driver already inherits the centralized public branding; later role-layout adoption is separate.

## Intentional scope

The original Commerce button/sheet variants, canonical Input/Card/PageHeader components and domain forms remain intact. This phase consolidates their visual tokens and branding foundation; replacing or redesigning all controls is not necessary and would expand regression risk. Later phases can use the prefixed roles and family contract while preserving server authorization and command semantics.

No Auth/Transport/Commerce/Finance service, permission, price, media authorization, Driver workflow or Market resolver changes. In particular, the separately identified Staff missing-cookie SA fallback is not silently changed here. All 51 migrations and the original design repository remain unchanged.

## Verification

`tests/unit/design-foundation.test.ts` covers official geometry, wrappers, family semantics, Staff link/focus preservation and shared preference persistence without backend access. Existing theme-source assertions now inspect the centralized preference implementation while retaining their security assertions.

`node scripts/test-design-foundation.mjs` requires an unconfigured loopback-only production build, starts one owned temporary server, blocks non-GET/external browser requests and stops it in cleanup. With `NAQL365_DESIGN_BASELINE` pointing to retained approved paired screenshots it verifies their hashes and compares the exact header/hero dimensions at AR/EN, 390/1440 and Light/Dark/System (System resolves light, matching that reference). Actual data counts and approval notices may differ from prior synthetic fixture states; these are documented content differences, not substituted demo products. Existing generic theme E2E additionally covers System resolving dark, 360/390/768/1280/1440, contrast, keyboard and persistence.

No Supabase fixture/grant-creating harness is required for this presentation-only phase. Existing financial/role browser evidence is reused; local in-memory unit security tests and unconfigured browser denials remain enabled. Final results and before/after evidence are retained outside Git in the delivery report.

## Later migrations of presentation

Independent simplified Auth layout; Transport wizard and related customer pages; Customer descendant navigation/chrome; full Staff/Store operational visual composition; Driver shell and remaining operational/error/loading states. These are separately scoped follow-up phases, not unfinished business-rule changes in Phase 1.
