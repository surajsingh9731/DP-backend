# ADR-0001: Folder architecture for the Sahmati R1 rebuild

**Status:** Accepted
**Date:** 2026-10-17
**Deciders:** Suraj (project owner)

## Context

The prior build mixed a reasonable module shape with a local-sample/mock
posture that this rebuild explicitly removes. We need a folder structure
that (a) keeps controllers transport-only, (b) makes sector behaviour pure
data, (c) makes the WhatsApp/email channel choice swappable without
touching callers, and (d) is mechanically checkable (architecture tests),
not just a convention in a doc nobody re-reads.

## Decision

One NestJS module per bounded context; one Angular feature folder per
module/screen group; both organized **by type within each module**
(controllers/services/entities/dto, or in the frontend's case
components/forms/locales), per the standing instruction. Sector behaviour
lives in `sector-packs/` as data (JSON + a loader), never as `if (sector === …)`
in engine code.

## Backend tree (dp-backend)

```
src/
  main.ts                      # API process bootstrap
  app.module.ts
  config/
    app-config.module.ts
    app-config.service.ts
    env.validation.ts
  database/
    data-source.ts
    database.module.ts
    snake-case.naming-strategy.ts
    rls/
      enable-rls.ts             # helper applied per-migration
    migrations/
  common/
    decorators/
    dto/                        # cross-module shared DTOs only (pagination etc.)
    filters/
      http-exception.filter.ts
    guards/
      session.guard.ts
      tenant-membership.guard.ts
    interceptors/
      tenant-context.interceptor.ts   # SET LOCAL app.tenant_id, per-request QueryRunner
    pagination/
      cursor.ts
    services/
      evidence-ledger.service.ts
      idempotency.service.ts
    common.module.ts
  notifications/                      # the Strategy/DIP seam
    notification-channel.port.ts      # interface NotificationChannel
    channels/
      whatsapp-channel.service.ts
      email-channel.service.ts
    notifications.module.ts
  auth/
    controllers/
    services/
    entities/
    dto/
    auth.module.ts
  sector-packs/
    data/
      education.v1.json
    services/
      sector-pack-registry.service.ts
    sector-packs.module.ts
  register/            (controllers/ services/ entities/ dto/, as above)
  notices/
  consent/
  rights/
  breach/
  retention/
  dashboard/
  messages/
    entities/
      message-outbox.entity.ts
    services/
      messages.service.ts           # depends on NotificationChannel port only
    messages.module.ts
  worker/
    main.ts                          # separate delivery-worker process
    services/
      worker-runner.service.ts
    worker.module.ts
tests/
  unit/
  architecture/        # enforces: controllers import no TypeORM; services never import @nestjs/common Controller
  integration/         # real Postgres, real RLS policies exercised
```

**New architecture test required for R1** (extends the prior
`thin-controllers.spec.ts`): a tenant-isolation integration test that opens
two tenants' data in the same process and asserts a cross-tenant read
returns empty via RLS even if a service bug forgot a `WHERE tenant_id`
clause — this is the test that actually proves the NFR, not just documents
it.

## Frontend tree (dp-frontend)

```
src/app/
  core/
    api/
      <module>-api.service.ts        # one per backend module, thin HTTP wrapper
    guards/
    i18n/
      en.ts / hi.ts (merged catalog, not per-feature duplicate keys)
    ui/                               # shared presentational primitives (status-banner, buttons, cards)
    forms/
  features/
    <module-name>/
      <module-name>.component.ts
      <module-name>.component.html
      <module-name>.component.scss
      <module-name>.forms.ts
      locales/en.ts, locales/hi.ts
  app.routes.ts
  app.component.ts
```

Rule: a `features/*` folder may only import from `core/`, never from
another `features/*` folder. Cross-feature reuse goes through `core/ui` or
`core/api`.

## How to add a new module (checklist)

1. Backend: `src/<module>/{controllers,services,entities,dto}`, a
   `<module>.module.ts`, migration(s) under `database/migrations/`, add to
   `app.module.ts`.
2. If it sends evidence: call `EvidenceLedgerService.append` from the
   service layer only (never the controller).
3. If it notifies anyone: depend on `NotificationChannel` (via
   `MessagesService`), never a concrete channel.
4. Add an architecture test assertion if the module introduces a new
   transport-only rule to enforce.
5. Frontend: `features/<module>/`, one `core/api/<module>-api.service.ts`,
   route entry in `app.routes.ts`, EN/HI locale files.

## How to add a new sector pack (should touch zero engine TypeScript)

1. Add `src/sector-packs/data/<pack>.v1.json` describing setup questions,
   data categories + default legal basis, default retention days, notice
   clause templates (en/hi), exemption rules.
2. Insert a `sector_pack_versions` row (or a seed migration for it) with
   `is_active = true`.
3. Nothing else changes — `register`, `notices`, and `retention` all read
   the active pack's schema at runtime.

## Consequences

- Controllers/services/entities-by-type (not by-feature-flat) keeps the
  "everything for a module in one place but typed consistently" property
  the earlier build already had — this ADR keeps it, doesn't change it.
- The `notifications/` seam means Module M's WhatsApp-vs-email decision is
  a DI binding, not a rewrite, when WhatsApp approval lands.
- The tenant-isolation integration test is non-negotiable before any
  module ships — it's the actual proof behind acceptance criterion #9.
