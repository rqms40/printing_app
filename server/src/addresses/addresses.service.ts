import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  private readonly MAX_ADDRESSES = 5;

  constructor(
    @InjectRepository(Address) private addressRepo: Repository<Address>,
  ) {}

  async findByUser(userId: number): Promise<Address[]> {
    return this.addressRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<Address | null> {
    return this.addressRepo.findOne({ where: { id } });
  }

  async create(userId: number, dto: CreateAddressDto): Promise<Address> {
    const count = await this.addressRepo.count({ where: { userId } });
    if (count >= this.MAX_ADDRESSES) {
      throw new BadRequestException(
        `Maximum of ${this.MAX_ADDRESSES} addresses allowed`,
      );
    }

    // If this is the first address or isDefault is true, handle default logic
    if (count === 0 || dto.isDefault) {
      await this.clearDefault(userId);
      dto.isDefault = true;
    }

    const address = this.addressRepo.create({ ...dto, userId });
    return this.addressRepo.save(address);
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    const address = await this.findAndVerifyOwnership(id, userId);

    if (dto.isDefault) {
      await this.clearDefault(userId);
    }

    Object.assign(address, dto);
    return this.addressRepo.save(address);
  }

  async remove(id: number, userId: number): Promise<void> {
    const address = await this.findAndVerifyOwnership(id, userId);
    await this.addressRepo.remove(address);
  }

  async setDefault(id: number, userId: number): Promise<Address> {
    const address = await this.findAndVerifyOwnership(id, userId);
    await this.clearDefault(userId);
    address.isDefault = true;
    return this.addressRepo.save(address);
  }

  private async clearDefault(userId: number): Promise<void> {
    await this.addressRepo.update(
      { userId, isDefault: true },
      { isDefault: false },
    );
  }

  private async findAndVerifyOwnership(
    id: number,
    userId: number,
  ): Promise<Address> {
    const address = await this.addressRepo.findOne({ where: { id } });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('You can only manage your own addresses');
    }
    return address;
  }
}
