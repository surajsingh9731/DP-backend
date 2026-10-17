CREATE TABLE workspace.followup_tasks (
 tenant_id uuid NOT NULL, id uuid NOT NULL, branch_id uuid NOT NULL, receipt_id uuid NOT NULL,
 location_key text NOT NULL CHECK(location_key ~ '^[a-f0-9]{64}$'), assignee_id uuid,
 version integer NOT NULL CHECK(version>0), updated_at timestamptz NOT NULL, data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,branch_id,id), UNIQUE(tenant_id,receipt_id,location_key),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id),
 FOREIGN KEY(tenant_id,receipt_id) REFERENCES workspace.consent_receipts(tenant_id,id),
 FOREIGN KEY(tenant_id,assignee_id) REFERENCES identity.memberships(tenant_id,user_id)
);
CREATE TABLE workspace.followup_events (
 tenant_id uuid NOT NULL, task_id uuid NOT NULL, version integer NOT NULL CHECK(version>0), data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,task_id,version), FOREIGN KEY(tenant_id,task_id) REFERENCES workspace.followup_tasks(tenant_id,id)
);
CREATE TABLE workspace.followup_commands (
 tenant_id uuid NOT NULL, branch_id uuid NOT NULL, actor_id uuid NOT NULL, idempotency_key uuid NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'), response jsonb NOT NULL,
 PRIMARY KEY(tenant_id,branch_id,actor_id,idempotency_key),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES identity.memberships(tenant_id,user_id)
);
ALTER TABLE workspace.followup_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.followup_tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.followup_tasks USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.followup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.followup_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.followup_events USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.followup_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.followup_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.followup_commands USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON workspace.followup_tasks TO sahmati_app;
GRANT SELECT,INSERT ON workspace.followup_events,workspace.followup_commands TO sahmati_app;
CREATE INDEX followup_branch_time ON workspace.followup_tasks(tenant_id,branch_id,updated_at DESC,id);
CREATE INDEX followup_assignment ON workspace.followup_tasks(tenant_id,branch_id,assignee_id,updated_at DESC);
