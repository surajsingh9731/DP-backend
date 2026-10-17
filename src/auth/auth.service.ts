import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SessionView } from '@sahmati/contracts';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { Database } from '../database/database.service.js';
import { loginMessage } from '../messages/message-renderer.js';
import type { Language } from '../constants/message.constants.js';
import { AUTH_LIMITS } from '../constants/auth.constants.js';
import { DEFAULT_MESSAGE_LANGUAGE } from '../constants/message.constants.js';
import { AuthRepository } from './auth.repository.js';
import { codeHash, equalHash, hashToken } from './security-hash.js';
@Injectable()
export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly config: ConfigService,
    private readonly repository: AuthRepository,
  ) {}
  async request(
    emailInput: string,
    language: Language = DEFAULT_MESSAGE_LANGUAGE,
  ): Promise<{ challengeId: string; message: string }> {
    const email = emailInput.trim().toLowerCase();
    const id = randomUUID();
    await this.db.transaction(null, async (client) => {
      if (!(await this.repository.allowRequest(client, hashToken(email)))) return;
      const user = await this.repository.activeUser(client, email);
      if (!user) return;
      const code = randomInt(0, AUTH_LIMITS.codeUpperBound)
        .toString()
        .padStart(AUTH_LIMITS.codeDigits, '0');
      await this.repository.invalidateChallenges(client, user.id);
      await this.repository.insertChallenge(
        client,
        id,
        user.id,
        codeHash(id, code, this.config.getOrThrow<string>('authPepper')),
      );
      await this.repository.insertLoginJob(
        client,
        id,
        email,
        loginMessage(code, language),
        language,
      );
    });
    return {
      challengeId: id,
      message: 'If this local test account is available, a code will appear in the local mailbox.',
    };
  }
  async verify(id: string, code: string): Promise<string> {
    const token = randomBytes(AUTH_LIMITS.sessionTokenBytes).toString('hex');
    const accepted = await this.db.transaction(null, async (client) => {
      const challenge = await this.repository.lockedChallenge(client, id);
      if (!challenge || !challenge.valid || challenge.attempts >= AUTH_LIMITS.verificationAttempts)
        return false;
      await this.repository.incrementAttempt(client, id);
      if (
        !equalHash(
          challenge.code_hash,
          codeHash(id, code, this.config.getOrThrow<string>('authPepper')),
        )
      )
        return false;
      await this.repository.invalidateChallenges(client, challenge.user_id);
      await this.repository.insertSession(client, hashToken(token), challenge.user_id);
      return true;
    });
    if (!accepted)
      throw new UnauthorizedException('Code is invalid or expired. Request a new code.');
    return token;
  }
  async me(userId: string): Promise<SessionView> {
    const [user, members] = await this.db.transaction(null, (client) =>
      Promise.all([
        this.repository.user(client, userId),
        this.repository.memberships(client, userId),
      ]),
    );
    const memberships: SessionView['memberships'] = [];
    for (const member of members) {
      const org = await this.db.transaction(member.tenantId, (client) =>
        this.repository.organisation(client, member.tenantId, member.branchId),
      );
      if (org)
        memberships.push({
          tenantId: member.tenantId,
          name: org.name,
          branch: org.branch,
          role: member.role,
        });
    }
    return { displayName: user?.displayName ?? 'Local account', memberships };
  }
  async logout(hash: string): Promise<void> {
    await this.db.transaction(null, (client) => this.repository.revokeSession(client, hash));
  }
}
