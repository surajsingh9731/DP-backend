# Sahmati R1 — system design

Status: design baseline for the from-scratch R1 rebuild. Supersedes the prior
local-sample sandbox. Everything here assumes real, dynamic data — no mock
mode, no synthetic participants.

## 1. Requirements

**Functional (R1 only, per the project brief's own staging):**
modules A (account/access), B (data register), C (notice builder), D (real
consent capture), F (consent ledger/withdrawal), G (rights/grievance desk),
H (breach desk), I (retention/erasure), L (dashboard), M (messaging), plus
the Education sector pack as data.

**Non-functional, binding for R1:**
- Tenant isolation enforced at the database layer (Postgres RLS), not only
  in application guards.
- Append-only, hash-chained evidence ledger; DB-level privileges prevent
  UPDATE/DELETE on it, not just ORM convention.
- Real OTP delivery (WhatsApp Cloud API primary, email fallback) — no
  synthetic/local-sample participant sessions.
- OWASP Top 10 aware design; SAST-clean code.
- SOLID/DRY module boundaries; sector behaviour is data-driven, never a
  per-sector `if` branch in engine code.

**Constraints:** two-developer team pace (here: one Claude Code session),
NestJS + PostgreSQL + TypeORM backend, Angular + UX4G frontend, AWS Mumbai
target hosting (not provisioned in this dev pass).

## 2. High-level component map

```
                      ┌─────────────────────────┐
                      │   Angular (UX4G) SPA     │
                      │  owner/staff/viewer UI   │
                      │  + public (no-login) UI  │
                      └───────────┬──────────────┘
                                  │ REST (/api/*, /api/public/*)
                      ┌───────────▼──────────────┐
                      │   NestJS API (single      │
                      │   deployable, modular     │
                      │   monolith)                │
                      │                            │
   ┌──────────────┐   │  Auth · Register · Notices │   ┌────────────────┐
   │ WhatsApp      │◄──┤  Consent · Ledger · Rights │──►│ PostgreSQL      │
   │ Cloud API     │   │  Breach · Retention        │   │ (RLS enforced,  │
   └──────────────┘   │  Dashboard · Messaging      │   │  hash-chained   │
   ┌──────────────┐   │  SectorPacks (data loader)  │   │  ledger table)  │
   │ SMTP (email,  │◄──┤                             │   └────────────────┘
   │ itpo_admin)   │   └────────────────────────────┘
   └──────────────┘
```

One deployable for R1 (modular monolith), same pattern as before — module
boundaries are enforced by NestJS module graph + lint rules, not process
separation. A later worker process (outbound message delivery) is still a
separate entry point (`src/worker/main.ts`) for the same reasons as before:
independent restart/scale from the API process.

## 3. Tenant isolation: PostgreSQL RLS (the fix for the prior gap)

Every tenant-owned table carries `tenant_id uuid not null`. Isolation is
enforced in two layers, and the DB layer is the one that's actually trusted:

1. **Database (enforced):**
   - `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY; ALTER TABLE <t> FORCE ROW LEVEL SECURITY;`
   - Policy: `USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`
     for `SELECT/UPDATE/DELETE`, and a matching `WITH CHECK` for
     `INSERT/UPDATE`.
   - The application's Postgres role is **not** a superuser and does not
     own the tables (owner bypasses RLS by default), so RLS cannot be
     silently bypassed by the app connection.
   - A second, separate Postgres role (`sahmati_admin`) with
     `BYPASSRLS`, used *only* by the platform-admin module's explicit
     cross-tenant queries (sector pack management, support access grants) —
     never by request-scoped services.
   - `current_setting('app.tenant_id')` is set with `SET LOCAL` inside the
     same transaction as every request, via a TypeORM `QueryRunner`
     acquired per request (not the shared pool), so it can never leak
     across pooled connections between requests.

2. **Application (defense-in-depth, not the enforcement boundary):**
   - `TenantContextInterceptor` resolves the authenticated session's
     tenant and role, opens a `QueryRunner`, runs
     `SET LOCAL app.tenant_id = $1` inside a transaction, and attaches that
     query runner's manager to the request so every repository call in
     that request goes through the RLS-scoped connection.
   - `TenantMembershipGuard` keeps checking role (owner/staff/viewer)
     for authorization — RLS only proves tenant *isolation*, not role
     permissions within a tenant.

This directly satisfies the brief's NFR ("tenant isolation through
PostgreSQL row-level security") and acceptance criterion #9 ("one school's
staff can never see another school's data (tested)") at the layer that's
actually hard to get wrong by a future code change in a service.

**One deliberate exception:** the `organisations` table (the tenant root
itself) carries a `FOR SELECT USING (true)` policy, because the public
notice/Privacy Center flow must resolve an organisation by its public slug
with no session and no tenant context. Only identity/notice-safe columns
belong on this table as a result — nothing sensitive is ever stored on
`organisations` itself. Writes stay tenant-scoped (`FOR UPDATE USING (id =
current_setting('app.tenant_id', true)::uuid)`); `INSERT` is open (`FOR
INSERT WITH CHECK (true)`) since creating a new org during signup happens
before any tenant context exists to check against, and an extra org row
touches no other tenant's data — abuse there is a signup-rate-limiting
concern, not a tenant-isolation one. Every other table keeps the strict
`tenant_id = current_setting(...)` policy with no public-read carve-out.

**Support/platform-admin cross-tenant access** (brief §"No access without
permission") is modelled explicitly: a `support_access_grant` row
(tenant_id, grantee_user_id, scope, expires_at, granted_by) that a request
must present to have `app.tenant_id` widened to include a second tenant for
the duration of the grant — never a blanket bypass.

## 4. Auth & OTP (real, not synthetic)

- **Staff/owner login:** email or WhatsApp number → OTP. OTP is a random
  6-digit code, stored as `HMAC-SHA256(code, AUTH_PEPPER)`, 5-minute expiry,
  max 5 verify attempts then locked for 15 minutes. Delivered via:
  - `WhatsAppChannel` (WhatsApp Cloud API) when the org has a verified
    WhatsApp-capable number and template approval is live, or
  - `EmailChannel` (SMTP, `itpo_admin` account in dev) as the always-available
    fallback.
  - Both implement a single `NotificationChannel` port (Strategy pattern);
    `MessagesService` picks the channel per recipient/purpose, so adding a
    channel later (SMS) never touches calling code — satisfies DIP/OCP.
- **Session:** opaque random token, httpOnly/SameSite=Strict cookie, hashed
  server-side (as before), but now the only path to a session is a real OTP
  round-trip — no seeded/synthetic session.
- **Public data-principal access (module 17/4 flows):** a *separate* token
  namespace, `public_verification_sessions` (org-scoped, phone/email-scoped,
  15-minute TTL, re-verifiable), returned as a bearer token to the SPA for
  cross-origin WhatsApp-link landings rather than a cookie. Verification
  failure never reveals whether a phone/email has records (brief §17.2–17.3).

## 5. Evidence ledger

`evidence_ledger_entries(id, tenant_id, kind, source_id, action, status,
actor_id NULL, provenance, previous_hash, event_hash, occurred_at)`.

- Chain is **per tenant**: `previous_hash` is the latest `event_hash` for
  that `tenant_id`, so chains don't couple unrelated tenants and a tenant's
  integrity can be verified independently.
- `event_hash = SHA256(canonical_json({tenant_id, kind, source_id, action,
  status, previous_hash, occurred_at}))`.
- DB grants: the application role has `INSERT, SELECT` only on this table —
  no `UPDATE`/`DELETE` grant exists at all, so "append-only" is a Postgres
  privilege fact, not just a convention the service layer happens to follow.
- A correction is always a *new* event referencing the original via
  `source_id`/`action: "correction"`, never a mutation.

## 6. Sector packs as data

- `sector_pack_versions(id, code, version, schema_json, is_active)` — one
  row per published version of a pack (Education for R1).
- `schema_json` shape: setup questions, data categories with default legal
  basis, default retention days per category, notice clause templates
  (en/hi), and exemption rules (e.g. `{"appliesIf": "schools", "exemption":
  "tracking_and_safety_only"}` per Fourth Schedule).
- Engine code (register, notices, retention) reads the active pack's
  `schema_json` for the tenant's chosen pack; it never branches on a sector
  string. Adding a ninth pack is a new DB row, not a code change — this is
  the literal requirement from the brief ("a ninth sector should need no
  engine change").

## 7. Module → table ownership (R1)

| Module | Owns |
|---|---|
| A — auth | users, memberships, branches, sessions, activity_log, public_verification_sessions |
| B — register | data_register_entries, data_register_revisions |
| Sector packs | sector_pack_versions |
| C — notices | notices, notice_versions |
| D/F — consent | consent_offers, consent_receipts (ledger of recorded/withdrawn choices) |
| G — rights | rights_requests, rights_work_items, rights_responses |
| H — breach | breach_incidents, breach_reports, breach_notifications |
| I — retention | retention_policies, retention_holds, retention_previews |
| L — dashboard | reads across modules + live_checks |
| M — messaging | message_outbox (+ WhatsApp/email channel adapters) |
| shared | evidence_ledger_entries, idempotency_keys |

## 8. API shape

- `/api/*` — authenticated owner/staff/viewer endpoints, tenant resolved
  from session (never from a client-supplied tenant id in the path for
  mutation safety beyond RLS).
- `/api/public/:orgSlug/*` — anonymous notice/contact read, OTP-gated
  consent/withdrawal/rights actions, bearer-token verified sessions.
- `/api/admin/*` — platform-admin only, `BYPASSRLS` role, sector pack
  publishing, support-access grants.

## 8b. Operational note: Postgres roles are cluster-wide

`sahmati_app` is a single role created by the Foundation migration's
`ALTER ROLE ... WITH PASSWORD`. Roles live at the cluster level, not per
database — running the migration against `sahmati_test` after
`sahmati_local` overwrites the same role's password. Local dev and the
test database therefore share one `DB_PASSWORD` value in `.env`/`.env.test`.
This is fine for a single local Postgres instance; a real multi-environment
deployment would use distinct roles per environment (or per-database
connection limits) instead of sharing one role's credentials.

## 9. Trade-offs to revisit

- RLS via `SET LOCAL` on a per-request `QueryRunner` costs one extra
  round-trip per request versus the shared pool; acceptable at R1 scale,
  revisit with a connection-pool-aware RLS strategy (e.g. pgbouncer
  transaction pooling caveats) before real multi-branch scale.
- WhatsApp Cloud API template approval is days-to-weeks (brief §13 risks);
  until approved, email (`itpo_admin` SMTP) is the only live channel — the
  `NotificationChannel` abstraction exists specifically so this is a config
  change, not a rewrite, once WhatsApp approval lands.
- Modelling this as one modular monolith (not split services) matches team
  size; revisit only if a module's load profile genuinely diverges (e.g.
  the message worker already runs as its own process for this reason).
