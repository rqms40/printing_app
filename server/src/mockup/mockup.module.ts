import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import { ArtworkMockupRender } from './entities/artwork-mockup-render.entity';
import { MockupController } from './mockup.controller';
import { MockupService } from './mockup.service';

/**
 * ArtworkMockupRender / Product Preview (Task 9.1).
 * Static template composites only — always labeled non-production.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ArtworkMockupRender, FileMetadata])],
  controllers: [MockupController],
  providers: [MockupService],
  exports: [MockupService, TypeOrmModule],
})
export class MockupModule {}
