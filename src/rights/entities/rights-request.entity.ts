import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type RightsRequestKind =
  "access" | "correction" | "erasure" | "grievance" | "nomination";
export type RightsRequestStatus =
  "requested" | "under_review" | "responded" | "closed";

/** One rights/grievance request — the brief's 90-day countdown is `dueAt`, computed at submission. */
@Entity({ name: "rights_requests" })
@Index(["tenantId", "status"])
export class RightsRequestEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  verificationSessionId!: string;

  @Column({ type: "text" })
  identifierMasked!: string;

  @Column({ type: "text" })
  kind!: RightsRequestKind;

  @Column({ type: "text" })
  details!: string;

  @Column({ type: "text" })
  status!: RightsRequestStatus;

  @Column({ type: "int", default: 1 })
  version!: number;

  /** Populated automatically for `kind = 'access'` from the tenant's own register — the brief's "auto access summary". */
  @Column({ type: "text", nullable: true })
  autoAccessSummary!: string | null;

  @Column({ type: "text", nullable: true })
  responseText!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  respondedAt!: Date | null;

  @Column({ type: "timestamptz" })
  dueAt!: Date;

  @CreateDateColumn({ type: "timestamptz" })
  submittedAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
