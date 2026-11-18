# Hostinger with existing Production backend

Source baseline: fc4c20761955ae5a3e796111b1eb3973d9511cca (PR #21 merged).
Preparation branch: deploy/hostinger-production. Historical/staging branches preserved.

## Configuration authority

Only https://purple-skunk-677919.hostingersite.com is added to the explicit Production origin gates. APP_URL alone cannot authorize a release: production remains null until an independently reviewed manifest is issued for the final real Git HEAD, the verified Production publishable-key digest, the exact origin and Production project suozeqelwmhjlptzaqsk. No wildcard, local/staging exception, bypass or automatic attestation write is added.

This change neither recreates nor modifies accounts, organizations, Store scope, permissions, RLS, markets or Finance. Reusing the same verified backend preserves existing application records and authorizations; a separate browser login is needed for the new origin. Live owner verification attempted with the approved local DPAPI Auth Admin secret returned HTTP 401. Current owner membership/roles, paused scope and publication=false therefore remain UNVERIFIED, not certified from historical evidence.

## Hostinger values (same during build and runtime)

APP_ENV=production
APP_URL=https://purple-skunk-677919.hostingersite.com
NEXT_PUBLIC_SUPABASE_URL=https://suozeqelwmhjlptzaqsk.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<verified Production publishable key only>
STAGING_AUTH_SMOKE_ENABLED=false

Do not upload database passwords, Auth Admin secret, Resend credentials or DPAPI files. Do not use APP_ENV=staging, Staging keys or Vercel platform variables. Node 24.x; install npm ci; build npm run build; start npm run start, honoring the assigned PORT. Preserve .naql365-build-identity.json and the issued config/deployment-manifest.json. Keep auto-deployment and PR previews OFF; do not push until their current state is proven.

## Shared deployment identity and Vercel continuity

There is one backend identity/revision tuple. Do NOT replace it for this Hostinger release while Vercel must continue operating. The guard already permits independently issued manifests for different origins/source commits to attest against the same currently approved backend designation; source SHA, exact origin, key digest, manifest digest and build artifact remain independently bound for each package. Any reuse of that existing tuple requires a fresh read and explicit review of the final manifest. If the release policy requires rotating the tuple, stop: that rotation conflicts with keeping Vercel operational and needs a coordinated cutover authorization. Do not weaken checks or copy an unverified historical tuple.

## Auth configuration proposal only

Keep Site URL and all current Vercel Redirect URLs unchanged. Add only these exact URLs to the existing Production project's redirect allowlist after review:

- https://purple-skunk-677919.hostingersite.com/auth/callback?locale=ar
- https://purple-skunk-677919.hostingersite.com/auth/callback?locale=en
- https://purple-skunk-677919.hostingersite.com/auth/callback?locale=ar&next=/ar/password
- https://purple-skunk-677919.hostingersite.com/auth/callback?locale=en&next=/en/password

Do not change SMTP, templates, users or invite anyone. Existing RedirectTo invitation template uses the explicit chosen callback; Site URL need not be moved away from Vercel.

## Remaining publication gates

1. Restore authorized read-only Production administration: local secret currently returns 401. Verify owner membership/roles, EG market, scope_paused=true, publication_enabled=false and current deployment attestation. Never bootstrap again.
2. Verify Hostinger Auto-deployment/PR previews OFF and actual supported access restriction before push/deploy. Browser access is currently unavailable; do not invent hostingerProtection.
3. Review/publish the preparation commit, select its actual final SHA, issue the external Production manifest and perform the actual Production release build with verified public configuration. Repository production:null is intentional and will reject an unissued Production build.
4. Configure the reviewed Auth redirect additions and Hostinger environment. Manual deployment only after the package/guard/configuration/protection gates pass. No test products/orders in Production.

## Focused security verification

27 guard tests passed, including independent Manifest approval, exact origin, Production/Staging separation, public-key digest, CSRF, build/runtime mismatch, positive/missing/mismatched attestation. No business authorization or database policy changed. A local-configuration optimized build is a compilation regression check, not an issued Production release or a hosted login test.

## Native npm run build manifest preparation

Hostinger should select the standard npm run build entry. scripts/guarded-next.mjs invokes scripts/prepare-release-manifest.mjs before loading the manifest during build only. No framework change or custom platform build command is required.

Provide NAQL365_RELEASE_MANIFEST_BASE64 and NAQL365_RELEASE_MANIFEST_SHA256 as build environment values from the same independently reviewed release. They contain no secrets. The helper checks exact encoded bytes and SHA-256, actual Git HEAD, Production environment/origin/backend/public-key digest and UUID designations before writing the manifest. No input values are logged. Invalid, incomplete, stale or environment-mismatched input fails closed. Source-integrity checks, Build Identity and runtime attestation remain in guarded-next; runtime never installs a manifest from environment variables.

Local/Staging builds and previously issued Vercel release manifests remain supported when both transport variables are absent. Absence of transport does not authorize Production: production:null is still rejected by the existing guard. Do not carry stale transport values into local or Staging builds.

Any new source commit needs a newly issued manifest sourceCommit and a new byte digest. Do not reuse the a285ee3 manifest or its SHA-256 for this change. Issue the final manifest outside Git after the actual new commit exists; retain the current independently verified backend tuple to avoid disrupting Vercel. No database writes or identity rotation are part of this preparation.

For an exported Hostinger checkout, include production.gitCommitObject in the issued manifest. On the trusted issuer encode the exact bytes from git cat-file commit <approved SHA> as Base64. Before installing that manifest, the build hashes the commit object and reconstructs its Git tree from checkout paths, contents and executable bits. A clean Linux export with only the installed root node_modules directory added is supported. Extra source files, missing files and modified bytes fail verification. Existing Git checkouts continue through the HEAD and working tree checks.
