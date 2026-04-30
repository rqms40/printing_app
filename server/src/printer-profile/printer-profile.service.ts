import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrinterProfile } from './entities/printer-profile.entity';
import { UpdatePrinterProfileDto } from './dto/update-printer-profile.dto';

@Injectable()
export class PrinterProfileService {
  constructor(
    @InjectRepository(PrinterProfile)
    private readonly repo: Repository<PrinterProfile>,
  ) {}

  async getProfile(): Promise<PrinterProfile> {
    const existing = await this.repo.findOne({ where: { id: 1 } });
    if (existing) return existing;
    return this.repo.save(
      this.repo.create({
        id: 1,
        name: 'Bambu A1 Mini',
        buildVolumeWidthMm: 180,
        buildVolumeDepthMm: 180,
        buildVolumeHeightMm: 180,
        maxFileSizeMb: 200,
      }),
    );
  }

  async updateProfile(
    patch: UpdatePrinterProfileDto,
  ): Promise<PrinterProfile> {
    const current = await this.getProfile();
    Object.assign(current, patch);
    return this.repo.save(current);
  }
}
