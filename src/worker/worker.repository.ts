import { Injectable } from '@nestjs/common';
import { DELIVERY_POLICY, DELIVERY_TABLES } from '../constants/delivery.constants.js';
import type { DatabaseClient } from '../database/database-client.js';
import { ChallengeEntity, MembershipEntity } from '../database/entities/index.js';
import type { Claimed, PendingMessage } from './worker.types.js';
@Injectable()
export class WorkerRepository {
  private table(tenantId: string | null) {
    return tenantId ? DELIVERY_TABLES.task : DELIVERY_TABLES.login;
  }
  expireExhausted(client: DatabaseClient, tenantId: string | null) {
    return client.query(
      `UPDATE ${this.table(tenantId)} SET status='failed',lease_token=NULL,lease_until=NULL WHERE status='processing' AND lease_until<now() AND attempts>=$1`,
      [DELIVERY_POLICY.maximumAttempts],
    );
  }
  async next(client: DatabaseClient, tenantId: string | null): Promise<PendingMessage | null> {
    const result = await client.query<PendingMessage>(
      `SELECT id,recipient,subject,body,template_key AS "templateKey",template_version AS "templateVersion",language,attempts FROM ${this.table(tenantId)} WHERE attempts<$1 AND ((status='pending' AND available_at<=now()) OR (status='processing' AND lease_until<now())) ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1`,
      [DELIVERY_POLICY.maximumAttempts],
    );
    return result.rows[0] ?? null;
  }
  lease(client: DatabaseClient, tenantId: string | null, id: string, lease: string) {
    return client.query(
      `UPDATE ${this.table(tenantId)} SET status='processing',attempts=attempts+1,lease_token=$2,lease_until=now()+($3*interval '1 second') WHERE id=$1`,
      [id, lease, DELIVERY_POLICY.leaseSeconds],
    );
  }
  async lockCurrent(client: DatabaseClient, claim: Claimed): Promise<boolean> {
    const result = await client.query(
      `SELECT id FROM ${this.table(claim.tenantId)} WHERE id=$1 AND status='processing' AND lease_token=$2 AND lease_until>now() FOR UPDATE`,
      [claim.id, claim.lease],
    );
    return result.rowCount > 0;
  }
  validLogin(client: DatabaseClient, id: string): Promise<boolean> {
    return client.manager
      .getRepository(ChallengeEntity)
      .createQueryBuilder('challenge')
      .where('challenge.id = :id', { id })
      .andWhere('challenge.consumed_at IS NULL')
      .andWhere('challenge.expires_at > now()')
      .getExists();
  }
  async activeTask(client: DatabaseClient, id: string): Promise<boolean> {
    const result = await client.query(
      "SELECT t.id FROM workspace.tasks t JOIN workspace.outbox o ON o.tenant_id=t.tenant_id AND o.task_id=t.id JOIN identity.memberships m ON m.tenant_id=t.tenant_id AND m.user_id=t.assignee_id JOIN identity.users u ON u.id=m.user_id WHERE o.id=$1 AND t.status='open' AND m.active=true AND u.active=true AND u.email=o.recipient",
      [id],
    );
    return result.rowCount > 0;
  }
  finish(client: DatabaseClient, claim: Claimed, status: 'failed' | 'cancelled' | 'sent') {
    return client.query(
      `UPDATE ${this.table(claim.tenantId)} SET status=$2,lease_token=NULL,lease_until=NULL WHERE id=$1`,
      [claim.id, status],
    );
  }
  retry(client: DatabaseClient, claim: Claimed) {
    return client.query(
      `UPDATE ${this.table(claim.tenantId)} SET status=CASE WHEN attempts>=$3 THEN 'failed' ELSE 'pending' END,lease_token=NULL,lease_until=NULL,available_at=now()+interval '1 second'*attempts*$4 WHERE id=$1 AND lease_token=$2`,
      [claim.id, claim.lease, DELIVERY_POLICY.maximumAttempts, DELIVERY_POLICY.retryBaseSeconds],
    );
  }
  tenants(client: DatabaseClient): Promise<{ tenantId: string }[]> {
    return client.manager
      .getRepository(MembershipEntity)
      .createQueryBuilder('membership')
      .select('membership.tenantId', 'tenantId')
      .distinct(true)
      .orderBy('membership.tenantId', 'ASC')
      .getRawMany<{ tenantId: string }>();
  }
  heartbeat(client: DatabaseClient) {
    // PostgreSQL singleton upsert; this operational table deliberately has no ORM entity.
    return client.query(
      'INSERT INTO delivery.worker_heartbeat(singleton,last_seen_at) VALUES($1,now()) ON CONFLICT(singleton) DO UPDATE SET last_seen_at=excluded.last_seen_at',
      [true],
    );
  }
}
