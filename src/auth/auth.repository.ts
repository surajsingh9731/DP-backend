import { Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import type { TenantScope } from '@sahmati/contracts';
import type { DatabaseClient } from '../database/database-client.js';
import type { Language } from '../constants/message.constants.js';
import type { MessageCopy } from '../constants/message.constants.js';
import { AUTH_LIMITS } from '../constants/auth.constants.js';
import {
  BranchEntity,
  ChallengeEntity,
  LoginJobEntity,
  MembershipEntity,
  OrganisationEntity,
  SessionEntity,
  UserEntity,
} from '../database/entities/foundation.entities.js';
@Injectable()
export class AuthRepository {
  async lockedMembership(client: DatabaseClient, scope: TenantScope) {
    return (
      await client.query<{ role: string; branch_id: string }>(
        'SELECT role,branch_id FROM identity.active_membership_for_action($1,$2)',
        [scope.tenantId, scope.userId],
      )
    ).rows[0];
  }

  async allowRequest(client: DatabaseClient, hash: string): Promise<boolean> {
    // PostgreSQL transaction advisory lock makes the bounded time-window check atomic.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [hash]);
    const count = await client.query<{ count: string }>(
      "SELECT count(*) FROM identity.request_limits WHERE email_hash=$1 AND requested_at>now()-($2*interval '1 second')",
      [hash, AUTH_LIMITS.requestWindowSeconds],
    );
    if (Number(count.rows[0]?.count) >= AUTH_LIMITS.requestsPerWindow) return false;
    await client.query('INSERT INTO identity.request_limits(email_hash) VALUES($1)', [hash]);
    return true;
  }
  activeUser(client: DatabaseClient, email: string) {
    return client.manager.getRepository(UserEntity).findOneBy({ email, active: true });
  }
  invalidateChallenges(client: DatabaseClient, userId: string) {
    return client.manager
      .getRepository(ChallengeEntity)
      .update({ userId, consumedAt: IsNull() }, { consumedAt: () => 'CURRENT_TIMESTAMP' });
  }
  insertChallenge(client: DatabaseClient, id: string, userId: string, codeHash: string) {
    return client.manager
      .getRepository(ChallengeEntity)
      .createQueryBuilder()
      .insert()
      .values({
        id,
        userId,
        codeHash,
        expiresAt: () => "CURRENT_TIMESTAMP + (:lifetime * INTERVAL '1 second')",
      })
      .setParameter('lifetime', AUTH_LIMITS.challengeLifetimeSeconds)
      .execute();
  }
  insertLoginJob(
    client: DatabaseClient,
    id: string,
    recipient: string,
    copy: MessageCopy,
    language: Language,
  ) {
    return client.manager
      .getRepository(LoginJobEntity)
      .insert({ id, recipient, ...copy, language });
  }
  async lockedChallenge(client: DatabaseClient, id: string) {
    // Lock only the challenge row; validity uses database time and the live user state.
    const result = await client.query<{
      user_id: string;
      code_hash: string;
      valid: boolean;
      attempts: number;
    }>(
      'SELECT c.user_id,c.code_hash,c.attempts,(c.expires_at>now() AND c.consumed_at IS NULL AND u.active=true) AS valid FROM identity.challenges c JOIN identity.users u ON u.id=c.user_id WHERE c.id=$1 FOR UPDATE OF c',
      [id],
    );
    return result.rows[0];
  }
  incrementAttempt(client: DatabaseClient, id: string) {
    return client.manager.getRepository(ChallengeEntity).increment({ id }, 'attempts', 1);
  }
  insertSession(client: DatabaseClient, tokenHash: string, userId: string) {
    return client.manager
      .getRepository(SessionEntity)
      .createQueryBuilder()
      .insert()
      .values({
        tokenHash,
        userId,
        expiresAt: () => "CURRENT_TIMESTAMP + (:lifetime * INTERVAL '1 second')",
      })
      .setParameter('lifetime', AUTH_LIMITS.sessionLifetimeSeconds)
      .execute();
  }
  user(client: DatabaseClient, id: string) {
    return client.manager.getRepository(UserEntity).findOneBy({ id });
  }
  memberships(client: DatabaseClient, userId: string) {
    return client.manager
      .getRepository(MembershipEntity)
      .find({ where: { userId, active: true }, order: { tenantId: 'ASC' } });
  }
  async organisation(client: DatabaseClient, tenantId: string, branchId: string) {
    const organisation = await client.manager
      .getRepository(OrganisationEntity)
      .findOneBy({ id: tenantId });
    const branch = await client.manager
      .getRepository(BranchEntity)
      .findOneBy({ tenantId, id: branchId });
    return organisation && branch ? { name: organisation.name, branch: branch.name } : null;
  }
  revokeSession(client: DatabaseClient, tokenHash: string) {
    return client.manager
      .getRepository(SessionEntity)
      .update({ tokenHash }, { revokedAt: () => 'CURRENT_TIMESTAMP' });
  }
  activeSession(client: DatabaseClient, tokenHash: string) {
    return client.manager
      .getRepository(SessionEntity)
      .createQueryBuilder('session')
      .innerJoin(UserEntity, 'user', 'user.id=session.userId')
      .where('session.tokenHash=:tokenHash', { tokenHash })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > CURRENT_TIMESTAMP')
      .andWhere('user.active=:active', { active: true })
      .getOne();
  }
  membership(client: DatabaseClient, tenantId: string, userId: string) {
    return client.manager
      .getRepository(MembershipEntity)
      .findOneBy({ tenantId, userId, active: true });
  }
}
