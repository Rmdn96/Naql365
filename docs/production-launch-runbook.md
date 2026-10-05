# Naql365 Production release runbook

> Runtime enablement checkpoint (6 October 2026): the requested branch was created and approved documentation carried forward. Backend inspection found no environment attestation interface. Per the owner stop condition, implementation is paused before a proposed additive private marker/read-only RPC. See [the design and hPanel checklist](hostinger-acceptance-deployment.md). The guard and provider adapters are not implemented; no new runtime/CI PASS is claimed.

Status: preparation only. Phase 7 is CLOSED & MERGED at develop `518aef34128dd31413f1e4fc7c31e30a19f15832` (44 migrations). Production release is **not authorized** by Phase 7 approval. Consult the canonical Phase 7 report and the [Production launch review](production-launch-review.md) for verified prerequisites, manual dependencies and outstanding owner decisions before executing this runbook.

Intended Production hosting: **Hostinger Managed Node.js / Next.js**. Canonical **https://naql365.com**, with www redirecting to apex, DNS managed by Hostinger. Supabase remains authoritative. See [Hostinger compatibility](hostinger-runtime-compatibility.md): source controls and actual temporary Hostinger acceptance remain required. Vercel is retained only as historical/temporary Staging evidence. No deployment/DNS change is authorized here.

## Release entry gate

1. Obtain explicit owner authorization for a named, protected, reviewed release commit and the Production environment. Do not merge or deploy as a side effect of running tests.
2. Require final feature CI, populated Phase 6 upgrade, fresh reconstruction, generated types, RLS, independent-connection concurrency, registered-customer regression and both hosted guest journeys to pass on the accepted protected Hostinger temporary acceptance deployment; Vercel evidence alone is insufficient.
3. Review the final report, fixture cleanup evidence and remaining limitations. Freeze the accepted commit and migration list. Do not run disposable acceptance fixtures in Production.
4. Record owner-approved domain, legal copy, service areas, active services, pricing, taxes, staff identities and operating procedures. Missing items are release blockers.

## Separate infrastructure and credentials

- Create a dedicated Production Supabase project only under release authorization. Verify its project reference and organization against the release record. It must differ from Local and Staging.
- Use a separate Hostinger Production Node application. Temporary Hostinger acceptance connects only to Staging with APP_ENV=staging. Never auto-deploy Production from develop. Require manual deployment approval; use a verified exact-SHA source artifact if Git auto-deploy cannot be safely disabled.
- Implement and test the fail-closed Production build/startup guard designed in the compatibility review before release. Existing Vercel target checks do not enforce Hostinger project identity. Require canonical apex, approved Production Supabase binding and backend/configuration attestation; reject Staging, temporary origins and TEST dependencies. Independent operator verification remains additional. No guard was implemented by this review.
- Public variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Server configuration: `APP_URL`, `APP_ENV`. Use `APP_ENV=production` only for the approved Production deployment. Keep technical Staging authentication disabled (`STAGING_AUTH_SMOKE_ENABLED` absent/false).
- Store deploy/management credentials in the approved secret store. Never print environment values, dump cookies, capture authorization headers or commit exports. No service-role key belongs in browser code.
- Configure exact Auth site origin and callback allowlist for the approved domain. Verify SSR/PKCE, locale-safe redirects, password recovery and privileged invitation separately. Do not use unrestricted redirect wildcards.
- Configure a Production SMTP provider and verified sender/domain; the default Supabase test mail service is not the public-registration delivery plan. Prove actual mailbox confirmation without admin activation substitutes.

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
- Create two separate configurations through `/{locale}/portal/finance/banks`: select Egypt, then destination type VODAFONE_CASH or INSTAPAY. Enter the privately verified destination in Account number; leave IBAN/BIC blank. Set localized labels and beneficiary, activate the intended options, and choose at most one primary default. Save through the privileged form; do not insert configuration through customer APIs. Verify each option separately using synthetic Staging values before authorized Production setup.

Verify authorized checkout reveals only its Market's selected transfer instructions after BANK_TRANSFER selection. Check Copy IBAN behavior, private proof upload, rejection/reupload, exact amount/currency Finance confirmation and unchanged execution clearance. CASH selection must never mean collected/PAID. No gateway credentials or automatic wallet reconciliation are part of this release.

## Storage, domains, legal and deployment

- Keep attachments, proofs and POD private. Verify short-lived signed access and unauthorized denial. Do not make buckets public to fix a failed upload.
- Review the final hostname, DNS records and certificates with the owner before changes. Avoid domain reassignment or Preview promotion until the release plan explicitly authorizes it.
- Publish Privacy/Terms only after approved content is available and reviewed. Do not publish invented legal assurances or placeholder legal text.
  The technical routes are `/{locale}/legal/privacy` and `/{locale}/legal/terms`. Add reviewed AR/EN title, paragraphs and the approval reference as `approvedRevision` in `src/content/legal.json`. Null entries return 404 and have no footer link. Content approval remains a Production release blocker.
