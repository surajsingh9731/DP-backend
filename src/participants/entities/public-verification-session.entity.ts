import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { AuthChannel } from "../../auth/entities/auth-challenge.entity";

/**
 * A data principal's (parent/participant's) own verified session — never
 * a staff session, never backed by @sahmati/contracts MembershipRole.
 * One row serves both the OTP challenge and, once verified, the bearer
 * session: issued with codeHash set and verified=false; verify() sets
 * tokenHash and verified=true. Looked up only by its own opaque id or
 * token hash (see ParticipantSessionGuard) — never listed, so it carries
 * the same operational-access RLS policy as auth_challenges/sessions.
 */
@Entity({ name: "public_verification_sessions" })
@Index(["tenantId"])
export class PublicVerificationSessionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "text" })
  identifier!: string;

  @Column({ type: "text" })
  channel!: AuthChannel;

  @Column({ type: "text" })
  codeHash!: string;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ type: "boolean", default: false })
  verified!: boolean;

  @Column({ type: "text", nullable: true })
  tokenHash!: string | null;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
