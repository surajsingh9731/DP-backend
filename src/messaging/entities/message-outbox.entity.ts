import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type MessageOutboxStatus = "pending" | "sent" | "failed";

/**
 * A notification queued by some other module's business action (e.g. "a
 * staff member responded to a rights request") for the worker process
 * (src/worker/main.ts) to actually deliver, instead of the request handler
 * blocking on a live SMTP/WhatsApp call. Enqueuing happens inside the same
 * transaction as the triggering write, so the message can never exist
 * without the business event that caused it, or vice versa.
 */
@Entity({ name: "message_outbox" })
@Index(["tenantId", "status"])
export class MessageOutboxEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "text" })
  recipient!: string;

  @Column({ type: "text" })
  language!: "en" | "hi";

  @Column({ type: "text" })
  template!: string;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({ type: "text", default: "pending" })
  status!: MessageOutboxStatus;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ type: "text", nullable: true })
  lastError!: string | null;

  @Column({ type: "text", nullable: true })
  providerRef!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  sentAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
