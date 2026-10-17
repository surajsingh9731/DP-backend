import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { createHash, randomInt } from "node:crypto";
import { AppConfig } from "../../config/app-config.service";
import { MailboxService } from "../../local/services/mailbox.service";
import { AuthChallengeEntity } from "../entities/auth-challenge.entity";
import { SessionEntity } from "../entities/session.entity";
import { UserEntity } from "../entities/user.entity";
import { SESSION_COOKIE } from "../../common/guards/session.guard";

const CHALLENGE_TTL_MINUTES = 10;
const SESSION_TTL_HOURS = 12;
const MAX_ATTEMPTS = 5;

export interface ChallengeResult {
  challengeId: string;
  message: string;
}

export interface SessionCookie {
  name: string;
  value: string;
  maxAgeMs: number;
}

/**
 * Local email-OTP sign-in. This proves the caller can read the local
 * mailbox, nothing more — it is not real-world identity, age, or guardian
 * verification (see docs/sources for that boundary).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly config: AppConfig,
    private readonly mailbox: MailboxService,
    @InjectRepository(AuthChallengeEntity)
    private readonly challenges: Repository<AuthChallengeEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async createChallenge(
    email: string,
    language: "en" | "hi",
  ): Promise<ChallengeResult> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const codeHash = this.hashCode(code);
    const challenge = await this.challenges.save(
      this.challenges.create({
        email,
        language,
        codeHash,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60_000),
        attempts: 0,
        consumedAt: null,
      }),
    );
    await this.mailbox.deliver(
      email,
      language === "hi"
        ? "आपका Sahmati साइन-इन कोड"
        : "Your Sahmati sign-in code",
      language === "hi"
        ? `आपका एक-बार कोड है: ${code}। यह ${CHALLENGE_TTL_MINUTES} मिनट में समाप्त हो जाएगा।`
        : `Your one-time code is: ${code}. It expires in ${CHALLENGE_TTL_MINUTES} minutes.`,
    );
    return {
      challengeId: challenge.id,
      message:
        language === "hi"
          ? "स्थानीय मेलबॉक्स में एक कोड भेजा गया है।"
          : "A code has been sent to the local mailbox.",
    };
  }

  async verifyChallenge(
    challengeId: string,
    code: string,
  ): Promise<{ signedIn: boolean; cookie: SessionCookie }> {
    const challenge = await this.challenges.findOne({
      where: { id: challengeId },
    });
    if (!challenge)
      throw new BadRequestException("Unknown or expired challenge.");
    if (challenge.consumedAt)
      throw new BadRequestException("This code was already used.");
    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        "This code has expired. Request a new one.",
      );
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException("Too many attempts. Request a new code.");
    }

    const valid = challenge.codeHash === this.hashCode(code);
    challenge.attempts += 1;
    if (!valid) {
      await this.challenges.save(challenge);
      throw new UnauthorizedException("Incorrect code.");
    }
    challenge.consumedAt = new Date();
    await this.challenges.save(challenge);

    const user = await this.users.findOne({
      where: { email: challenge.email },
    });
    if (!user)
      throw new UnauthorizedException(
        "No account for this local demo address.",
      );

    const session = await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        tokenHash: "",
        expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 3_600_000),
        revokedAt: null,
      }),
    );
    session.tokenHash = this.tokenHashFor(session.id);
    await this.sessions.save(session);

    return {
      signedIn: true,
      cookie: {
        name: SESSION_COOKIE,
        value: session.id,
        maxAgeMs: SESSION_TTL_HOURS * 3_600_000,
      },
    };
  }

  async logout(sessionId: string | undefined): Promise<void> {
    if (!sessionId) return;
    await this.sessions.update({ id: sessionId }, { revokedAt: new Date() });
  }

  private hashCode(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  private tokenHashFor(sessionId: string): string {
    return createHash("sha256")
      .update(`${sessionId}:${this.config.authPepper}`)
      .digest("hex");
  }
}
