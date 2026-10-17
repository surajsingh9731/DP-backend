# Sahmati — backend

NestJS 12 / TypeORM 1.1 / PostgreSQL. A local-sample DPDP workflow
backend for small Indian organisations — see the brief and handover docs
your project keeps elsewhere for the product scope and boundaries.

**Local setup (clone this alongside `dp-frontend` as `backend`/`frontend`
siblings, create your own database, run migrations):** see
[`docs/LOCAL-SETUP.md`](docs/LOCAL-SETUP.md).

## Layout

Each feature module (`src/<module>/`) follows the same shape:

```
src/<module>/
├── controllers/   HTTP routes — transport only, no persistence
├── services/       business logic, transactions, evidence-ledger writes
├── entities/       TypeORM entities
└── dto/            request validation (class-validator)
```

Cross-cutting pieces live in `src/common/` (session/tenant guards,
the shared evidence ledger, idempotency), `src/config/` (validated env),
`src/bootstrap/` (middleware wired in `main.ts`), and `src/database/`
(the single `DataSource` used by both the running app and the migration
CLI, plus every migration in `src/database/migrations/`).

## Scripts

| Command | What it does |
|---|---|
| `npm run build && npm start` | Build then run the API |
| `npm run start:dev` | Run with hot reload |
| `npm run db:migrate` | Apply pending migrations |
| `npm run test:unit` / `test:architecture` | Fast, no DB required |
| `npm run test:integration` | Real HTTP + real PostgreSQL (`sahmati_test`) |
| `npm run verify` | format + lint + typecheck + build + unit + architecture |
