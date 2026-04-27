import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileMetadata } from './entities/file-metadata.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { PurgeService } from './purge.service';
import { FileAnalysisService } from './file-analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([FileMetadata])],
  controllers: [FilesController],
  providers: [FilesService, PurgeService, FileAnalysisService],
  exports: [FilesService, FileAnalysisService],
})
export class FilesModule {}
