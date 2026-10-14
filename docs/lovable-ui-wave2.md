# Lovable UI migration — Wave 2: Authentication and onboarding

Status: IN PROGRESS. Baseline: `70cba96307745bb8c6de2538eb1059676cd3d901`; branch `feature/lovable-ui-experience-v2`. Official acceptance origin: `https://naql365-staging-ui-v2-naql365.vercel.app`. Design lab: existing Naql365 Design Lab. All 47 migrations are immutable.

## Presentation boundary

Lovable supplies visual concepts only. Canonical Next.js server actions, Supabase client creation, PKCE/callback handling, cookies, origin validation, membership resolution, role destinations and logout remain unchanged. No new backend fields, API, query, schema or permission is authorized. No Lovable database/Auth integration or credentials.

Existing presentation entry points: public login; IdentityPage for register/recover/password; CustomerAuthForm and CustomerProfileForm; auth-complete fallback; the existing onboarding branch of CustomerAccount. Dashboard content is outside this wave.

## Actual state contracts

| Requested state                                             | Existing authority and allowed presentation                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login, invalid credentials, unconfirmed email, server error | Existing `customerAuth` action returns the existing bounded error category; preserve `authErrorMessage`.                                                                                          |
| Signup/recovery email sent                                  | Existing `sent` state; retain non-enumerating wording and same-browser guidance. Never claim that a particular account exists or that delivery is independently verified.                         |
| Validation/pending                                          | Retain existing constraints and server validation; use existing pending state and field errors.                                                                                                   |
| Confirmation success                                        | Callback exchanges the PKCE code, then resolves the authorized destination. No separate persistent success page currently exists.                                                                 |
| Invalid/expired confirmation                                | Existing login notice `confirmation-link`; preserve safe error semantics.                                                                                                                         |
| New password                                                | Existing authenticated recovery page and existing password action.                                                                                                                                |
| Password reset success                                      | Existing action signs out globally and redirects to login. There is no authoritative success flag to render a distinct success claim. Do not fabricate one or change the action for presentation. |
| Profile completion                                          | Existing full name, international phone and preferred language only; retain existing validation and onboarding RPC.                                                                               |
| Profile saved                                               | Existing `profile=saved` presentation and permitted membership branch.                                                                                                                            |
| Redirect/loading                                            | Keep destination resolution unchanged; any loading UI is presentation only.                                                                                                                       |

## Acceptance

Inspect generated lab diff before porting compatible UI. Validate AR/EN and RTL/LTR at 360, 390, 768, 1280 and 1440; labels, focus, keyboard, overflow and safe feedback. Run full unit/integration and E2E, Auth tests, lint/types/build, tracked/history scans and CI for the delivery HEAD. Hosted CUSTOMER/SUPER_ADMIN/DRIVER checks use the canonical origin with scoped fixture ownership/cleanup and retained Preview protection. Never export passwords, cookie/token values or private data into evidence.

Lovable experienced connection/submission errors before accepting the Wave 2 request; these are design-tool infrastructure interruptions, not application Auth failures.

## Reviewed implementation

The generated export changes 11 design-lab files; the committed review inventory records hashes and rejected scaffolding. The canonical port introduces AuthExperience (server presentation), PasswordField (local reveal state only), scoped AuthLoading boundaries and auth-v2 CSS. Existing action bindings, field names/constraints/autocomplete, profile inputs, error categories and links are preserved. Onboarding remains full name, international phone and preferred language. The existing account dashboard and role routing are unchanged.

Owner separately approved four exact Staging callbacks for the canonical UI V2 origin (AR/EN confirmation and AR/EN recovery). Readback shows 16 exact entries, preserving all 12 prior entries and the Site URL. No wildcard was introduced. This is the sole approved Supabase configuration addition; Auth implementation and schema remain unchanged.

Test tooling adds a canonical UI V2 session/visual harness derived from the accepted Stage 3 runner. Exact HTTPS target, Staging backend/organization checks, fixture ledger and cleanup remain mandatory. Short-lived Vercel OIDC is supported using its correct header; the initial local OIDC preflight reached protection (302), so no fixtures were created under that failed access path. The existing scoped temporary Vercel automation mechanism may be used for this run, then revoked and reuse denied. No protection rule is disabled or broadened.
