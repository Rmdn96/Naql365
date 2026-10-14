# Naql365 Lovable UI migration — Wave 2

Current decision: **LOVABLE UI MIGRATION — WAVE 2 READY FOR OWNER REVIEW**.

Branch: `feature/lovable-ui-experience-v2`. Accepted Wave 1 baseline: `70cba96307745bb8c6de2538eb1059676cd3d901`. Final application-changing SHA: `a3a96256c43b06d3d30306a713eacc15b7fa7a4f`. Official protected Preview: <https://naql365-staging-ui-v2-naql365.vercel.app>. Application deployment: `dpl_7U9srageye4kDjPw3GpGoPUZMq16` (READY / Preview). Later delivery changes contain test tooling, evidence and documentation only. Final delivery HEAD and its exact CI run are recorded in the handoff and local `work/lovable-wave2-review/closeout.json`; do not treat the application CI as approval of a different delivery HEAD.

## Design and reviewed port

[Naql365 Design Lab](https://lovable.dev/projects/45d7c85b-e937-48ee-8d57-251cc16a57b8) remains workspace-only in the one-member workspace, unpublished, without Lovable database/Auth or a replacement Supabase backend. No credentials or private customer data were supplied. GitHub remains canonical; Lovable Preview is design iteration only.

The lab produced a bilingual split authentication layout: navy route/story panel, compact light form surface, restrained cyan identity, clear message hierarchy and accessible password reveal. Codex reviewed the exported diff and adapted those concepts to the existing Next.js primitives. Generated routing/runtime, demo state selectors, timeout-based fake outcomes, alternative validation, extra password-confirmation fields and generated AGENTS instructions were rejected. Export/file hashes and decisions are in `evidence/lovable-wave2/generated-diff-review.json`.

Canonical presentation changes:

- AuthExperience: shared server-rendered story/form layout for Login, Signup, Recovery, New Password and auth-complete fallback.
- PasswordField: local visibility toggle with a button label, `aria-controls`, pressed state and keyboard operation. Field name, limits and autocomplete retain the existing contracts.
- AuthLoading: localized, scoped route loading boundaries. It resolves display locale only; it has no authentication or permission authority.
- CustomerAuthForm: existing action/state binding and error semantics retained; sent feedback gets an email symbol and stronger hierarchy.
- CustomerProfileForm and onboarding branch: existing full name, international phone and preferred language, grouped with validation and save feedback. No new required fields or dashboard redesign.
- Scoped auth-v2 CSS uses Wave 1 tokens, logical RTL/LTR spacing, restrained radii, visible focus and responsive single-column presentation.

The initial numeric brand suffix contrast defect was corrected before release. Hosted mobile review also found the floating support control covering the signup CTA; the sole subsequent application repair places support in document flow on Auth pages. Final E2E and hosted checks assert this behavior. Source SHA changed from `1298411f45b5214b859232fe3c92f76f30adc4fe` to the final application SHA above; earlier captures are historical.

## Authority and callback configuration

All 47 migrations are byte-identical to the Wave 1 baseline. Supabase Auth implementation, PKCE/callback handler, SSR clients, cookies, server actions, validation, membership/role destinations, logout, RBAC/RLS, pricing/Finance rules, API and database types are unchanged. No service-role credential was added to application runtime. Test administration remains outside the web application.

The owner separately approved these four exact additions to **Supabase Staging**:

- `https://naql365-staging-ui-v2-naql365.vercel.app/auth/callback?locale=ar`
- `https://naql365-staging-ui-v2-naql365.vercel.app/auth/callback?locale=en`
- `https://naql365-staging-ui-v2-naql365.vercel.app/auth/callback?locale=ar&next=/ar/password`
- `https://naql365-staging-ui-v2-naql365.vercel.app/auth/callback?locale=en&next=/en/password`

Readback confirmed 16 exact entries: all 12 previous entries retained, no wildcard, Site URL unchanged. This approved callback configuration addition is distinct from the unchanged Auth implementation. Immutable Vercel deployment hostnames were not added. Preview protection remains `all_except_custom_domains`; anonymous access still reaches protection.

## Verification and evidence

Final application CI `38597556441`: both required jobs PASS, including SQL/RLS/generated types, independent-connection concurrency and restricted staff browser regression. Local core suite: 303/303 unit/integration and 44/44 E2E PASS. Delivery tooling adds two fixture-cleanup integration tests and one feedback presentation test; final combined suite is 306 tests. Formatting, lint, strict TypeScript, build and tracked/history pattern scans pass. Final delivery CI must match the delivery HEAD, as recorded in the handoff.

Hosted canonical-origin session matrix: **6/6 PASS** — CUSTOMER, SUPER_ADMIN and DRIVER, each AR/EN. Normal password login, authoritative destination, refresh, public/Market/locale navigation, direct login recognition, cross-role denial, explicit logout, Back and protected-route denial all pass. Auth cookie attributes are Secure, SameSite=Lax, Path=/ and host-scoped; values are never exported.

Hosted visual matrix: **150/150 PASS**, zero missing, 15 state families × AR/EN × 360/390/768/1280/1440. `evidence/lovable-wave2/hosted-index.json` records exact application SHA, timestamp, state, filename and SHA-256. Full images are retained locally under `work/lovable-wave2-review/hosted-matrix`; every file hash and unique matrix key was independently verified. Password fields are masked. No tokens, cookies, private documents, payment destinations or proof URLs appear in captures.

The families cover Login/Signup/Recovery initial, invalid confirmation, native signup validation, real pending submit under a test-only held POST, signup non-enumerating email-sent for an existing synthetic fixture, recovery email-sent, invalid credentials, authorized profile fields/validation, new-password form, incomplete onboarding, onboarding validation and saved profile. The POST delay preserves the real request/response and never ships to application users. Layout overflow, input labels, support/action separation and axe smoke pass. Keyboard reveal/focus was also verified on the official Preview. Automated accessibility smoke is not WCAG certification or exhaustive assistive-technology testing.

One extra confirmed synthetic identity used the actual profile form to bootstrap exactly one profile, Customer, active CUSTOMER membership and role. It saved through the existing server action, refreshed and logged out. It did not replace or modify a retained owner identity.

Confirmation/recovery callback tests preserve successful PKCE destination contracts and safe invalid-code handling. Browser navigation exercised invalid confirmation and AR/EN recovery callbacks on the exact canonical origin. This wave does **not** claim a new genuine delivered-mail acceptance run; the previous real-mail gate is retained because Auth implementation did not change.

## Existing product-state boundaries

Successful confirmation resolves to the authoritative account/staff/Driver destination; the product has no separate persistent confirmation-success page. Successful password reset signs out globally and redirects to Login; there is no authoritative success flag for a distinct success panel. Regression tests preserve that behavior rather than fabricating completion. Expired/invalid links share the existing safe callback-error presentation. Existing-account signup remains non-enumerating. Generic service errors retain the existing localized categories; component tests cover them without corrupting Staging infrastructure to manufacture an outage.

## Cleanup and historical failures

Four final-run synthetic Auth identities and all owned profile/Customer/membership/role/Driver/organization rows were removed. Independent readback confirmed zero remaining in each category. No Request/Quote/Order/payment/proof/Storage fixtures were created. Owner accounts, catalogue and commercial configuration were preserved. Temporary Vercel automation credentials were revoked; reuse was denied. Protection rules were not weakened.

Historical failures remain in `evidence/lovable-wave2/historical-failures.json`: Lovable submission interruption, initial contrast failure, test-selector ambiguity after adding reveal, shared output-directory reset, and cleanup tooling error. Initial OIDC access reached protection and created no fixtures. The established bounded temporary automation mechanism was used and revoked.

The final hosted runner produced 150 visual PASS entries, six session PASS entries and successful onboarding, then exited 1 because its cleanup SQL referenced the wrong audit column. That runner failure remains a failure. Independent operator recovery verified exact ownership from the separate ledger, applied the corrected cleanup tested against 47 migrations, removed every owned identity/relation and confirmed cleanup PASS. The corrected helper also proves that cleanup in the shared onboarding tenant preserves unrelated identities and tenant records. No application or schema change was needed for these harness failures.

No merge, main/develop modification, Production, DNS, Hostinger deployment, later redesign wave or Phase 8 work is part of this delivery.
