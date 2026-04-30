import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileMetadata } from './entities/file-metadata.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { PurgeService } from './purge.service';
import { FileAnalysisService } from './file-analysis.service';
import { Model3dAnalysisService } from './model-3d-analysis.service';
import { PaperSizeValidatorService } from './paper-size-validator.service';

@Module({
  imports: [TypeOrmModule.forFeature([FileMetadata])],
  controllers: [FilesController],
  providers: [FilesService, PurgeService, FileAnalysisService, Model3dAnalysisService, PaperSizeValidatorService],
  exports: [FilesService, FileAnalysisService, PaperSizeValidatorService],
})
export class FilesModule {}
