CREATE TABLE workspace.preparation_records (
 tenant_id uuid NOT NULL, id uuid NOT NULL, branch_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('template','contact')), version integer NOT NULL CHECK(version>0),
 status text NOT NULL CHECK(status IN ('draft','in_review','changes_requested','internally_reviewed')),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), source_pack jsonb,
 content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,branch_id,id),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id)
);
CREATE TABLE workspace.preparation_revisions (
 tenant_id uuid NOT NULL, record_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 data jsonb NOT NULL, source_pack jsonb, status text NOT NULL CHECK(status IN ('draft','in_review','changes_requested','internally_reviewed')),
 content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
 action text NOT NULL CHECK(action IN ('saved','submit','request_changes','review_internal')),
 comment text CHECK(length(comment)<=1000), actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,record_id,version),
 FOREIGN KEY(tenant_id,record_id) REFERENCES workspace.preparation_records(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES identity.memberships(tenant_id,user_id)
);
CREATE TABLE workspace.preparation_commands (
 tenant_id uuid NOT NULL, branch_id uuid NOT NULL, idempotency_key uuid NOT NULL, record_id uuid NOT NULL,
 payload_hash text NOT NULL, response jsonb NOT NULL,
 PRIMARY KEY(tenant_id,branch_id,idempotency_key),
 FOREIGN KEY(tenant_id,branch_id,record_id) REFERENCES workspace.preparation_records(tenant_id,branch_id,id)
);
ALTER TABLE workspace.preparation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.preparation_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.preparation_records USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.preparation_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.preparation_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.preparation_revisions USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.preparation_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.preparation_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.preparation_commands USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON workspace.preparation_records TO sahmati_app;
GRANT SELECT,INSERT ON workspace.preparation_revisions,workspace.preparation_commands TO sahmati_app;
CREATE INDEX preparation_branch_order ON workspace.preparation_records(tenant_id,branch_id,updated_at DESC,id);
ALTER TABLE workspace.notice_snapshots ADD COLUMN preparation_source jsonb;
