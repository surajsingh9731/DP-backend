import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type {
  RightsAssignee,
  RightsAssurance,
  RightsCorrection,
  RightsKind,
  RightsMode,
  RightsSourceAdmin,
  RightsStatus,
} from "@sahmati/contracts";

/** One rights request (module G): access, correction, erasure or grievance. */
@Entity({ name: "rights_requests" })
@Index(["tenantId"])
export class RightsRequestEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  sessionId!: string;

  @Column({ type: "text" })
  syntheticReference!: string;

  @Column({ type: "text" })
  kind!: RightsKind;

  @Column({ type: "text" })
  inputLanguage!: "en" | "hi";

  @Column({ type: "text" })
  details!: string;

  @Column({ type: "jsonb", nullable: true })
  correction!: RightsCorrection | null;

  @Column({ type: "jsonb" })
  source!: RightsSourceAdmin;

  @Column({ type: "text", default: "requested" })
  status!: RightsStatus;

  @Column({ type: "int", default: 1 })
  version!: number;

  @Column({ type: "jsonb", nullable: true })
  assignee!: RightsAssignee | null;

  @CreateDateColumn({ type: "timestamptz" })
  submittedAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @Column({ type: "text", default: "local-sample" })
  mode!: RightsMode;

  @Column({ type: "text", default: "unverified-synthetic-adult" })
  assurance!: RightsAssurance;
}
