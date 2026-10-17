import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { Request } from "express";
import { PublicVerificationSessionEntity } from "../../participants/entities/public-verification-session.entity";
import { ParticipantVerificationService } from "../../participants/services/participant-verification.service";

export interface AuthenticatedParticipant {
  verificationId: string;
  tenantId: string;
  identifier: string;
}

/**
 * Route-level guard for data-principal (participant) endpoints — never
 * the global SessionGuard, which only understands staff cookies. Reads
 * `Authorization: Bearer <token>`, resolves it via the default pool
 * (safe only because public_verification_sessions carries the
 * operational-access RLS policy), and sets both `req.tenantId` and
 * `req.participantSessionId` so TenantContextInterceptor scopes the rest
 * of the request to this participant's own tenant and own rows.
 */
@Injectable()
export class ParticipantSessionGuard implements CanActivate {
  constructor(
    @InjectRepository(PublicVerificationSessionEntity)
    private readonly sessions: Repository<PublicVerificationSessionEntity>,
    private readonly verification: ParticipantVerificationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & {
        tenantId?: string;
        participantSessionId?: string;
        participant?: AuthenticatedParticipant;
      }
    >();

    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length)
      : undefined;
    if (!token) throw new UnauthorizedException("No participant session.");

    const tokenHash = this.verification.hashToken(token);
    const session = await this.sessions.findOne({
      where: { tokenHash, verified: true },
    });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Session expired or invalid.");
    }

    req.tenantId = session.tenantId;
    req.participantSessionId = session.id;
    req.participant = {
      verificationId: session.id,
      tenantId: session.tenantId,
      identifier: session.identifier,
    };
    return true;
  }
}
