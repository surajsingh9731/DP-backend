CREATE TABLE workspace.consent_offers (
 tenant_id uuid NOT NULL, id uuid NOT NULL, branch_id uuid NOT NULL, notice_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,branch_id,id), UNIQUE(tenant_id,notice_id,version),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id),
 FOREIGN KEY(tenant_id,notice_id) REFERENCES workspace.notice_snapshots(tenant_id,id)
);
CREATE TABLE workspace.consent_participants (
 tenant_id uuid NOT NULL, id uuid NOT NULL, branch_id uuid NOT NULL, offer_id uuid NOT NULL,
 actor_id uuid NOT NULL, token_hash text NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'), expires_at timestamptz NOT NULL,
 revoked boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,branch_id,id),
 FOREIGN KEY(tenant_id,branch_id,offer_id) REFERENCES workspace.consent_offers(tenant_id,branch_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES identity.memberships(tenant_id,user_id)
);
CREATE TABLE workspace.consent_receipts (
 tenant_id uuid NOT NULL, id uuid NOT NULL, branch_id uuid NOT NULL, session_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), occurred_at timestamptz NOT NULL, data jsonb NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,session_id,version),
 FOREIGN KEY(tenant_id,branch_id,session_id) REFERENCES workspace.consent_participants(tenant_id,branch_id,id)
);
CREATE TABLE workspace.consent_commands (
 tenant_id uuid NOT NULL, branch_id uuid NOT NULL, actor_id uuid NOT NULL, idempotency_key uuid NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'), response jsonb NOT NULL,
 PRIMARY KEY(tenant_id,branch_id,actor_id,idempotency_key),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES workspace.branches(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES identity.memberships(tenant_id,user_id)
);
ALTER TABLE workspace.consent_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.consent_offers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.consent_offers USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.consent_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.consent_participants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.consent_participants USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.consent_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.consent_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.consent_receipts USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE workspace.consent_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.consent_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON workspace.consent_commands USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT ON workspace.consent_offers,workspace.consent_receipts,workspace.consent_commands TO sahmati_app;
GRANT SELECT,INSERT ON workspace.consent_participants TO sahmati_app;
GRANT UPDATE(version,revoked) ON workspace.consent_participants TO sahmati_app;
CREATE INDEX consent_participant_branch ON workspace.consent_participants(tenant_id,branch_id,id);
CREATE INDEX consent_receipt_branch ON workspace.consent_receipts(tenant_id,branch_id,session_id,version DESC);
CREATE INDEX consent_receipt_time ON workspace.consent_receipts(tenant_id,branch_id,occurred_at DESC,id);
