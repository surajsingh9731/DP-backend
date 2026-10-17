import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { MembershipRole } from "./membership.entity";

@Entity({ name: "sessions" })
@Index(["tenantId"])
export class SessionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  membershipId!: string;

  @Column({ type: "text" })
  role!: MembershipRole;

  @Index({ unique: true })
  @Column({ type: "text" })
  tokenHash!: string;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
