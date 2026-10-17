import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type MembershipRole = "owner" | "staff" | "viewer";

@Entity({ name: "memberships" })
@Index(["tenantId"])
@Index(["tenantId", "userId"], { unique: true })
export class MembershipEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid", nullable: true })
  branchId!: string | null;

  @Column({ type: "text" })
  role!: MembershipRole;

  @Column({ type: "boolean", default: false })
  verified!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
