import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('file_metadata')
export class FileMetadata {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column()
  size: number;

  @Column()
  url: string;

  @Column({ name: 'object_key', type: 'varchar', nullable: true })
  objectKey: string | null;

  @Column({ name: 'uploaded_by', nullable: true })
  uploadedBy: number;

  @Column({
    name: 'expires_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
