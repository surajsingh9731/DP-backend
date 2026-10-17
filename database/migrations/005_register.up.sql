CREATE TABLE workspace.register_entries (
 tenant_id uuid NOT NULL, id uuid NOT NULL, branch_id uuid NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 1000000),
 status text NOT NULL DEFAULT 'draft' CHECK(status='draft'),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id)
);
CREATE TABLE workspace.register_revisions (
 tenant_id uuid NOT NULL, entry_id uuid NOT NULL, version integer NOT NULL,
 data jsonb NOT NULL, actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,entry_id,version),
 FOREIGN KEY(tenant_id,entry_id) REFERENCES workspace.register_entries(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES identity.memberships(tenant_id,user_id)
);
ALTER TABLE workspace.register_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.register_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.register_entries USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.register_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.register_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.register_revisions USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON workspace.register_entries TO sahmati_app;
GRANT SELECT,INSERT ON workspace.register_revisions TO sahmati_app;
