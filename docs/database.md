# Database foundation

## Migrations

`20260909000100_identity_and_domain.sql`: identity, organization membership, RBAC, audit triggers and relational domain tables. Seeds only the role/permission catalogue; no organization or operational sample records. `20260909000200_private_storage.sql`: three private buckets and registry-based access policy. `20260909000300_role_integrity_indexes.sql`: reverse relationship indexes and customer/driver membership-type integrity. Apply in order via Supabase CLI to a fresh isolated environment first. Never edit an applied production migration; future changes require new migration files.

Foundation public tables (37): organizations, branches, profiles, organization_memberships, roles, permissions, user_roles, role_permissions, audit_logs; customers, drivers, vehicles, teams, services, service_areas; requests, request_items, file_objects, request_attachments; quotes, quote_versions, quote_items; orders, jobs, trips, trip_stops, trip_events, assignments; payments, payment_transactions, invoices; notification_templates, notifications; reviews, quality_alerts, issues, support_notes.

Phase 1 migration `20260910000100_customer_request_intake.sql` adds request_locations, additional_services and request_additional_services (40 public tables, all RLS), private enrollment/reference-counter tables, validated onboarding/request/file commands and normalized intake columns. `20260910000200_storage_upload_completion_guard.sql` aligns Storage preflight contentLength with final size and serializes completion against draft/reservation state. Applied migrations remain immutable. See [intake decisions](customer-request-intake.md) for the prior schema-gap inspection and state machine.

Each operational table has UUID primary key, organization reference, tenant-composite unique key, created_at and updated_at. Join catalogues use natural composite primary keys. Audit events use occurred_at. Tenant FKs and composite relationship indexes support referential checks and scoped queries. No blanket soft deletion; suspension is a membership state. No business status enumeration is invented before workflow design.

## Relationship invariants

`customer → request → quote → quote_version → order → job → trip → stops/events/assignments`.

Request items/attachments belong to a request. A quote version belongs to one quote, with a unique positive version number. An order references `(organization, quote, accepted version)`, has a unique idempotency key within its organization and cannot duplicate its quote even when a different version is accepted. Multiple jobs and trips are supported. Stops have unique non-negative positions per trip. Events can reference a stop only within the same trip. Assignments can refer to drivers, vehicles and/or teams in the same organization.

Payment transaction provider event identifiers are unique per organization/provider. Payment/invoice financial fields and transitions remain deferred. Reviews relate to customer and order, but matching that customer's ownership to the order requires the future authorized review service; no write access exists now. The same rule applies to attachment purpose and assigned-driver access: relationships exist, workflows do not.

## RLS matrix

| Resource                             | Customer                                | Staff                             | Unauthenticated |
| ------------------------------------ | --------------------------------------- | --------------------------------- | --------------- |
| Profile                              | Own                                     | Own                               | Denied          |
| Organization/branches                | Active membership                       | Active membership                 | Denied          |
| Membership/role grants               | Own active membership                   | Own active membership             | Denied          |
| Role/permission catalogue            | Read shared non-sensitive catalogue     | Read                              | Denied          |
| Customers/requests/items/attachments | Own customer/request                    | Explicit read permission + tenant | Denied          |
| Files                                | Own registered file + active membership | files.read + tenant               | Denied          |
| Operational/finance/support tables   | Denied pending workflows                | Specific read permission + tenant | Denied          |
| Notifications                        | Own recipient + membership              | Own recipient + membership        | Denied          |
| Audit logs                           | Denied                                  | audit.read + tenant               | Denied          |
| Direct application table writes      | Denied                                  | Denied                            | Denied          |
| Customer intake RPCs                 | Own active customer; validated commands | No implicit customer ownership    | Denied          |

Drivers can enter only their protected shell with driver.access; dispatch/job reads await assignment-based policies. Function owners can bypass RLS to resolve membership without recursion; these narrowly scoped functions use a fixed empty search_path, derive identity from auth.uid(), have PUBLIC execution revoked and authenticated execution explicitly granted. The private schema is not exposed through the Data API. Global catalogue policies are intentionally read-only; they contain no tenants or credentials.

## Audit and storage

Audit logs record actor, tenant, action, table/entity, identifier, time, metadata and before/after snapshots. Triggers cover membership/role changes, quotes/versions, orders, assignments, payment changes and reviews. Catalogue changes have no tenant and are visible only to the trusted database operator. Trigger logging is in the same transaction as the change. Client writes, updates and deletes to audit logs are denied. Trusted maintenance and retention procedures remain an operational responsibility; no claim of tamper resistance against a database owner is made.

file_objects is an authorization registry. Object names are database-generated `organization/profile/file-id`, without user filenames. Buckets are private and MIME/size constrained. A server-only function verifies the user, reads the registry through RLS and returns a 60-second signed download URL using the user's client. An expired/suspended user cannot create a new URL; an already-issued URL remains usable until its brief expiry. Signed URLs are bearer capabilities and must never be logged. Uploads and scanning are deferred; no permissive upload policy exists.

## Generated types and testing

`npm run db:types` generates complete Supabase TypeScript definitions against a running local stack. The Docker-free generator reads actual PostgreSQL metadata after applying migrations for local bootstrap. CI generates the full SDK types and typechecks all adapters against them, exporting an artifact. Never hand-edit generated types.

Shared tests use rollback-only records from supabase/tests/foundation.test.sql and customer_request.test.sql. They check isolation, privileges, storage, metadata escalation, suspended membership, audit visibility, duplicate acceptance, cross-tenant FKs, onboarding, draft revisions, immutable submission and private upload completion. Full Supabase CI remains required even if embedded PostgreSQL passes; embedded auth/storage schemas emulate only the contracts used by these migrations.

## Phase 2 additions

Migrations 20260910000400 through 20260910000700 add the pricing schema, transactional commands, RLS and persisted expiry transition. The full migration chain contains ten files and 47 public tables with RLS. New relations are vehicle_pricing_classes, pricing_settings, pricing_rules, distance_snapshots, pricing_evaluations, pricing_evaluation_components and quote_pricing_details. Existing quote/version/item/order relations are extended rather than duplicated. Customer-safe commercial snapshots are separated from internal evaluations and adjustment reasons. Expiry returns a structured rejection after committing EXPIRED, avoiding rollback of the state transition. See pricing-and-quotes.md for invariants.

## Phase 3 additions

The three 20260912 migrations extend the existing Job/Trip/Stop/Driver/Vehicle/assignment/event relations and add trip_stop_dependencies and trip_pods. The complete chain now has thirteen migrations and 49 public tables, all with RLS. One primary Job per accepted Order, independent active Driver/Vehicle constraints, explicit Stop dependencies, immutable event/POD history and derived aggregate completion are enforced transactionally. Private operational mutation records provide idempotency; reference counters preserve monotonic allocation and are not reset by fixture cleanup.

The authoritative Supabase CLI generated types were compared with complete Supabase CI and hosted Staging, including hosted PostgREST version metadata. Hosted rollback SQL and independent-connection CI concurrency tests complement application tests. See [operations decisions](operations-dispatch-pod.md) and the canonical Phase 3 report for exact evidence and migration hashes/history.
