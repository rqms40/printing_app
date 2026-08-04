import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierProfile } from './entities/supplier-profile.entity';
import { SupplierCapability } from './entities/supplier-capability.entity';
import { SupplierVerification } from './entities/supplier-verification.entity';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupplierProfile,
      SupplierCapability,
      SupplierVerification,
    ]),
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService, TypeOrmModule],
})
export class SuppliersModule {}
