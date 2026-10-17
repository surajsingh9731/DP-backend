import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { RightsAction } from "@sahmati/contracts";

/** Full immutable internal audit trail for one request, shown only to staff/owner triage. */
@Entity({ name: "rights_audit_events" })
@Index(["requestId"])
export class RightsAuditEventEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  requestId!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "int" })
  version!: number;

  @Column({ type: "text" })
  action!: RightsAction | "submitted";

  @Column({ type: "text" })
  note!: string;

  @Column({ type: "text" })
  actorId!: string;

  @CreateDateColumn({ type: "timestamptz" })
  at!: Date;

  @Column({ type: "jsonb", default: () => "'[]'" })
  evidenceRefs!: string[];

  @Column({ type: "text", nullable: true })
  previousHash!: string | null;

  @Column({ type: "text" })
  eventHash!: string;
}
