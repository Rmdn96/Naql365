# Authentication and RBAC

## Identity and enrollment

Supabase Auth owns passwords and sessions. Creating an Auth user creates a profile with Arabic default through a database trigger. Editable user metadata does not grant a role, tenant or staff status. Customer self-registration uses email confirmation and a 12-character password minimum. In Phase 1, confirmed users complete their name, normalized phone and locale through a validated onboarding command. The database chooses the privately configured operating organization and grants only CUSTOMER; no browser-provided tenant or role is accepted. An unassigned profile has no tenant data access; suspended membership cannot re-enroll to regain it.

Staff are invitation-only. Drivers are invited or created by a trusted administrator. No self-service action accepts a member_type, role or arbitrary tenant. Provisioning requires a trusted operator transaction that inserts the membership and an appropriate user_role after validating the intended organization, user UUID and member type. Use environment-managed administrative credentials in a separate operational context; the application contains no service-role client or administrative secret variable.

The database role-assignment trigger prevents assigning a staff role to a customer membership or a driver role to staff. Permission checks also join the role's member type, so changing a membership type cannot preserve incompatible privileges.

## Roles and permissions

| Role             | Initial scope                                             |
| ---------------- | --------------------------------------------------------- |
| SUPER_ADMIN      | All explicitly seeded permissions inside its organization |
| SALES            | Portal, customers, requests, quotes, services read        |
| OPERATIONS       | Portal, requests, orders, trips, fleet, services read     |
| DISPATCHER       | Portal, orders, trips, fleet read                         |
| FINANCE          | Portal and finance read                                   |
| CUSTOMER_SERVICE | Portal, customers, requests, support read                 |
| DRIVER           | Driver shell access                                       |
| CUSTOMER         | Own customer profile, requests and private request images |

Permissions are rows linked by role_permissions; adding a permission requires a migration/data change and explicit service/policy enforcement, not a schema redesign. No role has wildcard access. `users.manage` and `notifications.manage` reserve intent, but do not expose management writes in Phase 0. Any new permission must be explicitly granted to roles including SUPER_ADMIN.

## Server safety

Proxy refreshes sessions on authentication/protected routes using verified claims and preserves refreshed cookies in the outgoing response and incoming request. Protected server access uses getUser() for an up-to-date identity, then checks database memberships and has_permission RPC. JWT role claims are not the authority for RBAC. Suspension/revocation therefore applies without waiting for a new role token.

Supabase server and browser clients use the publishable key. Server Components read cookies; callback handlers explicitly opt into cookie writes. PKCE code exchange is implemented at `/auth/callback`. Redirects permit only known localized internal destinations and use APP_URL instead of an untrusted forwarded host. Phase 1 exposes localized register/login/recover/password forms and guarded onboarding/intake mutations. Recovery uses the exact locale password destination; error responses do not disclose provider details or account existence.

A protected layout is insufficient for future mutations: each server action/route/service must validate input, verify identity, validate tenant context, authorize the precise permission and execute via the RLS-scoped database client. Never trust a browser-supplied user ID or email. Add transactional database functions only where necessary, with narrowly scoped execution privileges and negative tests.
