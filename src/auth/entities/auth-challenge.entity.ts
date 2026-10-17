import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A single email-OTP sign-in attempt. The code is never stored in the
 * clear — only its hash. Expiry, a bounded attempt count and single-use
 * consumption are enforced by AuthService, not by this entity.
 */
@Entity({ name: 'auth_challenges' })
export class AuthChallengeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text' })
  language!: 'en' | 'hi';

  @Column({ type: 'text' })
  codeHash!: string;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
