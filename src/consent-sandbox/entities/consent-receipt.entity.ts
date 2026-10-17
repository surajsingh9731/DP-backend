import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type {
  ConsentChoice,
  ConsentContactVerification,
  ConsentDeletionStatus,
  ConsentLegalReviewStatus,
  ConsentOffer,
  ConsentReceiptAssurance,
  ConsentReceiptKind,
  ConsentReceiptMode,
} from "@sahmati/contracts";

/**
 * Append-only consent receipt. `previousReceiptHash`/`receiptHash` chain
 * every receipt for the same session — withdrawal history reads this chain
 * directly; nothing here is ever edited or deleted.
 */
@Entity({ name: "consent_receipts" })
@Index(["tenantId", "sessionId"])
export class ConsentReceiptEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  sessionId!: string;

  @Column({ type: "text" })
  syntheticReference!: string;

  @Column({ type: "jsonb" })
  offer!: ConsentOffer;

  @Column({ type: "int" })
  version!: number;

  @Column({ type: "text" })
  kind!: ConsentReceiptKind;

  @Column({ type: "jsonb" })
  choices!: ConsentChoice[];

  @Column({ type: "text" })
  interfaceLanguage!: "en" | "hi";

  @CreateDateColumn({ type: "timestamptz" })
  occurredAt!: Date;

  @Column({ type: "text", nullable: true })
  previousReceiptHash!: string | null;

  @Column({ type: "text" })
  receiptHash!: string;

  @Column({ type: "text", default: "local-sample" })
  mode!: ConsentReceiptMode;

  @Column({ type: "text", default: "unverified-synthetic-adult" })
  assurance!: ConsentReceiptAssurance;

  @Column({ type: "text", default: "unreviewed" })
  legalReviewStatus!: ConsentLegalReviewStatus;

  @Column({ type: "text", default: "unverified" })
  contactVerification!: ConsentContactVerification;

  @Column({ type: "text", default: "not-performed" })
  deletionStatus!: ConsentDeletionStatus;
}
