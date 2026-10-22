# Unified design Phase 2 — independent Auth presentation

Starting application: `000b2485ff58923ce9c6291110087126889df832`.
Approved visual reference: `Rmdn96/naql365-design-lab` at `2997c92bb5b00dfbf15ae0d1ccdb289d47c4d891`.

## Source and adaptation

`src/components/naql/auth-preview.tsx` and the Wave 2 Auth rules in `src/styles.css` supply the compact toolbar, 1:1.1 panel geometry, original route SVG, 1180px maximum width, 380px form column, 1100/850/600px responsive transitions, light form panel and lock/shield icon treatment. Phase 1's centralized official logo remains authoritative. The reference repository is unchanged.

Excluded from the import: preview screen/state selectors, demo validation/submit timer, demo confirmation results and lab-only messages. Canonical AuthExperience still receives the actual page title, guidance and children. Original operational forms/actions remain in place. Small text uses readable canonical sizes rather than reproducing the preview's 8–11px lab text everywhere.

## Covered routes and states

`/{locale}/login`, `/register`, `/recover`, `/password`, `/auth-complete` and `/driver/login` share independent Auth chrome. Exact path matching prevents it from leaking into account, portal, Transport or Driver operational pages. The compact toolbar retains home navigation, locale, current Market preference and shared Light/Dark/System controls; no public search/cart/marketing header or footer is rendered on Auth routes.

Existing AuthLoading uses the same presentation. Error, email-sent, enrollment and confirmation content remains supplied by the canonical pages/forms. DriverLogin receives the same wrapper; its action and field contracts are unchanged. No role chooser is introduced.

The approved Auth Preview keeps the form panel light while the outer identity follows the shared theme. Panel-scoped legacy semantic aliases keep inherited feedback/input styles and muted text legible; they do not remap other routes' theme tokens. The Story wordmark keeps the approved text color and mark/accent colors.

## Security boundary

No changes to Auth server actions, Supabase clients, callback handler, redirect validation, cookies, CSRF/origin/rate-limit checks, role resolution, RLS, Commerce, Transport or Finance rules. The locale control retains only localized pathname and discards capability fragments/query values as before. All 51 migrations remain unchanged.

Option B architecture and the isolated synthetic PostgreSQL model are retained outside this worktree under the local delivery directory. No experimental authorization helper, schema, provisioning command or real account change enters this UI release.

## Verification

- `tests/unit/auth-phase2.test.ts`: exact chrome-family boundaries, safe locale path, Market/theme preferences, no role selector, preserved feedback/loading semantics and original SVG composition.
- Existing Auth, password, customer-action, redirect, origin, permission and Transport UUID regression tests remain enabled.
- Generic E2E retains callback-failure, no secret leakage, accessibility, five widths, Market persistence/isolation and all three theme checks. Updated assertions target the independent Auth toolbar; floating contact/public header are explicitly absent.
- `scripts/test-auth-design.mjs`: optional approved Phase 1 before/after captures using owned loopback-only unconfigured builds. No backend calls, test accounts or cloud fixtures. Each capture has a checksum and recorded locale/theme/viewport. Run with `NAQL365_AUTH_BASELINE=../Naql365-design-phase-1` and an external `NAQL365_AUTH_OUTPUT` directory after production build.

Live email delivery, provider login and authenticated cloud behavior are not exercised by the read-only/unconfigured browser capture. Existing business/security tests are preserved; any hosted CI, deployment or real account provisioning requires separate authorization.
