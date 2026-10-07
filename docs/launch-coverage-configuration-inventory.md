# Launch coverage and service configuration inventory

Read-only Staging inventory: 2026-10-07, verified project `zuvyfeflkzlciuaauxba`, using `scripts/staging/inventory-launch-coverage.mjs`. No hosted configuration was changed to obtain this inventory.

| Market | Catalogue cities currently present | Pre-rollout active coverage                                                                    |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| SA     | Riyadh, Jeddah                     | Each has five active service coverage rows: goods, furniture, within-city, intercity, business |
| EG     | Cairo, Alexandria                  | Each has the same five active service coverage rows                                            |

These four cities are also the repository's initial geographic catalogue. Active Staging coverage is synthetic acceptance configuration, not Production authorization or nationwide operational coverage. Migration 46 preserves existing directions; explicit launch configuration must restrict origin eligibility.

## Nationwide destination gap

The catalogue is not nationwide. Every owner-approved destination other than Riyadh/Jeddah (SA) and Cairo/Alexandria (EG) still requires a city record under its correct region/Market and an activated city/service coverage row. No exhaustive owner-approved destination list has been supplied; the missing set cannot honestly be declared complete by guessing city names or equating every municipality with operational support.

Before advertising “all cities”, obtain the authoritative supported destination inventory for each country, reconcile stable codes/regions against it, add the missing cities, confirm operational service/add-on availability for each, and verify coverage readback. Until then, say “supported cities” and show only activated destinations. No city or region is silently created or activated by migration 46.

## Service meaning and applicability

Existing goods means cargo/freight and furniture means furniture moving. Existing generic business/within-city/intercity entries are retained, not deleted. The explicit Staging configuration adds household relocation and office relocation as configurable service records and unpacking as an add-on. Existing packing, loading, unloading, dismantling and assembly remain reusable records.

The new `service_addon_applicability` relation scopes options by organization, Market and service. Migration backfill preserves prior organization-wide applicability only for existing combinations; new combinations require explicit activation. The wizard filters by applicability and the shared submit command rejects unsupported selections.

`scripts/staging/configure-manual-launch.mjs --apply` is the bounded, later acceptance configuration step. It configures the four representative cities and explicit services, switches both SA/EG pricing modes to MANUAL and reads them back. It does not configure tax, payment destinations, Production or nationwide coverage. Do not run it before local/CI gates pass. Production catalogue activation remains a separately authorized owner-controlled operation.

## Verified Staging rollout

After CI 37617321428 passed, the bounded script was applied on 2026-10-07. Readback confirmed SA and EG MANUAL. The same four catalogue cities now each have seven active service coverage rows, adding household and office relocation. Riyadh/Cairo are pickup+delivery eligible; Jeddah/Alexandria are delivery-only. No additional city was created. Unpacking and explicit scoped applicability are retained as intended Staging configuration. This does not authorize Production activation.
