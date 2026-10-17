# Running Sahmati on your own machine

This covers both repos — `dp-backend` (NestJS/TypeORM/PostgreSQL) and
`dp-frontend` (Angular). Both must sit **side by side** in the same parent
folder, because the frontend depends on the backend's shared type package
by relative path:

```
sahmati/
├── backend/   <- clone of dp-backend here
└── frontend/  <- clone of dp-frontend here
```

If you already have them cloned elsewhere, either move them so they are
siblings named exactly `backend` and `frontend`, or symlink:

```bash
mkdir sahmati && cd sahmati
ln -s /path/to/your/dp-backend backend
ln -s /path/to/your/dp-frontend frontend
```

## 1. Prerequisites

- **Node.js 24.15+** (both repos pin `"node": ">=24.15.0 <25"`)
- **PostgreSQL** running locally, with a superuser you can connect as
  (commonly `postgres`)

## 2. Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set:

```
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=Suraj@123        # <- your own local PostgreSQL password
DB_DATABASE=sahmati_local
API_PORT=4300
WEB_ORIGIN=http://127.0.0.1:4200
AUTH_PEPPER=<generate your own — see the comment in .env.example>
```

Then:

```bash
npm install
node scripts/local-init.mjs     # creates the sahmati_local database if it doesn't exist
npm run db:migrate               # applies all migrations — real tables, created here
npx tsx scripts/seed.ts          # seeds the 5 demo sign-in accounts + sample tenant
npm run build
npm start                        # API on http://127.0.0.1:4300/api
```

`local-init.mjs` only ever creates the database if missing — it never
drops or resets anything. Re-running `db:migrate` and the seed script is
always safe (both are idempotent).

### What gets created in your database

Running `db:migrate` creates every real table the app uses — tenants,
users, memberships, sessions, the shared evidence ledger, and one set of
tables per module (register, setup, preparation, notices, consent-sandbox,
followups, checks, rights, retention, workspace, local mail). Nothing is
simulated: this is the actual schema the API reads and writes.

### Demo sign-in accounts

After seeding, you can sign in at the frontend's login screen as:

- `owner@demo.sahmati.test`
- `staff@demo.sahmati.test`
- `viewer@demo.sahmati.test`

(`other@demo.sahmati.test` and `operator@demo.sahmati.test` exist but have
no tenant membership, matching the project's own fixtures.)

There are no passwords — sign-in is a one-time email code. Since no real
email is sent, read the code from the local mailbox:
`GET http://127.0.0.1:4300/api/dev/mail`, or just open
`http://127.0.0.1:4200/mailbox` in the running frontend.

## 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm start      # Angular dev server on http://127.0.0.1:4200, proxying /api to the backend
```

Open `http://127.0.0.1:4200`.

## 4. Verifying everything works

Backend:

```bash
cd backend
npm run verify          # format, lint, typecheck, build, unit + architecture tests
npm run test:integration  # needs a running PostgreSQL; uses a separate sahmati_test database
```

Frontend:

```bash
cd frontend
npm run verify   # format, lint, typecheck, build, test
```

## 5. Starting over

If you ever want a completely clean database:

```sql
DROP DATABASE sahmati_local;
```

then repeat the `local-init.mjs` → `db:migrate` → `seed.ts` steps above.
