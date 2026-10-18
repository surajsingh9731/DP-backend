import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type CommissionStatus = "pending" | "confirmed" | "paid";

/**
 * One commission entry for a client the partner referred — scoped by the
 * partner's own `user_id`, not a tenant (same reasoning as
 * PartnerProfileEntity). R2 scope: a partner records their own referral
 * and the amount agreed; a later pass would move confirmation/payment to
 * platform-admin instead of trusting the partner's own "confirmed"/"paid"
 * status, since nothing here is evidence of an actual payout — it's a
 * ledger the partner and Sahmati reconcile manually for now.
 */
@Entity({ name: "commission_records" })
@Index(["userId"])
export class CommissionRecordEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  organisationId!: string;

  @Column({ type: "numeric", precision: 10, scale: 2 })
  amountInr!: string;

  @Column({ type: "text", nullable: true })
  note!: string | null;

  @Column({ type: "text", default: "pending" })
  status!: CommissionStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
