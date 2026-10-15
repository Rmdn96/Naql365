# Naql365 Lovable UI V2 — Market Fix + Theme Foundation

Current decision: **LOVABLE UI V2 — MARKET FIX + THEME FOUNDATION READY FOR OWNER REVIEW**

This gate is on `feature/lovable-ui-experience-v2`, based on Wave 2 delivery `bd2495c010fe6f50c09532b2f7efb07643033b82`. It is a presentation and public market-context change. No production deployment, DNS change, Hostinger deployment, Commerce schema, or migration was introduced.

## Market switching

The safe diagnostic on the canonical protected Preview (`https://naql365-staging-ui-v2-naql365.vercel.app`) exercised the existing same-origin endpoint with the browser origin and the current canonical `APP_URL` origin. The endpoint remains `POST /api/public/market`, protected by `checkOrigin`, and the market cookie remains Secure on HTTPS, SameSite Strict, Path `/`, and HTTP-only. No cookie value was recorded.

The current canonical Preview successfully completed both directions after the normal refresh wait:

| Locale        | Direction            | Result | Authoritative content                    |
| ------------- | -------------------- | ------ | ---------------------------------------- |
| Arabic / RTL  | Saudi Arabia → Egypt | PASS   | Egypt market heading and Cairo coverage  |
| Arabic / RTL  | Egypt → Saudi Arabia | PASS   | Saudi market heading and Riyadh coverage |
| English / LTR | Saudi Arabia → Egypt | PASS   | Egypt market heading and Cairo coverage  |
| English / LTR | Egypt → Saudi Arabia | PASS   | Saudi market heading and Riyadh coverage |

Refresh and locale navigation retained the selected market during the browser verification. The earlier owner report is therefore retained as historical Preview evidence; it was not reproduced on the current canonical deployment. No weakening of origin validation was necessary or made. The safe current classification is a stale or transient Preview/configuration condition, without enough bounded runtime evidence to claim a narrower server root cause.

## Theme foundation

The implementation adds semantic tokens for background, surfaces, text, borders, brand, accent, status, focus and shadow. `Light`, `Dark`, and `System` are first-class modes, with `System` as the default. The server reads the `naql365_theme` preference before rendering the root element, so an explicit selection is present on the initial response. The client control updates the root `data-theme` attribute and persists only the non-sensitive theme preference in a SameSite cookie. System mode follows `prefers-color-scheme` through CSS media tokens.

The compact accessible theme control is present in the public desktop navigation and in the mobile menu, with localized labels `فاتح / داكن / حسب النظام` and `Light / Dark / System`. Wave 1 public surfaces and Wave 2 authentication/onboarding surfaces consume the semantic tokens. The mobile market control and error text use compact spacing and bounded width so a market error cannot expand the whole header.

Lovable project knowledge was updated in the restricted **Naql365 Design Lab** to require the three theme modes, semantic tokens for all future components, first-class SA/EG market context, and the fact that Store/Commerce is planned but not implemented. Lovable remains design-only; no database, Auth, Supabase integration, GitHub sync, or credentials were added.

## Files changed

- `src/styles/tokens.css` — semantic Light/Dark/System theme tokens.
- `src/styles/design-system-v2.css` — token-based Wave 1/Wave 2 surfaces, controls, states and compact mobile header treatment.
- `src/components/shell/theme-control.tsx` — localized accessible theme selector and persistence.
- `src/components/shell/public-shell.tsx` — theme control in public desktop and mobile navigation.
- `src/app/[locale]/layout.tsx` — server-side theme preference read and initial `data-theme`.
- `tests/unit/theme.test.ts` — semantic-token and persistence contract checks.

No market endpoint, Auth flow, RLS/RBAC, business command, or database migration was changed. Migrations remain **47**, byte-identical to the accepted baseline.

## Verification

- TypeScript strict check: PASS.
- ESLint: PASS.
- Prettier check: PASS.
- Secret/history scan: PASS (2288 tracked files).
- Theme contract tests: 2 PASS.
- Market integration/database coverage remains the accepted baseline.
- The full Vitest run was attempted; Windows worker/SSR sandbox file linkage failed for the existing database and visual-evidence suites before execution. The failures are environmental (`ENOENT`/`EPERM`) and did not identify an application assertion failure.
- Production build was attempted with Webpack after the local Turbopack junction restriction. The sandbox could not resolve `fonts.googleapis.com`, and Next also reported the existing Windows junction permission limitation. No source conclusion is drawn from that environment failure.

The official protected Preview remains `https://naql365-staging-ui-v2-naql365.vercel.app`. Application/Auth/RBAC/RLS, Supabase project, payment and lifecycle behavior remain unchanged.
