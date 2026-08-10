import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PendingUploadState {
  PLANNED = 'planned',
  CLEANUP_PENDING = 'cleanup_pending',
  DELETING = 'deleting',
}

@Entity('pending_file_uploads')
@Index('idx_pending_file_uploads_due', ['nextAttemptAt'])
export class PendingFileUpload {
  @PrimaryColumn({ name: 'object_key', type: 'varchar', length: 512 })
  objectKey: string;

  @Column({ type: 'varchar', length: 32 })
  state: PendingUploadState;

  @Column({ name: 'upload_token', type: 'uuid' })
  uploadToken: string;

  @Column({ name: 'upload_lease_expires_at', type: 'timestamptz' })
  uploadLeaseExpiresAt: Date;

  @Column({ name: 'claim_token', type: 'uuid', nullable: true })
  claimToken: string | null;

  @Column({
    name: 'claim_lease_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  claimLeaseExpiresAt: Date | null;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'next_attempt_at', type: 'timestamptz' })
  nextAttemptAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
