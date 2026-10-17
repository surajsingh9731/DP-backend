/**
 * Shared SQL fragments for the one real tenant-isolation mechanism in this
 * app: PostgreSQL row-level security. Every migration that creates a
 * tenant-owned table calls `tenantIsolationSql`/`dropTenantIsolationSql`
 * instead of hand-writing the policy, so the policy shape never drifts
 * between tables.
 */

export interface TenantIsolationOptions {
  /** Set only for tables created before a tenant exists (e.g. pre-signup auth challenges). Rows with tenant_id IS NULL are visible with no tenant context set. */
  nullableTenant?: boolean;
  /** Column holding the tenant identity. Defaults to 'tenant_id'; the organisations table itself uses 'id'. */
  column?: string;
}

/**
 * Postgres resets a custom GUC to an empty string — not a true NULL — on
 * the next transaction of a reused pooled connection once it has been
 * `SET LOCAL`'d at all in that session's lifetime. A bare
 * `current_setting('app.tenant_id', true)::uuid` cast then throws
 * "invalid input syntax for type uuid" instead of safely meaning "no
 * tenant". `NULLIF(..., '')` normalises both the never-set and the
 * reset-to-empty cases to a real NULL before the cast.
 */
const CURRENT_TENANT_ID = `NULLIF(current_setting('app.tenant_id', true), '')::uuid`;

/**
 * A strictly tenant-scoped table's rows are only INSERTable (and
 * RETURNING-able) once `app.tenant_id` is actually set to that row's own
 * tenant — Postgres evaluates the `USING` clause too when an INSERT
 * carries a RETURNING clause (to confirm the new row is visible to return
 * it), not just `WITH CHECK`. TypeORM's `manager.save()` always adds
 * RETURNING for generated columns, so a bootstrap flow (signup) that
 * creates an organisation and then immediately inserts its branch/
 * membership rows must call `TenantContextService.setTenantId(orgId)`
 * right after the organisation exists, rather than trying to carve out an
 * "insert is always open" policy — an open-INSERT-only policy satisfies
 * WITH CHECK but not the RETURNING visibility check, and fails with a
 * confusing "violates row-level security policy" error instead.
 */
export function tenantIsolationSql(
  table: string,
  options: TenantIsolationOptions = {},
): string[] {
  const column = options.column ?? "tenant_id";
  const predicate = options.nullableTenant
    ? `(${column} IS NULL OR ${column} = ${CURRENT_TENANT_ID})`
    : `${column} = ${CURRENT_TENANT_ID}`;
  return [
    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`,
    `CREATE POLICY tenant_isolation ON ${table} USING (${predicate}) WITH CHECK (${predicate})`,
  ];
}

export function dropTenantIsolationSql(table: string): string[] {
  return [
    `DROP POLICY IF EXISTS tenant_isolation ON ${table}`,
    `ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`,
    `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`,
  ];
}

export interface GrantOptions {
  /** Append-only tables (the evidence ledger) never get UPDATE/DELETE granted — enforced at the privilege level, not by convention. */
  appendOnly?: boolean;
}

/** Grants the restricted, NOBYPASSRLS runtime role exactly the privileges a request-serving connection needs — never table ownership. */
export function grantAppRoleSql(
  table: string,
  options: GrantOptions = {},
): string[] {
  const privileges = options.appendOnly
    ? "SELECT, INSERT"
    : "SELECT, INSERT, UPDATE, DELETE";
  return [`GRANT ${privileges} ON TABLE ${table} TO sahmati_app`];
}

export function revokeAppRoleSql(table: string): string[] {
  return [`REVOKE ALL ON TABLE ${table} FROM sahmati_app`];
}

/**
 * For a table that must be readable by a specific, narrow key (never
 * listed) during the pre-session window — concretely, login resolving
 * "which tenant does this identifier belong to" on `memberships` before
 * any session exists to scope it. Permissive policies OR together, so
 * this only widens access while `app.tenant_id` is genuinely unset; once
 * a real tenant context is active, this clause evaluates false and the
 * strict `tenant_isolation` policy (created alongside it) is the only one
 * that can grant access — a staff member's authenticated listing of their
 * own organisation's memberships stays exactly as strict as any other
 * tenant-owned table.
 */
export function preSessionLookupSql(table: string): string[] {
  const unset = `(current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '')`;
  return [
    `CREATE POLICY ${table}_pre_session_lookup ON ${table} FOR SELECT USING (${unset})`,
  ];
}

/**
 * For operational/control-plane tables (auth challenges, sessions) that
 * are never listed and are only ever looked up by their own unguessable
 * opaque id or token hash — including during the pre-session signup/login
 * window, before any tenant context can exist to check against. RLS stays
 * enabled and forced here (so a future added column/query still goes
 * through the policy machinery), but the policy itself is intentionally
 * open. This is a deliberate, documented scope decision, not an oversight:
 * the tables that actually hold personal or compliance data (register,
 * notices, consent, rights, breach, retention, memberships, branches,
 * activity_log) all keep the strict `tenant_isolation` policy.
 */
export function operationalAccessSql(table: string): string[] {
  return [
    `CREATE POLICY ${table}_operational_access ON ${table} USING (true) WITH CHECK (true)`,
  ];
}
