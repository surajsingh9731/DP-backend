import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * A local synthetic identity. There is no password: sign-in is a local email
 * OTP challenge only. This is not verified real-world identity — see
 * SessionView/AuthChallenge for the actual trust boundary.
 */
@Entity({ name: "users" })
export class UserEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text", unique: true })
  email!: string;

  @Column({ type: "text" })
  displayName!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
