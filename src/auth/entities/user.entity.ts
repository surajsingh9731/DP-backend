import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * A person, not a tenant-owned record: a partner/accountant may hold
 * memberships in several organisations under one identity. No tenant_id,
 * no RLS policy here by design — see docs/architecture/R1-system-design.md.
 * Services must only ever resolve a user through a tenant-scoped
 * membership join, never list this table directly.
 */
@Entity({ name: "users" })
export class UserEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  displayName!: string;

  @Index({ unique: true, where: '"email" IS NOT NULL' })
  @Column({ type: "text", nullable: true })
  email!: string | null;

  @Index({ unique: true, where: '"phone_e164" IS NOT NULL' })
  @Column({ type: "text", nullable: true })
  phoneE164!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
