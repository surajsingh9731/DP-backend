import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { TenantRole } from "@sahmati/contracts";

/** One user's role within one tenant. A user with no row here has no access to that tenant. */
@Entity({ name: "memberships" })
@Index(["tenantId", "userId"], { unique: true })
export class MembershipEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "text" })
  role!: TenantRole;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
