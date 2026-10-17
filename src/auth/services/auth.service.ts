import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { IsNull } from "typeorm";
import type { ChallengeView, SessionView } from "@sahmati/contracts";
import { OrganisationEntity } from "../entities/organisation.entity";
import { BranchEntity } from "../entities/branch.entity";
import { UserEntity } from "../entities/user.entity";
import { MembershipEntity } from "../entities/membership.entity";
import {
  AuthChallengeEntity,
  AuthChannel,
} from "../entities/auth-challenge.entity";
import { SessionEntity } from "../entities/session.entity";
import { SignupDto } from "../dto/signup.dto";
import { LoginDto } from "../dto/login.dto";
import { VerifyChallengeDto } from "../dto/verify-challenge.dto";
import { TenantContextService } from "../../common/services/tenant-context.service";
import { AppConfigService } from "../../config/app-config.service";
import { SectorPackRegistryService } from "../../sector-packs/services/sector-pack-registry.service";
import { NotificationsService } from "../../notifications/services/notifications.service";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export interface IssuedChallenge {
  view: ChallengeView;
  rawCode: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly config: AppConfigService,
    private readonly sectorPacks: SectorPackRegistryService,
    private readonly notifications: NotificationsService,
  ) {}

  async signup(dto: SignupDto): Promise<ChallengeView> {
    const pack = this.sectorPacks.getActive(dto.sectorPackCode);
    const manager = this.tenantContext.manager;

    const existingUser = await manager.getRepository(UserEntity).findOne({
      where: EMAIL_RE.test(dto.ownerIdentifier)
        ? { email: dto.ownerIdentifier }
        : { phoneE164: dto.ownerIdentifier },
    });
    if (existingUser) {
      const existingMembership = await manager
        .getRepository(MembershipEntity)
        .findOne({ where: { userId: existingUser.id } });
      if (existingMembership) {
        throw new ConflictException(
          "This email or phone is already registered with an organisation.",
        );
      }
    }

    // Identifier-scoped idempotency for the pre-tenant window: a retried
    // signup within the challenge TTL returns the same challenge instead
    // of creating a second organisation.
    const pending = await manager.getRepository(AuthChallengeEntity).findOne({
      where: {
        identifier: dto.ownerIdentifier,
        purpose: "signup",
        consumedAt: IsNull(),
      },
      order: { createdAt: "DESC" },
    });
    if (pending && pending.expiresAt.getTime() > Date.now()) {
      return this.toChallengeView(pending);
    }

    const organisation = await manager.save(
      manager.create(OrganisationEntity, {
        name: dto.organisationName,
        slug: await this.uniqueSlug(dto.organisationName),
        sectorPackCode: pack.code,
        sectorPackVersion: pack.version,
      }),
    );
    // The organisation now exists — every subsequent insert in this
    // transaction (branch, membership) is a real tenant-owned row, so
    // point app.tenant_id at it for the rest of the request. See
    // enable-rls.ts for why this replaces an "insert is always open"
    // policy on those tables.
    await this.tenantContext.setTenantId(organisation.id);
    await manager.save(
      manager.create(BranchEntity, {
        tenantId: organisation.id,
        name: "Main",
        isPrimary: true,
      }),
    );
    const user =
      existingUser ??
      (await manager.save(
        manager.create(UserEntity, {
          displayName: dto.ownerDisplayName,
          email: EMAIL_RE.test(dto.ownerIdentifier)
            ? dto.ownerIdentifier
            : null,
          phoneE164: EMAIL_RE.test(dto.ownerIdentifier)
            ? null
            : dto.ownerIdentifier,
        }),
      ));
    await manager.save(
      manager.create(MembershipEntity, {
        tenantId: organisation.id,
        userId: user.id,
        role: "owner",
        verified: false,
      }),
    );

    const issued = await this.issueChallenge(
      dto.ownerIdentifier,
      "signup",
      dto.language,
      organisation.id,
      user.id,
    );
    return issued.view;
  }

  async login(dto: LoginDto): Promise<ChallengeView> {
    const manager = this.tenantContext.manager;
    const user = await manager.getRepository(UserEntity).findOne({
      where: EMAIL_RE.test(dto.identifier)
        ? { email: dto.identifier }
        : { phoneE164: dto.identifier },
    });
    if (!user)
      throw new NotFoundException("No account found for that email or phone.");

    const membership = await manager
      .getRepository(MembershipEntity)
      .findOne({ where: { userId: user.id } });
    if (!membership)
      throw new NotFoundException("No account found for that email or phone.");

    const issued = await this.issueChallenge(
      dto.identifier,
      "login",
      dto.language,
      membership.tenantId,
      user.id,
    );
    return issued.view;
  }

  async verify(
    challengeId: string,
    dto: VerifyChallengeDto,
  ): Promise<{ token: string; expiresAt: Date; session: SessionView }> {
    const manager = this.tenantContext.manager;
    const challenges = manager.getRepository(AuthChallengeEntity);
    const challenge = await challenges.findOne({ where: { id: challengeId } });
    if (!challenge) throw new NotFoundException("Verification code not found.");
    if (challenge.consumedAt)
      throw new BadRequestException("This code was already used.");
    if (challenge.expiresAt.getTime() < Date.now())
      throw new BadRequestException("This code has expired.");
    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new UnauthorizedException(
        "Too many incorrect attempts. Request a new code.",
      );
    }

    const codeHash = this.hashCode(dto.code, challenge.id);
    if (codeHash !== challenge.codeHash) {
      challenge.attempts += 1;
      await challenges.save(challenge);
      throw new UnauthorizedException("Incorrect code.");
    }

    challenge.consumedAt = new Date();
    await challenges.save(challenge);

    if (!challenge.tenantId || !challenge.userId) {
      throw new BadRequestException(
        "This verification code is not tied to an account.",
      );
    }
    // The challenge resolves to a real tenant — point app.tenant_id at it
    // before reading memberships (strictly tenant-scoped) for the rest of
    // this transaction.
    await this.tenantContext.setTenantId(challenge.tenantId);

    const membership = await manager.getRepository(MembershipEntity).findOne({
      where: { tenantId: challenge.tenantId, userId: challenge.userId },
    });
    if (!membership) throw new NotFoundException("Membership not found.");
    if (!membership.verified) {
      membership.verified = true;
      await manager.getRepository(MembershipEntity).save(membership);
    }

    const organisation = await manager
      .getRepository(OrganisationEntity)
      .findOne({ where: { id: challenge.tenantId } });
    if (!organisation) throw new NotFoundException("Organisation not found.");

    const user = await manager
      .getRepository(UserEntity)
      .findOne({ where: { id: challenge.userId } });
    if (!user) throw new NotFoundException("User not found.");

    const token = randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await manager.save(
      manager.create(SessionEntity, {
        tenantId: organisation.id,
        userId: user.id,
        membershipId: membership.id,
        role: membership.role,
        tokenHash,
        expiresAt,
      }),
    );

    return {
      token,
      expiresAt,
      session: {
        organisationId: organisation.id,
        organisationName: organisation.name,
        organisationSlug: organisation.slug,
        role: membership.role,
        displayName: user.displayName,
      },
    };
  }

  async logout(token: string): Promise<void> {
    const manager = this.tenantContext.manager;
    const tokenHash = this.hashToken(token);
    await manager.getRepository(SessionEntity).delete({ tokenHash });
  }

  private async issueChallenge(
    identifier: string,
    purpose: "signup" | "login",
    language: "en" | "hi",
    tenantId: string,
    userId: string,
  ): Promise<IssuedChallenge> {
    const manager = this.tenantContext.manager;
    const rawCode = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    const channel: AuthChannel = EMAIL_RE.test(identifier)
      ? "email"
      : "whatsapp";

    const challenge = await manager.save(
      manager.create(AuthChallengeEntity, {
        tenantId,
        userId,
        identifier,
        channel,
        purpose,
        codeHash: "",
        expiresAt,
      }),
    );
    challenge.codeHash = this.hashCode(rawCode, challenge.id);
    await manager.save(challenge);

    await this.notifications.send({
      to: identifier,
      language,
      template: purpose === "signup" ? "otp_signup" : "otp_login",
      payload: { code: rawCode },
    });

    return { view: this.toChallengeView(challenge), rawCode };
  }

  private toChallengeView(challenge: AuthChallengeEntity): ChallengeView {
    return {
      challengeId: challenge.id,
      channel: challenge.channel,
      expiresAt: challenge.expiresAt.toISOString(),
      maskedIdentifier: this.maskIdentifier(challenge.identifier),
    };
  }

  private maskIdentifier(identifier: string): string {
    if (EMAIL_RE.test(identifier)) {
      const [local, domain] = identifier.split("@");
      return `${local.slice(0, 1)}***@${domain}`;
    }
    return `${identifier.slice(0, 3)}${"*".repeat(Math.max(identifier.length - 5, 0))}${identifier.slice(-2)}`;
  }

  /** Codes are hashed with the server pepper + the challenge's own id as salt, so two challenges never share a hash even for the same code. */
  private hashCode(code: string, challengeId: string): string {
    return createHash("sha256")
      .update(`${code}:${challengeId}:${this.config.authPepper}`)
      .digest("hex");
  }

  private hashToken(token: string): string {
    return createHash("sha256")
      .update(`${token}${this.config.authPepper}`)
      .digest("hex");
  }

  private async uniqueSlug(name: string): Promise<string> {
    const manager = this.tenantContext.manager;
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-+|-+$/gu, "")
        .slice(0, 48) || "organisation";
    let candidate = base;
    let suffix = 0;
    const repo = manager.getRepository(OrganisationEntity);
    while (await repo.findOne({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }
}
