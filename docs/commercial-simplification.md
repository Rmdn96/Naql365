# Commercial launch operating notes

## Public storefront

The four public navigation destinations are Home, Cart, Transport and Contact. Products, categories, search and contact stay on the locale homepage. Existing saleable listings still come from the commercial catalog and may represent a bundle when an approved bundle is created in that catalog. Company services need approved content before publication. The storefront uses existing Naql365 packaging artwork. The WhatsApp glyph is the unmodified digital black glyph from Meta's [WhatsApp brand pack](https://www.meta.com/brand/resources/whatsapp/whatsapp-brand/), used next to an external WhatsApp contact link.

## Database changes

- `20261126000100_store_guest_manual_channels.sql` adds the wallet methods to the guest intake and the reviewed-order collection command. It keeps the original immutable records and receipt uniqueness. Each manual method needs an active destination in the approved checkout contract. Confirmation snapshots that destination and collection requires the exact amount and an independently verified reference. Existing proof-based collection remains available for historical orders.
- `20261126000200_commercial_admin_gate.sql` adds a server role check, a Supabase Auth token hook and a PostgREST pre-request gate. The migration itself creates the functions. It does not change live Auth settings, rotate sessions, modify user accounts or change grants on application data.

## Activation sequence

1. Preserve the approved application build and database backup. Keep publication off and compare the production schema with the reviewed baseline before applying only the two new migrations.
2. Check that the single intended operator has an active staff membership and the existing SUPER_ADMIN role. Set the server-only `NAQL365_ADMIN_RECOVERY_EMAIL` to that operator's approved mailbox. Verify login and recovery privately with the operator.
3. In Supabase, disable public/anonymous signup and enable the Custom Access Token Hook at `pg-functions://postgres/private/commercial_auth_token_hook`. Check any currently configured hook before replacing it. The token hook gates sign-in and refresh. The application only sends recovery mail to the configured mailbox, with the same public response for all addresses. Calls to Supabase Auth recovery directly may still deliver mail, but a non-admin cannot establish a usable session through the token hook.
4. Review any current `pgrst.db_pre_request` on the PostgREST authenticator role before configuring `public.commercial_api_session_gate` and reloading PostgREST configuration. Preserve any existing pre-request function by composing the checks when necessary. Verify anonymous storefront/transport and admin access with a new session. The gate excludes previous non-admin bearer tokens from PostgREST. Wait out the configured JWT lifetime after hook activation before opening sales, because JWTs already issued can remain valid on services outside PostgREST, including Storage. Previously issued signed download URLs have their own expiry.
5. Keep the store paused until approved real products, imagery, descriptions, price and availability, checkout contract, Cairo/Giza delivery, each receiving destination and beneficiary, public phone/WhatsApp, and commercial policies are supplied and checked. Confirm roles and audit events in the isolated environment before changing production settings.

Roll back the application to the approved baseline if needed. Restore previous gateway and Auth settings only if the old access model is explicitly reapproved. Keep the additive checkout schema and receipts when any new manual orders exist. A rollback must preserve those orders and their verified financial records. The baseline may not expose the newer manual channels in its operator workflow, so keep intake paused and step through any outstanding reviews on a compatible build.
