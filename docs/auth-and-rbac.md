# Authentication and RBAC

## Identity and enrollment

Supabase Auth owns passwords and sessions. Creating an Auth user creates a profile with Arabic default through a database trigger. Editable user metadata does not grant a role, tenant or staff status. Customer self-registration is enabled at the Auth configuration layer with email confirmation and a 12-character password minimum. The customer enrollment UI, organization selection and customer-record transaction are deliberately deferred; an unassigned profile has no tenant data access.

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
| CUSTOMER         | Customer shell access                                     |

Permissions are rows linked by role_permissions; adding a permission requires a migration/data change and explicit service/policy enforcement, not a schema redesign. No role has wildcard access. `users.manage` and `notifications.manage` reserve intent, but do not expose management writes in Phase 0. Any new permission must be explicitly granted to roles including SUPER_ADMIN.

## Server safety

Proxy refreshes sessions on authentication/protected routes using verified claims and preserves refreshed cookies in the outgoing response and incoming request. Protected server access uses getUser() for an up-to-date identity, then checks database memberships and has_permission RPC. JWT role claims are not the authority for RBAC. Suspension/revocation therefore applies without waiting for a new role token.

Supabase server and browser clients use the publishable key. Server Components read cookies; callback handlers explicitly opt into cookie writes. PKCE code exchange is implemented at `/auth/callback`. Redirects permit only known localized internal destinations and use APP_URL instead of an untrusted forwarded host. Login remains a clearly labeled placeholder. No server mutation route or sign-in form is exposed yet.

A protected layout is insufficient for future mutations: each server action/route/service must validate input, verify identity, validate tenant context, authorize the precise permission and execute via the RLS-scoped database client. Never trust a browser-supplied user ID or email. Add transactional database functions only where necessary, with narrowly scoped execution privileges and negative tests.
