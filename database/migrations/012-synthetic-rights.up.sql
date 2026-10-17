CREATE TABLE workspace.rights_requests (
 tenant_id uuid NOT NULL, id uuid NOT NULL, branch_id uuid NOT NULL, session_id uuid NOT NULL, assignee_id uuid,
 version integer NOT NULL CHECK(version>0), updated_at timestamptz NOT NULL, data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,branch_id,session_id) REFERENCES workspace.consent_participants(tenant_id,branch_id,id),
 FOREIGN KEY(tenant_id,assignee_id) REFERENCES identity.memberships(tenant_id,user_id)
);
CREATE TABLE workspace.rights_events (
 tenant_id uuid NOT NULL, request_id uuid NOT NULL, version integer NOT NULL CHECK(version>0), data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,request_id,version), FOREIGN KEY(tenant_id,request_id) REFERENCES workspace.rights_requests(tenant_id,id)
);
CREATE TABLE workspace.rights_commands (
 tenant_id uuid NOT NULL, branch_id uuid NOT NULL, actor_id uuid NOT NULL, idempotency_key uuid NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'), response jsonb NOT NULL,
 PRIMARY KEY(tenant_id,branch_id,actor_id,idempotency_key), FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES identity.memberships(tenant_id,user_id)
);
CREATE INDEX rights_branch_time ON workspace.rights_requests(tenant_id,branch_id,updated_at DESC,id);
CREATE INDEX rights_assignment ON workspace.rights_requests(tenant_id,branch_id,assignee_id,updated_at DESC);
CREATE INDEX rights_participant ON workspace.rights_requests(tenant_id,branch_id,session_id,updated_at DESC);
ALTER TABLE workspace.rights_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.rights_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.rights_requests USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.rights_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.rights_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.rights_events USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.rights_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.rights_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.rights_commands USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON workspace.rights_requests TO sahmati_app;
GRANT SELECT,INSERT ON workspace.rights_events,workspace.rights_commands TO sahmati_app;
