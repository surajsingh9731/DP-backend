CREATE TABLE workspace.setup_drafts (
 tenant_id uuid NOT NULL, branch_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 organisation_name text NOT NULL, pack_id text NOT NULL, pack_version integer NOT NULL,
 step integer NOT NULL CHECK(step BETWEEN 1 AND 3), draft jsonb,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','completed')),
 register_entry_id uuid, completion_key uuid, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,branch_id), FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id),
 FOREIGN KEY(tenant_id,register_entry_id) REFERENCES workspace.register_entries(tenant_id,id),
 CHECK((status='draft' AND completion_key IS NULL AND register_entry_id IS NULL) OR (status='completed' AND completion_key IS NOT NULL AND register_entry_id IS NOT NULL))
);
CREATE TABLE workspace.register_pack_sources (
 tenant_id uuid NOT NULL, entry_id uuid NOT NULL, pack_id text NOT NULL, pack_version integer NOT NULL,
 PRIMARY KEY(tenant_id,entry_id), FOREIGN KEY(tenant_id,entry_id) REFERENCES workspace.register_entries(tenant_id,id)
);
ALTER TABLE workspace.setup_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.setup_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.setup_drafts USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.register_pack_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.register_pack_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.register_pack_sources USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON workspace.setup_drafts TO sahmati_app;
GRANT SELECT,INSERT ON workspace.register_pack_sources TO sahmati_app;
