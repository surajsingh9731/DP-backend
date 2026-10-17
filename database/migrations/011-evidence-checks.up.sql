CREATE TABLE workspace.check_reviews (
 tenant_id uuid NOT NULL, task_id uuid NOT NULL, version integer NOT NULL CHECK(version>0), data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,task_id,version), FOREIGN KEY(tenant_id,task_id) REFERENCES workspace.followup_tasks(tenant_id,id)
);
CREATE TABLE workspace.check_evaluations (
 tenant_id uuid NOT NULL, id uuid NOT NULL, task_id uuid NOT NULL, computed_at timestamptz NOT NULL, data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,task_id) REFERENCES workspace.followup_tasks(tenant_id,id)
);
CREATE TABLE workspace.check_commands (
 tenant_id uuid NOT NULL, branch_id uuid NOT NULL, actor_id uuid NOT NULL, idempotency_key uuid NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'), response jsonb NOT NULL,
 PRIMARY KEY(tenant_id,branch_id,actor_id,idempotency_key), FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES identity.memberships(tenant_id,user_id)
);
CREATE INDEX check_evaluation_task_time ON workspace.check_evaluations(tenant_id,task_id,computed_at DESC,id);
ALTER TABLE workspace.check_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.check_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.check_reviews USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT ON workspace.check_reviews TO sahmati_app;
ALTER TABLE workspace.check_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.check_evaluations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.check_evaluations USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT ON workspace.check_evaluations TO sahmati_app;
ALTER TABLE workspace.check_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.check_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.check_commands USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT ON workspace.check_commands TO sahmati_app;
