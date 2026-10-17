CREATE TABLE workspace.retention_policies (
 tenant_id uuid NOT NULL,id uuid NOT NULL,branch_id uuid NOT NULL,entry_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id),FOREIGN KEY(tenant_id,entry_id) REFERENCES workspace.register_entries(tenant_id,id)
);
CREATE TABLE workspace.retention_policy_events (
 tenant_id uuid NOT NULL,record_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,record_id,version),FOREIGN KEY(tenant_id,record_id) REFERENCES workspace.retention_policies(tenant_id,id)
);
CREATE INDEX retention_policies_scope ON workspace.retention_policies(tenant_id,branch_id,entry_id,id);
CREATE TABLE workspace.retention_holds (
 tenant_id uuid NOT NULL,id uuid NOT NULL,branch_id uuid NOT NULL,entry_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id),FOREIGN KEY(tenant_id,entry_id) REFERENCES workspace.register_entries(tenant_id,id)
);
CREATE TABLE workspace.retention_hold_events (
 tenant_id uuid NOT NULL,record_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,record_id,version),FOREIGN KEY(tenant_id,record_id) REFERENCES workspace.retention_holds(tenant_id,id)
);
CREATE INDEX retention_holds_scope ON workspace.retention_holds(tenant_id,branch_id,entry_id,id);
CREATE TABLE workspace.retention_previews (
 tenant_id uuid NOT NULL,id uuid NOT NULL,branch_id uuid NOT NULL,entry_id uuid NOT NULL,data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id),FOREIGN KEY(tenant_id,entry_id) REFERENCES workspace.register_entries(tenant_id,id)
);
CREATE INDEX retention_previews_scope ON workspace.retention_previews(tenant_id,branch_id,entry_id,id);
CREATE TABLE workspace.retention_commands (
 tenant_id uuid NOT NULL,branch_id uuid NOT NULL,actor_id uuid NOT NULL,idempotency_key uuid NOT NULL,payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),response jsonb NOT NULL,
 PRIMARY KEY(tenant_id,branch_id,actor_id,idempotency_key),FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id),FOREIGN KEY(tenant_id,actor_id) REFERENCES identity.memberships(tenant_id,user_id)
);
ALTER TABLE workspace.retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.retention_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.retention_policies USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON workspace.retention_policies TO sahmati_app;
ALTER TABLE workspace.retention_policy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.retention_policy_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.retention_policy_events USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT ON workspace.retention_policy_events TO sahmati_app;
ALTER TABLE workspace.retention_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.retention_holds FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.retention_holds USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON workspace.retention_holds TO sahmati_app;
ALTER TABLE workspace.retention_hold_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.retention_hold_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.retention_hold_events USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT ON workspace.retention_hold_events TO sahmati_app;
ALTER TABLE workspace.retention_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.retention_previews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.retention_previews USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT ON workspace.retention_previews TO sahmati_app;
ALTER TABLE workspace.retention_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.retention_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.retention_commands USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT ON workspace.retention_commands TO sahmati_app;
