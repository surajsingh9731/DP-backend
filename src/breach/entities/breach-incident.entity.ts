import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type BreachSeverity = "low" | "medium" | "high" | "critical";
export type BreachStatus =
  "open" | "contained" | "dpb_notified" | "principals_notified" | "closed";

/**
 * One breach incident. State moves forward through containment and the two
 * DPDP-mandated notifications (Data Protection Board, affected principals)
 * towards closure; each transition is also appended to the evidence ledger
 * since "we notified the Board on this date" is exactly the kind of claim
 * that needs a tamper-evident record, not just a mutable status column.
 */
@Entity({ name: "breach_incidents" })
@Index(["tenantId", "status"])
export class BreachIncidentEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "text" })
  title!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "timestamptz" })
  discoveredAt!: Date;

  @Column({ type: "text" })
  severity!: BreachSeverity;

  @Column({ type: "jsonb", default: () => "'[]'" })
  affectedDataCategories!: string[];

  @Column({ type: "int", nullable: true })
  affectedPrincipalsCount!: number | null;

  @Column({ type: "text", default: "open" })
  status!: BreachStatus;

  @Column({ type: "text", nullable: true })
  containmentNotes!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  dpbNotifiedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  principalsNotifiedAt!: Date | null;

  @Column({ type: "int", default: 1 })
  version!: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
