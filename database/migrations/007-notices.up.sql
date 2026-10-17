CREATE TABLE workspace.notice_snapshots (
 tenant_id uuid NOT NULL, id uuid NOT NULL, branch_id uuid NOT NULL,
 entry_id uuid NOT NULL, entry_version integer NOT NULL CHECK(entry_version>0),
 language text NOT NULL CHECK(language IN ('en','hi')),
 mode text NOT NULL CHECK(mode='local-sample'), legal_review_status text NOT NULL CHECK(legal_review_status='unreviewed'),
 register_data jsonb NOT NULL, preview jsonb NOT NULL, source_pack jsonb,
 submitted_by uuid NOT NULL, submitted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id),
 FOREIGN KEY(tenant_id,entry_id) REFERENCES workspace.register_entries(tenant_id,id),
 FOREIGN KEY(tenant_id,submitted_by) REFERENCES identity.memberships(tenant_id,user_id)
);
CREATE TABLE workspace.notice_reviews (
 tenant_id uuid NOT NULL, notice_id uuid NOT NULL, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 status text NOT NULL DEFAULT 'in_review' CHECK(status IN ('in_review','changes_requested','sample_published')),
 PRIMARY KEY(tenant_id,notice_id), FOREIGN KEY(tenant_id,notice_id) REFERENCES workspace.notice_snapshots(tenant_id,id)
);
CREATE TABLE workspace.notice_decisions (
 tenant_id uuid NOT NULL, id uuid NOT NULL, notice_id uuid NOT NULL, version integer NOT NULL,
 decision text NOT NULL CHECK(decision IN ('request_changes','publish_sample')), comment text CHECK(length(comment)<=1000),
 decided_by uuid NOT NULL, decided_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,notice_id,version),
 FOREIGN KEY(tenant_id,notice_id) REFERENCES workspace.notice_snapshots(tenant_id,id),
 FOREIGN KEY(tenant_id,decided_by) REFERENCES identity.memberships(tenant_id,user_id)
);
CREATE TABLE workspace.notice_commands (
 tenant_id uuid NOT NULL, branch_id uuid NOT NULL, idempotency_key uuid NOT NULL,
 payload_hash text NOT NULL, response jsonb NOT NULL, notice_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,branch_id,idempotency_key),
 FOREIGN KEY(tenant_id,notice_id) REFERENCES workspace.notice_snapshots(tenant_id,id),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id)
);
ALTER TABLE workspace.notice_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.notice_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.notice_snapshots USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.notice_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.notice_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.notice_reviews USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.notice_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.notice_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.notice_decisions USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.notice_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.notice_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.notice_commands USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT ON workspace.notice_snapshots,workspace.notice_decisions,workspace.notice_commands TO sahmati_app;
GRANT SELECT,INSERT,UPDATE ON workspace.notice_reviews TO sahmati_app;