- `LAUNCH_CUSTOMER_LIVE_TRACKING` is a server-only presentation flag (`true`/`false`, default false). It controls the existing registered-customer live view; status tracking always remains available. Guest live coordinates remain excluded. This flag does not grant tracking authority or disable DB/RLS checks. Test the enabled registered view separately during regression.
- That presentation flag does not disable Driver GPS collection. The existing `staging_retention_hours`/prune schedule is explicitly Staging-only. An approved Production retention/maintenance or server-authoritative capture-disable plan is required before live location collection; see the review. Do not infer a Production policy from the Staging value.
- Funnel telemetry retains only daily event/Market/context counts in `private.mvp_funnel_counts`, with 90-day retention on ingestion and a 600/minute organization limit. It is approximate, user-reportable product telemetry, never commercial/audit evidence. No identity, IP, URL, guest capability or financial destination is collected. Operators can inspect aggregate counts through privileged database access; no public metrics query is exposed.
- Execute the separately approved Hostinger Production deployment only after entry gates and temporary Hostinger acceptance pass. Verify protected main source SHA, Node24, npm ci, npm run build / npm start, fail-closed guard and Production-only inputs. Rebuild public environment values; do not reuse a Staging artifact as Production.
- Verify canonical/hreflang, robots/sitemap, CSP and security headers. Public indexing is a release decision; guest/account/payment/portal routes stay noindex and private. Guest secrets remain URL fragments exchanged for HttpOnly cookies, never request paths or analytics properties.

## Bounded release smoke and rollback

- Use an owner-controlled identity and an explicitly approved non-business smoke procedure. Do not seed real customer/payment data for testing. Verify AR/EN, SA/EG, guest/authenticated boundaries, staff/Driver access, Storage and correct environment without collecting token-bearing screenshots or logs.
- Inspect bounded runtime logs for errors and secret patterns; report methodology and limits. Do not claim an exhaustive leak audit from a small sample.
- If a critical security or accounting invariant fails, stop onboarding, disable guest creation through privileged policy, preserve evidence and notify the owner. Do not weaken policies.
- For application rollback, deploy the last approved compatible application build through the normal protected release path. Additive migrations should remain unless a separately reviewed restoration plan requires otherwise. Never drop financial/operational tables or reverse migrations blindly. A database restore needs explicit incident authorization and an accounting/data-reconciliation plan.
- Database backups do not include Storage object bytes. Approve a separate private-object backup and coordinated restore rehearsal. On first launch there is no previous Production build: use the approved closed-intake/maintenance fallback, not an old incompatible application.
- Production smoke must not run the bulk Staging fixture/cleanup harnesses. Obtain an approved bounded record and payment plan. Never mark a synthetic transfer proof PAID; confirm only independently verified actual receipt. Preserve submitted financial/audit records and reconcile them rather than hard-delete.

## Unresolved Production blockers

Domain choice is approved; DNS/TLS execution, Hostinger runtime acceptance, source guard, dedicated Production bindings and secret custody, SMTP, active service coverage, real rules/taxes, privately verified payment configuration, legal copy, staff/Driver provisioning, retention/recovery, bounded smoke and release authorization are not fulfilled by this document. See the review's classified checklist and owner decision pack.

**Dependency security closeout: PASS — scoped owner risk acceptance.** The development-only `braces` advisory remains technically unresolved in the accepted graph and the full audit is not fully clean. Its documented owner-approved scoped disposition is not an unresolved approval blocker and does not cover unrelated/new advisories. Do not suppress audit. Recheck the dependency inventory before an authorized release.

## Hostinger cutover and retirement

Follow the compatibility review sequence: temporary Hostinger/Staging acceptance PASS → separately authorized Production Supabase setup → protected main release and Hostinger Production build → restricted final-host smoke → authorized DNS/SSL/callback validation → explicit public opening. Pre-DNS final-host smoke needs valid TLS/SNI and a supported operator resolution method. If unavailable, obtain an approved restricted validation window; never substitute a temporary Production APP_URL. Configure exact canonical callbacks before final-origin Auth tests.

Keep Vercel during transition. Only after Hostinger acceptance PASS and owner-approved retirement inventory, stop new Vercel deployments, revoke unused provider credentials and remove provider-only configuration. Preserve historical evidence and shared Supabase resources. Rehearse Hostinger rollback from an approved artifact; no Vercel instant rollback is assumed.
