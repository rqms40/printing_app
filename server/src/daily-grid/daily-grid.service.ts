import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyGridCard } from './entities/daily-grid-card.entity';

@Injectable()
export class DailyGridService {
  constructor(
    @InjectRepository(DailyGridCard)
    private readonly repo: Repository<DailyGridCard>,
  ) {}

  findActive(): Promise<DailyGridCard[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  findAll(): Promise<DailyGridCard[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async findOne(id: number): Promise<DailyGridCard> {
    const card = await this.repo.findOne({ where: { id } });
    if (!card) throw new NotFoundException(`Daily grid card ${id} not found`);
    return card;
  }

  create(dto: Partial<DailyGridCard>): Promise<DailyGridCard> {
    const card = this.repo.create(dto);
    return this.repo.save(card);
  }

  async update(id: number, dto: Partial<DailyGridCard>): Promise<DailyGridCard> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  async reorder(ids: number[]): Promise<void> {
    await Promise.all(
      ids.map((id, index) => this.repo.update(id, { sortOrder: index })),
    );
  }
}
