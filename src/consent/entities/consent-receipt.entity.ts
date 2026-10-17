import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type ConsentReceiptKind = "choices_recorded" | "choices_withdrawn";

export interface ConsentChoice {
  registerEntryId: string;
  decision: "accept" | "decline";
}

/**
 * One row per consent action — append-only, per-tenant hash-chained,
 * same mechanism as EvidenceLedgerEntryEntity but kept in its own table
 * since consent receipts have their own shape (choices) and their own
 * participant-facing read path (see participantOwnRowSql).
 */
@Entity({ name: "consent_receipts" })
@Index(["tenantId", "occurredAt"])
export class ConsentReceiptEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  verificationSessionId!: string;

  /** Never the raw identifier — masked, for staff-facing ledger display only. */
  @Column({ type: "text" })
  identifierMasked!: string;

  @Column({ type: "text" })
  kind!: ConsentReceiptKind;

  @Column({ type: "jsonb" })
  choices!: ConsentChoice[];

  @Column({ type: "text", nullable: true })
  previousReceiptHash!: string | null;

  @Column({ type: "text" })
  receiptHash!: string;

  @CreateDateColumn({ type: "timestamptz" })
  occurredAt!: Date;
}
