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

  @Column({ name: 'uploaded_by', nullable: true })
  uploadedBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
