import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type OutboxStatus = "pending" | "sent" | "failed";
export type OutboxChannel = "email";

/**
 * A queued outbound notification. The worker process (src/worker/) leases
 * pending rows, renders them, and hands them to the local mail sink — no
 * real email provider is configured anywhere in this project by explicit
 * decision (see docs/sources). `leaseUntil` lets a crashed worker's lease
 * expire so another pass can retry the same row, instead of it being stuck
 * forever.
 */
@Entity({ name: "message_outbox" })
@Index(["tenantId", "status"])
export class MessageOutboxEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "text", default: "email" })
  channel!: OutboxChannel;

  @Column({ type: "text" })
  recipient!: string;

  @Column({ type: "text" })
  template!: string;

  @Column({ type: "text" })
  language!: "en" | "hi";

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({ type: "text", default: "pending" })
  status!: OutboxStatus;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ type: "timestamptz", nullable: true })
  leaseUntil!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  sentAt!: Date | null;

  @Column({ type: "text", nullable: true })
  failureReason!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
