import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import type { RegisterData, SetupStatus } from "@sahmati/contracts";

/** One row per tenant — guided setup has exactly one in-progress state at a time. */
@Entity({ name: "setup_records" })
export class SetupRecordEntity {
  @PrimaryColumn({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "int", default: 0 })
  version!: number;

  @Column({ type: "text" })
  organisationName!: string;

  @Column({ type: "text" })
  packId!: string;

  @Column({ type: "int" })
  packVersion!: number;

  @Column({ type: "int" })
  step!: 1 | 2 | 3;

  @Column({ type: "jsonb", nullable: true })
  draft!: RegisterData | null;

  @Column({ type: "text", default: "draft" })
  status!: SetupStatus;

  @Column({ type: "uuid", nullable: true })
  registerEntryId!: string | null;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
