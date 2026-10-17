# Sahmati backend

NestJS + PostgreSQL + TypeORM modular monolith for the Sahmati R1 rebuild.
See `docs/architecture/` for the system design and folder-structure ADR.

## Local setup

1. Create two PostgreSQL databases (dev and test):
   ```sh
   createdb -U postgres sahmati_local
   createdb -U postgres sahmati_test
   ```
2. Copy `.env.example` to `.env` (and `.env.test` for the test database)
   and fill in real values. `DB_ADMIN_*` is your Postgres superuser
   (used only by the migration runner); `DB_USERNAME`/`DB_PASSWORD` is the
   restricted `sahmati_app` role the running app connects as — pick any
   password here, the first migration run provisions the role for you.
   Since Postgres roles are cluster-wide, use the **same**
   `DB_USERNAME`/`DB_PASSWORD` in both `.env` and `.env.test`.
3. Run migrations against both databases:
   ```sh
   npm run db:migrate                 # uses .env
   set -a && source .env.test && set +a && npm run db:migrate
   ```
4. `npm install`, then `npm run start:dev`.

## Email (dev)

The real notification channel is SMTP via nodemailer (Gmail/Workspace —
the `itpo_admin` account for this project — requires an App Password,
not the account's normal login password). Set `SMTP_*`/`MAIL_FROM` in
`.env`. WhatsApp Cloud API (`WHATSAPP_ACCESS_TOKEN`/
`WHATSAPP_PHONE_NUMBER_ID`) is the primary channel once Meta Business
verification and template approval land; until then, email is the live
path and the app falls back to it automatically.

## Gates

```sh
npm run verify   # format:check, lint, typecheck, build, unit, architecture tests
npm run test:integration   # real PostgreSQL + real RLS, needs sahmati_test migrated
```
