# Naql365 Production release runbook

Status: preparation only. Production release is **not authorized** by Phase 7 implementation approval. This runbook does not assert that the application has passed Phase 7 acceptance. Consult the canonical Phase 7 report first.

## Release entry gate

1. Obtain explicit owner authorization for a named, protected, reviewed release commit and the Production environment. Do not merge or deploy as a side effect of running tests.
2. Require final feature CI, populated Phase 6 upgrade, fresh reconstruction, generated types, RLS, independent-connection concurrency, registered-customer regression and both hosted guest journeys to pass on the accepted protected Preview.
3. Review the final report, fixture cleanup evidence and remaining limitations. Freeze the accepted commit and migration list. Do not run disposable acceptance fixtures in Production.
4. Record owner-approved domain, legal copy, service areas, active services, pricing, taxes, staff identities and operating procedures. Missing items are release blockers.

## Separate infrastructure and credentials

- Create a dedicated Production Supabase project only under release authorization. Verify its project reference and organization against the release record. It must differ from Local and Staging.
- Use a separate Production Vercel environment/project configuration. Verify environment scopes before each change. Keep Preview connected only to Staging.
- Public variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Server configuration: `APP_URL`, `APP_ENV`. Use `APP_ENV=production` only for the approved Production deployment. Keep technical Staging authentication disabled (`STAGING_AUTH_SMOKE_ENABLED` absent/false).
- Store deploy/management credentials in the approved secret store. Never print environment values, dump cookies, capture authorization headers or commit exports. No service-role key belongs in browser code.
- Configure exact Auth site origin and callback allowlist for the approved domain. Verify SSR/PKCE, locale-safe redirects, password recovery and privileged invitation separately. Do not use unrestricted redirect wildcards.

## Schema rollout

1. Identify the exact release migration filenames using `git ls-tree -r --name-only <approved-sha> -- supabase/migrations`. Compare with the Production migration ledger. Stop on any unknown/divergent migration.
2. For an existing database, confirm restorable backup/PITR and rehearse the upgrade on an isolated restored copy. Record checks of commercial snapshots, counts and constraints before/after.
3. Under a dedicated credential session, explicitly link the approved Production reference with Supabase CLI. Inspect `supabase migration list` and `supabase db push --dry-run`. Have the operator verify the target before `supabase db push`.
4. Apply the approved repository migrations without manual schema fixes. Stop on failure. Verify RLS, policies, constraints, grants, private buckets and migration ledger after application.
5. Generate authoritative Supabase database types and compare with the release. Never overwrite code silently to conceal divergence.

## Operational configuration

- Confirm intended organization and SA/EG Markets, IANA timezones, SAR/EGP and country-specific city/service coverage.
- Activate only services the business can deliver. Configure Market-scoped rules, vehicle classes and owner-approved tax settings. Verify exact minor-unit totals with synthetic examples outside Production before entering real values.
- Retain the approved `MANUAL_VERIFIED` Sales road-distance authority. A routing API is not configured by this release.
- Provision staff through the trusted invite/admin process. Assign least-privilege memberships/roles; verify suspension and role loss. Provision internal Drivers with explicit profile/resource mapping; external Drivers receive no portal identity.
- Guest ordering defaults off in the database. The privileged operator must confirm enrollment organization, expiry and creation quota, then update the existing `private.guest_policy` row (or insert it) for that organization. Defaults are 30-day validity and 30 creations/hour; values are constrained by the schema. Record chosen values and audit the configuration outside secret-bearing logs. Do not enable before guest acceptance and abuse gates pass.
- Public contacts are intentionally Market-specific. Verify the SA and EG WhatsApp links from rendered pages. Never copy financial configuration into contact settings.

## Privileged payment configuration checklist

Real payment values supplied privately by the owner must be entered **only after explicit Production setup authorization**, through the Finance bank configuration screen/RPC using an account with `finance.accounts.manage`. Do not paste them into migrations, shell history, test fixtures, Git, screenshots or this runbook. Staging continues using obvious TEST values.

SA configuration fields:

- Market: SA; currency: SAR; institution: Al Rajhi Bank / مصرف الراجحي.
- Beneficiary: `[owner-verified value entered privately]`.
- IBAN: `[owner-verified value entered privately]`.
- Confirm format, active/primary selection and customer-safe instructions with a second authorized operator.

EG configuration fields:

- Market: EG; currency: EGP.
- Methods required: Vodafone Cash and InstaPay.
- Destination and beneficiary: `[owner-verified values entered privately]`.
- **Current implementation checkpoint:** explicit typed wallet destination selection is unfinished. Do not simulate support by changing a bank label, entering values early or declaring this gate ready. Finalize and test the privileged configuration and selection path before release.

Verify authorized checkout reveals only its Market's selected transfer instructions after BANK_TRANSFER selection. Check Copy IBAN behavior, private proof upload, rejection/reupload, exact amount/currency Finance confirmation and unchanged execution clearance. CASH selection must never mean collected/PAID. No gateway credentials or automatic wallet reconciliation are part of this release.

## Storage, domains, legal and deployment

- Keep attachments, proofs and POD private. Verify short-lived signed access and unauthorized denial. Do not make buckets public to fix a failed upload.
- Review the final hostname, DNS records and certificates with the owner before changes. Avoid domain reassignment or Preview promotion until the release plan explicitly authorizes it.
- Publish Privacy/Terms only after approved content is available and reviewed. Do not publish invented legal assurances or placeholder legal text.
- Execute the approved Vercel Production deployment only after all entry gates pass. Confirm deployment classification, source SHA and Production-only environment bindings. Do not reuse a Staging deployment as Production evidence.
- Verify canonical/hreflang, robots/sitemap, CSP and security headers. Public indexing is a release decision; guest/account/payment/portal routes stay noindex and private. Guest secrets remain URL fragments exchanged for HttpOnly cookies, never request paths or analytics properties.

## Bounded release smoke and rollback

- Use an owner-controlled identity and an explicitly approved non-business smoke procedure. Do not seed real customer/payment data for testing. Verify AR/EN, SA/EG, guest/authenticated boundaries, staff/Driver access, Storage and correct environment without collecting token-bearing screenshots or logs.
- Inspect bounded runtime logs for errors and secret patterns; report methodology and limits. Do not claim an exhaustive leak audit from a small sample.
- If a critical security or accounting invariant fails, stop onboarding, disable guest creation through privileged policy, preserve evidence and notify the owner. Do not weaken policies.
- For application rollback, deploy the last approved compatible application build through the normal protected release path. Additive migrations should remain unless a separately reviewed restoration plan requires otherwise. Never drop financial/operational tables or reverse migrations blindly. A database restore needs explicit incident authorization and an accounting/data-reconciliation plan.

## Unresolved Production blockers

Final approved domain/DNS, Production resources and secrets, active service coverage, real rules/taxes, real private payment configuration, legal copy, staff/Driver provisioning and release authorization are not fulfilled by this document. Phase 7 hosted acceptance is also unfinished at this checkpoint.
