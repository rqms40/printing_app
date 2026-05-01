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

  @Column({ name: 'width_pt', type: 'decimal', precision: 10, scale: 3, nullable: true })
  widthPt: number | null;

  @Column({ name: 'height_pt', type: 'decimal', precision: 10, scale: 3, nullable: true })
  heightPt: number | null;

  @Column({ name: 'width_px', type: 'integer', nullable: true })
  widthPx: number | null;

  @Column({ name: 'height_px', type: 'integer', nullable: true })
  heightPx: number | null;

  @Column({ name: 'color_space', type: 'varchar', length: 20, nullable: true })
  colorSpace: string | null;

  @Column({ name: 'page_count', type: 'integer', nullable: true })
  pageCount: number | null;

  @Column({ name: 'dpi', type: 'integer', nullable: true })
  dpi: number | null;

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

  @Column({
    name: 'model_3d_width_mm',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  model3dWidthMm: number | null;

  @Column({
    name: 'model_3d_depth_mm',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  model3dDepthMm: number | null;

  @Column({
    name: 'model_3d_height_mm',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  model3dHeightMm: number | null;

  @Column({
    name: 'model_3d_triangle_count',
    type: 'int',
    nullable: true,
  })
  model3dTriangleCount: number | null;

  @Column({
    name: 'preview_glb_object_key',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  previewGlbObjectKey: string | null;
}
