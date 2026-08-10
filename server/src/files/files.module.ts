import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileMetadata } from './entities/file-metadata.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { PurgeService } from './purge.service';
import { FileAnalysisService } from './file-analysis.service';
import { Model3dAnalysisService } from './model-3d-analysis.service';
import { PaperSizeValidatorService } from './paper-size-validator.service';
import { PrinterProfileModule } from '../printer-profile/printer-profile.module';
import { ProductCategory } from '../products/entities/product-category.entity';
import { CatalogUploadPolicyService } from './catalog-upload-policy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileMetadata, ProductCategory]),
    PrinterProfileModule,
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    PurgeService,
    FileAnalysisService,
    Model3dAnalysisService,
    PaperSizeValidatorService,
    CatalogUploadPolicyService,
  ],
  exports: [FilesService, FileAnalysisService, PaperSizeValidatorService],
})
export class FilesModule {}
