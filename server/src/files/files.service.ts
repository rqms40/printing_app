import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileMetadata } from './entities/file-metadata.entity';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileMetadata)
    private fileRepo: Repository<FileMetadata>,
  ) {}

  async storeMetadata(file: Express.Multer.File, uploadedBy?: number): Promise<FileMetadata> {
    // MVP: generate a mock URL — replace with S3/R2 upload later
    const mockUrl = `/uploads/${Date.now()}_${file.originalname}`;

    const metadata = this.fileRepo.create({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: mockUrl,
      uploadedBy: uploadedBy ?? undefined,
    });

    return this.fileRepo.save(metadata);
  }

  async findById(id: number): Promise<FileMetadata> {
    const file = await this.fileRepo.findOne({ where: { id } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }
}
