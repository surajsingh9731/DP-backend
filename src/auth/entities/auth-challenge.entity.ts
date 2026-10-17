import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type AuthChallengePurpose = "signup" | "login";
export type AuthChannel = "email" | "whatsapp";

/**
 * tenant_id is nullable only because a login challenge is identifier-scoped
 * before the tenant is known. A signup challenge always carries the
 * brand-new organisation's id (created in the same transaction, before the
 * challenge row). See the RLS policy note in R1-system-design.md §3.
 */
@Entity({ name: "auth_challenges" })
@Index(["tenantId"])
export class AuthChallengeEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", nullable: true })
  tenantId!: string | null;

  @Column({ type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ type: "text" })
  identifier!: string;

  @Column({ type: "text" })
  channel!: AuthChannel;

  @Column({ type: "text" })
  purpose!: AuthChallengePurpose;

  @Column({ type: "text" })
  codeHash!: string;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
