import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, randomInt } from "node:crypto";
import type {
  ParticipantChallengeView,
  ParticipantSessionView,
} from "@sahmati/contracts";
import type { AuthChannel } from "../../auth/entities/auth-challenge.entity";
import { OrganisationEntity } from "../../auth/entities/organisation.entity";
import { PublicVerificationSessionEntity } from "../entities/public-verification-session.entity";
import { StartVerificationDto } from "../dto/start-verification.dto";
import { ConfirmVerificationDto } from "../dto/confirm-verification.dto";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { AppConfigService } from "../../config/app-config.service";
import { NotificationsService } from "../../notifications/services/notifications.service";
import { constantTimeHexEqual } from "../../common/security/constant-time-equal";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export interface VerifiedParticipant {
  verificationId: string;
  tenantId: string;
  identifier: string;
}

/**
 * Real OTP verification for a data principal — a parent, patient or
 * customer — scoped to one organisation, with no account to create and
 * no password. Distinct from AuthService (staff): a verified session
 * here never carries a role or membership, and expires far sooner.
 */
@Injectable()
export class ParticipantVerificationService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly config: AppConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async start(
    orgSlug: string,
    dto: StartVerificationDto,
  ): Promise<ParticipantChallengeView> {
    const manager = this.tenantContext.manager;
    const organisation = await manager
      .getRepository(OrganisationEntity)
      .findOne({ where: { slug: orgSlug } });
    if (!organisation) throw new NotFoundException("Organisation not found.");

    const rawCode = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    const channel: AuthChannel = EMAIL_RE.test(dto.identifier)
      ? "email"
      : "whatsapp";

    const row = await manager.save(
      manager.create(PublicVerificationSessionEntity, {
        tenantId: organisation.id,
        identifier: dto.identifier,
        channel,
        codeHash: "",
        expiresAt,
      }),
    );
    row.codeHash = this.hashCode(rawCode, row.id);
    await manager.save(row);

    await this.notifications.send({
      to: dto.identifier,
      language: dto.language,
      template: "otp_login",
      payload: { code: rawCode },
    });

    return {
      verificationId: row.id,
      channel: row.channel,
      expiresAt: row.expiresAt.toISOString(),
      maskedIdentifier: this.maskIdentifier(row.identifier),
    };
  }

  async confirm(
    verificationId: string,
    dto: ConfirmVerificationDto,
  ): Promise<ParticipantSessionView> {
    const manager = this.tenantContext.manager;
    const repo = manager.getRepository(PublicVerificationSessionEntity);
    const row = await repo.findOne({ where: { id: verificationId } });
    if (!row) throw new NotFoundException("Verification not found.");
    if (row.expiresAt.getTime() < Date.now())
      throw new BadRequestException("This code has expired.");
    if (row.attempts >= MAX_ATTEMPTS) {
      throw new UnauthorizedException(
        "Too many incorrect attempts. Request a new code.",
      );
    }

    const codeHash = this.hashCode(dto.code, row.id);
    if (!constantTimeHexEqual(codeHash, row.codeHash)) {
      row.attempts += 1;
      await repo.save(row);
      throw new UnauthorizedException("Incorrect code.");
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    row.verified = true;
    row.tokenHash = this.hashToken(token);
    row.expiresAt = expiresAt;
    await repo.save(row);

    return { token, expiresAt: expiresAt.toISOString() };
  }

  /** Hashing exposed so ParticipantSessionGuard can look up a session by its own repository access, the same way SessionGuard hashes the staff cookie. */
  hashToken(token: string): string {
    return createHash("sha256")
      .update(`${token}${this.config.authPepper}`)
      .digest("hex");
  }

  private hashCode(code: string, verificationId: string): string {
    return createHash("sha256")
      .update(`${code}:${verificationId}:${this.config.authPepper}`)
      .digest("hex");
  }

  private maskIdentifier(identifier: string): string {
    if (EMAIL_RE.test(identifier)) {
      const [local, domain] = identifier.split("@");
      return `${local.slice(0, 1)}***@${domain}`;
    }
    return `${identifier.slice(0, 3)}${"*".repeat(Math.max(identifier.length - 5, 0))}${identifier.slice(-2)}`;
  }
}
