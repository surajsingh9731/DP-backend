-- Lock the authorising membership without granting the API membership-edit privileges.
CREATE FUNCTION identity.active_membership_for_action(target_tenant uuid,target_user uuid)
RETURNS TABLE(role text,branch_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT m.role,m.branch_id FROM identity.memberships m WHERE m.tenant_id=target_tenant AND m.user_id=target_user AND m.active=true FOR SHARE $$;
REVOKE ALL ON FUNCTION identity.active_membership_for_action(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.active_membership_for_action(uuid,uuid) TO sahmati_app;
CREATE TABLE delivery.worker_heartbeat(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),last_seen_at timestamptz NOT NULL);
GRANT SELECT ON delivery.worker_heartbeat TO sahmati_app;
GRANT SELECT,INSERT,UPDATE ON delivery.worker_heartbeat TO sahmati_worker;
