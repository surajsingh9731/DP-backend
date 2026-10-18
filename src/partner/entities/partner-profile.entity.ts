import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * A partner's own white-label branding — not tenant data (a partner isn't
 * a member of one organisation, they advise several), so this table has
 * no `tenant_id` at all and is scoped by `user_id` instead (see
 * `userOwnedTableSql`). One row per partner identity.
 */
@Entity({ name: "partner_profiles" })
@Index(["userId"], { unique: true })
export class PartnerProfileEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "text" })
  brandName!: string;

  @Column({ type: "text", nullable: true })
  logoRef!: string | null;

  @Column({ type: "text" })
  contactEmail!: string;

  @Column({ type: "int", default: 1 })
  version!: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
