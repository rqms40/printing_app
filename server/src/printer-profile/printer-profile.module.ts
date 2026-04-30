import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrinterProfile } from './entities/printer-profile.entity';
import { PrinterProfileService } from './printer-profile.service';
import { PrinterProfileController } from './printer-profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PrinterProfile])],
  providers: [PrinterProfileService],
  controllers: [PrinterProfileController],
  exports: [PrinterProfileService, TypeOrmModule],
})
export class PrinterProfileModule {}
