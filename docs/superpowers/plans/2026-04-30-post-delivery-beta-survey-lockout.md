# Post-Delivery Beta Survey Lockout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an admin marks a beta user's order as `delivered` or `completed_pickup`, the mobile app forces a required survey, logs the user out after submission, and the backend prevents login until full release.

**Architecture:** The backend owns the durable survey requirement and account hold state. `OrdersService.updateStatus()` creates an idempotent post-delivery requirement for beta users; a new `TamSurveysService` validates/records required submissions and holds the account; auth rejects inactive users. Mobile reads account state, redirects to a non-dismissible required survey route, submits the requirement, then logs out.

**Tech Stack:** NestJS + TypeORM + Jest (server), Flutter + Riverpod + GoRouter (mobile), React + Ant Design + Vitest (admin).

---

## File Map

### Backend

Create:
- `server/src/tam-surveys/entities/tam-survey-requirement.entity.ts` — durable post-delivery survey requirement.
- `server/src/tam-surveys/dto/submit-survey.dto.ts` — DTOs for voluntary and required survey payloads.
- `server/src/tam-surveys/tam-surveys.service.ts` — requirement creation, account-state read, survey validation/submission.
- `server/src/tam-surveys/tam-surveys.service.spec.ts` — service unit tests.
- `server/src/auth/strategies/jwt.strategy.spec.ts` — rejects inactive users with existing tokens.

Modify:
- `server/src/tam-surveys/entities/tam-survey.entity.ts` — optional `orderId` and `requirementId` links.
- `server/src/users/entities/user.entity.ts` — account hold metadata.
- `server/src/tam-surveys/tam-surveys.module.ts` — register requirement entity and service; export service.
- `server/src/tam-surveys/tam-surveys.controller.ts` — use service and add required submit endpoint.
- `server/src/users/users.controller.ts` — `GET /users/me/account-state`.
- `server/src/auth/auth.service.ts` — reject inactive login with beta completion message.
- `server/src/auth/strategies/jwt.strategy.ts` — load user and reject inactive tokens.
- `server/src/orders/orders.module.ts` — import `TamSurveysModule`.
- `server/src/orders/orders.service.ts` — inject service and trigger requirement after admin completion status.
- `server/src/orders/orders.service.spec.ts` — completion trigger tests and mock provider updates.
- `server/src/auth/auth.service.spec.ts` — inactive login tests.
- `server/src/users/users.controller.spec.ts` — account-state controller test.
- `server/src/admin/admin.controller.ts` — include order metadata in TAM survey admin payloads.

### Mobile

Create:
- `apps/mobile/lib/features/customer/profile/models/account_state.dart` — account state and survey hold models.
- `apps/mobile/lib/features/customer/profile/providers/account_state_provider.dart` — refresh/clear state.
- `apps/mobile/lib/features/customer/profile/screens/required_tam_survey_screen.dart` — non-dismissible required survey.
- `apps/mobile/test/features/customer/profile/account_state_test.dart` — model/provider parsing tests.
- `apps/mobile/test/features/customer/profile/screens/required_tam_survey_screen_test.dart` — forced screen pop and answer gating tests.

Modify:
- `apps/mobile/lib/features/auth/providers/auth_provider.dart` — parse held login message, refresh/clear account state, expose optional login notice.
- `apps/mobile/lib/config/routes/app_router.dart` — account-state redirect and `/customer/survey/required` route.
- `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart` — refresh account state when WS order updates show `delivered`/`completedPickup`.

### Admin

Modify:
- `admin/src/pages/tam-surveys/list.tsx` — show linked order reference when present.
- `admin/src/pages/tam-surveys/show.tsx` — show linked order reference in detail.

---

## Task 1: Backend Entity and DTO Groundwork

**Files:**
- Create: `server/src/tam-surveys/entities/tam-survey-requirement.entity.ts`
- Create: `server/src/tam-surveys/dto/submit-survey.dto.ts`
- Modify: `server/src/tam-surveys/entities/tam-survey.entity.ts`
- Modify: `server/src/users/entities/user.entity.ts`

- [ ] **Step 1: Write failing entity metadata tests in the service spec**

Create `server/src/tam-surveys/tam-surveys.service.spec.ts` with this first block:

```typescript
import { getMetadataArgsStorage } from 'typeorm';
import { TamSurvey } from './entities/tam-survey.entity';
import {
  TamSurveyRequirement,
  TamSurveyRequirementReason,
  TamSurveyRequirementStatus,
} from './entities/tam-survey-requirement.entity';
import { User } from '../users/entities/user.entity';

describe('TAM survey post-delivery metadata', () => {
  it('TamSurveyRequirement declares required columns', () => {
    const cols = getMetadataArgsStorage()
      .filterColumns(TamSurveyRequirement)
      .map((c) => c.propertyName);

    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'userId',
        'orderId',
        'reason',
        'status',
        'surveyId',
        'requiredAt',
        'submittedAt',
        'createdAt',
        'updatedAt',
      ]),
    );
  });

  it('TamSurvey links optionally to order and requirement', () => {
    const cols = getMetadataArgsStorage()
      .filterColumns(TamSurvey)
      .map((c) => c.propertyName);

    expect(cols).toEqual(expect.arrayContaining(['orderId', 'requirementId']));
  });

  it('User has beta completion hold metadata', () => {
    const cols = getMetadataArgsStorage()
      .filterColumns(User)
      .map((c) => c.propertyName);

    expect(cols).toEqual(
      expect.arrayContaining([
        'accountHoldReason',
        'accountHeldAt',
        'betaCompletedAt',
      ]),
    );
  });

  it('uses stable enum values for requirement status and reason', () => {
    expect(TamSurveyRequirementReason.POST_DELIVERY).toBe('post_delivery');
    expect(TamSurveyRequirementStatus.PENDING).toBe('pending');
    expect(TamSurveyRequirementStatus.SUBMITTED).toBe('submitted');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd server && npx jest tam-surveys/tam-surveys.service.spec --no-coverage
```

Expected: fail because `tam-survey-requirement.entity.ts` does not exist and `TamSurvey` / `User` do not have the new columns.

- [ ] **Step 3: Create the requirement entity**

Create `server/src/tam-surveys/entities/tam-survey-requirement.entity.ts`:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';
import { TamSurvey } from './tam-survey.entity';

export enum TamSurveyRequirementReason {
  POST_DELIVERY = 'post_delivery',
}

export enum TamSurveyRequirementStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
}

@Entity('tam_survey_requirements')
@Index('idx_tam_survey_requirements_user_status', ['userId', 'status'])
@Index('uq_tam_survey_requirements_order_reason', ['orderId', 'reason'], {
  unique: true,
})
export class TamSurveyRequirement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({
    type: 'enum',
    enum: TamSurveyRequirementReason,
    default: TamSurveyRequirementReason.POST_DELIVERY,
  })
  reason: TamSurveyRequirementReason;

  @Column({
    type: 'enum',
    enum: TamSurveyRequirementStatus,
    default: TamSurveyRequirementStatus.PENDING,
  })
  status: TamSurveyRequirementStatus;

  @Column({ name: 'survey_id', type: 'int', nullable: true })
  surveyId: number | null;

  @OneToOne(() => TamSurvey, { nullable: true })
  @JoinColumn({ name: 'survey_id' })
  survey: TamSurvey | null;

  @Column({ name: 'required_at', type: 'timestamp' })
  requiredAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 4: Add links to `TamSurvey`**

In `server/src/tam-surveys/entities/tam-survey.entity.ts`, add imports:

```typescript
import { Order } from '../../orders/entities/order.entity';
import { TamSurveyRequirement } from './tam-survey-requirement.entity';
```

Add these fields after `user`:

```typescript
  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({ name: 'requirement_id', type: 'int', nullable: true })
  requirementId: number | null;

  @ManyToOne(() => TamSurveyRequirement, { nullable: true })
  @JoinColumn({ name: 'requirement_id' })
  requirement: TamSurveyRequirement | null;
```

- [ ] **Step 5: Add hold metadata to `User`**

In `server/src/users/entities/user.entity.ts`, add after `isActive`:

```typescript
  @Column({ name: 'account_hold_reason', type: 'varchar', length: 50, nullable: true })
  accountHoldReason: string | null;

  @Column({ name: 'account_held_at', type: 'timestamp', nullable: true })
  accountHeldAt: Date | null;

  @Column({ name: 'beta_completed_at', type: 'timestamp', nullable: true })
  betaCompletedAt: Date | null;
```

- [ ] **Step 6: Create DTOs**

Create `server/src/tam-surveys/dto/submit-survey.dto.ts`:

```typescript
import { Allow, IsObject } from 'class-validator';

export class SubmitTamSurveyDto {
  @IsObject()
  survey_data: Record<string, number>;

  @Allow()
  open_forum_feedback: Record<string, string> | string;
}

export class SubmitSurveyRequirementDto {
  @IsObject()
  surveyData: Record<string, number>;

  @IsObject()
  openForumFeedback: Record<string, string>;
}
```

- [ ] **Step 7: Run the test**

Run:

```bash
cd server && npx jest tam-surveys/tam-surveys.service.spec --no-coverage
```

Expected: the metadata tests pass.

- [ ] **Step 8: Commit**

```bash
git add server/src/tam-surveys/entities/tam-survey-requirement.entity.ts \
        server/src/tam-surveys/entities/tam-survey.entity.ts \
        server/src/tam-surveys/dto/submit-survey.dto.ts \
        server/src/users/entities/user.entity.ts \
        server/src/tam-surveys/tam-surveys.service.spec.ts
git commit -m "feat(surveys): add post-delivery requirement model"
```

---

## Task 2: Survey Service for Requirements, Submission, and Account State

**Files:**
- Create/modify: `server/src/tam-surveys/tam-surveys.service.ts`
- Modify: `server/src/tam-surveys/tam-surveys.service.spec.ts`
- Modify: `server/src/tam-surveys/tam-surveys.module.ts`

- [ ] **Step 1: Append service behavior tests**

Append to `server/src/tam-surveys/tam-surveys.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TamSurveysService } from './tam-surveys.service';
import { Order, OrderStatus } from '../orders/entities/order.entity';

const fullSurveyData = Object.fromEntries(
  Array.from({ length: 14 }, (_, index) => [String(index), index % 5]),
);

describe('TamSurveysService', () => {
  let service: TamSurveysService;
  let surveyRepo: jest.Mocked<Partial<Repository<TamSurvey>>>;
  let requirementRepo: jest.Mocked<Partial<Repository<TamSurveyRequirement>>>;
  let userRepo: any;

  const betaUser = {
    id: 10,
    email: 'beta@test.com',
    isBetaUser: true,
    isActive: true,
  };

  const order = {
    id: 55,
    orderId: 'ORD-10055',
    userId: 10,
    orderStatus: OrderStatus.DELIVERED,
  } as Order;

  beforeEach(async () => {
    surveyRepo = {
      create: jest.fn((data) => data as TamSurvey),
      save: jest.fn(async (survey) => ({ id: 900, ...survey }) as TamSurvey),
    };
    requirementRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => data as TamSurveyRequirement),
      save: jest.fn(async (req) => ({ id: 123, ...req }) as TamSurveyRequirement),
    };
    userRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        TamSurveysService,
        { provide: getRepositoryToken(TamSurvey), useValue: surveyRepo },
        {
          provide: getRepositoryToken(TamSurveyRequirement),
          useValue: requirementRepo,
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(TamSurveysService);
  });

  it('creates a pending requirement for a beta user order', async () => {
    userRepo.findOne.mockResolvedValue(betaUser);
    requirementRepo.findOne.mockResolvedValue(null);

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(requirementRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        orderId: 55,
        reason: TamSurveyRequirementReason.POST_DELIVERY,
        status: TamSurveyRequirementStatus.PENDING,
        surveyId: null,
        submittedAt: null,
        requiredAt: expect.any(Date),
      }),
    );
    expect(result?.id).toBe(123);
  });

  it('does not create a requirement for a non-beta user', async () => {
    userRepo.findOne.mockResolvedValue({ ...betaUser, isBetaUser: false });

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(result).toBeNull();
    expect(requirementRepo.save).not.toHaveBeenCalled();
  });

  it('returns the existing requirement instead of duplicating', async () => {
    const existing = { id: 77, userId: 10, orderId: 55 } as TamSurveyRequirement;
    userRepo.findOne.mockResolvedValue(betaUser);
    requirementRepo.findOne.mockResolvedValue(existing);

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(result).toBe(existing);
    expect(requirementRepo.save).not.toHaveBeenCalled();
  });

  it('returns survey_required account state when a pending hold exists', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      requiredAt: new Date('2026-04-30T12:00:00Z'),
      order,
    } as TamSurveyRequirement);

    const result = await service.getAccountState(10);

    expect(result).toEqual({
      accountStatus: 'survey_required',
      holds: [
        {
          type: 'post_delivery_survey',
          requirementId: 123,
          orderId: 55,
          orderRef: 'ORD-10055',
          requiredAt: new Date('2026-04-30T12:00:00Z'),
        },
      ],
    });
  });

  it('submits a requirement and holds the beta account', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);

    const result = await service.submitRequirement(10, 123, {
      surveyData: fullSurveyData,
      openForumFeedback: { feature: 'More slots', delivery: 'Good' },
    });

    expect(surveyRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        orderId: 55,
        requirementId: 123,
        surveyData: fullSurveyData,
        openForumFeedback: JSON.stringify({
          feature: 'More slots',
          delivery: 'Good',
        }),
      }),
    );
    expect(requirementRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TamSurveyRequirementStatus.SUBMITTED,
        surveyId: 900,
        submittedAt: expect.any(Date),
      }),
    );
    expect(userRepo.update).toHaveBeenCalledWith(10, {
      isActive: false,
      accountHoldReason: 'beta_survey_complete',
      accountHeldAt: expect.any(Date),
      betaCompletedAt: expect.any(Date),
    });
    expect(result).toEqual({
      success: true,
      surveyId: 900,
      logoutRequired: true,
    });
  });

  it('rejects partial survey data', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);

    await expect(
      service.submitRequirement(10, 123, {
        surveyData: { '0': 4 },
        openForumFeedback: { feature: '', delivery: '' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects submitting another user requirement', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 999,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);

    await expect(
      service.submitRequirement(10, 123, {
        surveyData: fullSurveyData,
        openForumFeedback: { feature: '', delivery: '' },
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws not found for missing requirement', async () => {
    requirementRepo.findOne.mockResolvedValue(null);

    await expect(
      service.submitRequirement(10, 123, {
        surveyData: fullSurveyData,
        openForumFeedback: { feature: '', delivery: '' },
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd server && npx jest tam-surveys/tam-surveys.service.spec --no-coverage
```

Expected: fail because `TamSurveysService` does not exist.

- [ ] **Step 3: Implement `TamSurveysService`**

Create `server/src/tam-surveys/tam-surveys.service.ts`:

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { TamSurvey } from './entities/tam-survey.entity';
import {
  TamSurveyRequirement,
  TamSurveyRequirementReason,
  TamSurveyRequirementStatus,
} from './entities/tam-survey-requirement.entity';
import {
  SubmitSurveyRequirementDto,
  SubmitTamSurveyDto,
} from './dto/submit-survey.dto';

const REQUIRED_SURVEY_QUESTION_COUNT = 14;
export const BETA_SURVEY_COMPLETE_HOLD_REASON = 'beta_survey_complete';

export type AccountStateResponse = {
  accountStatus: 'active' | 'survey_required';
  holds: Array<{
    type: 'post_delivery_survey';
    requirementId: number;
    orderId: number;
    orderRef: string;
    requiredAt: Date;
  }>;
};

@Injectable()
export class TamSurveysService {
  constructor(
    @InjectRepository(TamSurvey)
    private readonly tamSurveysRepo: Repository<TamSurvey>,
    @InjectRepository(TamSurveyRequirement)
    private readonly requirementsRepo: Repository<TamSurveyRequirement>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async createVoluntarySurvey(
    userId: number,
    dto: SubmitTamSurveyDto,
  ): Promise<{ success: true; surveyId: number }> {
    const surveyData = this.validateSurveyData(dto.survey_data, false);
    const survey = this.tamSurveysRepo.create({
      userId,
      surveyData,
      openForumFeedback:
        typeof dto.open_forum_feedback === 'string'
          ? dto.open_forum_feedback
          : JSON.stringify(dto.open_forum_feedback),
      orderId: null,
      requirementId: null,
    });
    const saved = await this.tamSurveysRepo.save(survey);
    return { success: true, surveyId: saved.id };
  }

  async createPostDeliveryRequirementIfNeeded(
    order: Pick<Order, 'id' | 'orderId' | 'userId'>,
  ): Promise<TamSurveyRequirement | null> {
    const user = await this.usersRepo.findOne({ where: { id: order.userId } });
    if (!user?.isBetaUser) return null;

    const existing = await this.requirementsRepo.findOne({
      where: {
        orderId: order.id,
        reason: TamSurveyRequirementReason.POST_DELIVERY,
      },
    });
    if (existing) return existing;

    const requirement = this.requirementsRepo.create({
      userId: order.userId,
      orderId: order.id,
      reason: TamSurveyRequirementReason.POST_DELIVERY,
      status: TamSurveyRequirementStatus.PENDING,
      surveyId: null,
      requiredAt: new Date(),
      submittedAt: null,
    });
    return this.requirementsRepo.save(requirement);
  }

  async getAccountState(userId: number): Promise<AccountStateResponse> {
    const requirement = await this.requirementsRepo.findOne({
      where: {
        userId,
        reason: TamSurveyRequirementReason.POST_DELIVERY,
        status: TamSurveyRequirementStatus.PENDING,
      },
      relations: ['order'],
      order: { requiredAt: 'ASC' },
    });

    if (!requirement) {
      return { accountStatus: 'active', holds: [] };
    }

    return {
      accountStatus: 'survey_required',
      holds: [
        {
          type: 'post_delivery_survey',
          requirementId: requirement.id,
          orderId: requirement.orderId,
          orderRef: requirement.order?.orderId ?? `ORD-${requirement.orderId}`,
          requiredAt: requirement.requiredAt,
        },
      ],
    };
  }

  async submitRequirement(
    userId: number,
    requirementId: number,
    dto: SubmitSurveyRequirementDto,
  ): Promise<{ success: true; surveyId: number; logoutRequired: true }> {
    const requirement = await this.requirementsRepo.findOne({
      where: { id: requirementId },
    });
    if (!requirement) throw new NotFoundException('Survey requirement not found');
    if (requirement.userId !== userId) {
      throw new ForbiddenException('You can only submit your own survey');
    }
    if (requirement.status !== TamSurveyRequirementStatus.PENDING) {
      throw new BadRequestException('Survey requirement already submitted');
    }

    const surveyData = this.validateSurveyData(dto.surveyData, true);
    const survey = this.tamSurveysRepo.create({
      userId,
      orderId: requirement.orderId,
      requirementId: requirement.id,
      surveyData,
      openForumFeedback: JSON.stringify(dto.openForumFeedback ?? {}),
    });
    const savedSurvey = await this.tamSurveysRepo.save(survey);

    requirement.status = TamSurveyRequirementStatus.SUBMITTED;
    requirement.surveyId = savedSurvey.id;
    requirement.submittedAt = new Date();
    await this.requirementsRepo.save(requirement);

    const holdAt = new Date();
    await this.usersRepo.update(userId, {
      isActive: false,
      accountHoldReason: BETA_SURVEY_COMPLETE_HOLD_REASON,
      accountHeldAt: holdAt,
      betaCompletedAt: holdAt,
    });

    return { success: true, surveyId: savedSurvey.id, logoutRequired: true };
  }

  private validateSurveyData(
    data: Record<string, number>,
    requireComplete: boolean,
  ): Record<string, number> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException('surveyData must be an object');
    }

    const result: Record<string, number> = {};
    for (const [key, rawValue] of Object.entries(data)) {
      if (!/^\d+$/.test(key)) {
        throw new BadRequestException(`Invalid survey question key: ${key}`);
      }
      const index = Number(key);
      if (index < 0 || index >= REQUIRED_SURVEY_QUESTION_COUNT) {
        throw new BadRequestException(`Unknown survey question key: ${key}`);
      }
      if (!Number.isInteger(rawValue) || rawValue < 0 || rawValue > 4) {
        throw new BadRequestException(`Invalid answer for question ${key}`);
      }
      result[key] = rawValue;
    }

    if (requireComplete) {
      for (let i = 0; i < REQUIRED_SURVEY_QUESTION_COUNT; i++) {
        if (result[String(i)] == null) {
          throw new BadRequestException(`Missing answer for question ${i}`);
        }
      }
    }

    return result;
  }
}
```

- [ ] **Step 4: Register service and requirement entity in module**

Update `server/src/tam-surveys/tam-surveys.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TamSurvey } from './entities/tam-survey.entity';
import { TamSurveyRequirement } from './entities/tam-survey-requirement.entity';
import { TamSurveySettings } from './entities/tam-survey-settings.entity';
import { TamSurveysController } from './tam-surveys.controller';
import { TamSurveysService } from './tam-surveys.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TamSurvey,
      TamSurveyRequirement,
      TamSurveySettings,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [TamSurveysController],
  providers: [TamSurveysService],
  exports: [TamSurveysService, TypeOrmModule],
})
export class TamSurveysModule {}
```

- [ ] **Step 5: Run focused service test**

Run:

```bash
cd server && npx jest tam-surveys/tam-surveys.service.spec --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/tam-surveys/tam-surveys.service.ts \
        server/src/tam-surveys/tam-surveys.service.spec.ts \
        server/src/tam-surveys/tam-surveys.module.ts
git commit -m "feat(surveys): add post-delivery survey service"
```

---

## Task 3: Controllers for Account State and Required Survey Submit

**Files:**
- Modify: `server/src/tam-surveys/tam-surveys.controller.ts`
- Modify: `server/src/tam-surveys/tam-surveys.service.ts`
- Modify: `server/src/users/users.controller.ts`
- Modify: `server/src/users/users.module.ts`
- Modify: `server/src/users/users.controller.spec.ts`
- Modify: `server/src/admin/admin.controller.ts`

- [ ] **Step 1: Update users controller spec for account state**

In `server/src/users/users.controller.spec.ts`, import and provide `TamSurveysService`:

```typescript
import { TamSurveysService } from '../tam-surveys/tam-surveys.service';
```

Create this mock near the existing service mock:

```typescript
const mockTamSurveysService = {
  getAccountState: jest.fn(),
};
```

Register it in the testing module providers:

```typescript
{ provide: TamSurveysService, useValue: mockTamSurveysService },
```

Add this controller test:

```typescript
  it('GET /users/me/account-state returns account gate state', async () => {
    mockTamSurveysService.getAccountState.mockResolvedValue({
      accountStatus: 'survey_required',
      holds: [{ requirementId: 123, orderId: 55 }],
    });

    const result = await controller.getAccountState(mockReq);

    expect(result).toEqual({
      accountStatus: 'survey_required',
      holds: [{ requirementId: 123, orderId: 55 }],
    });
    expect(mockTamSurveysService.getAccountState).toHaveBeenCalledWith(42);
  });
```

- [ ] **Step 2: Run failing users controller test**

Run:

```bash
cd server && npx jest users/users.controller.spec --no-coverage
```

Expected: fail because `getAccountState` is not implemented.

- [ ] **Step 3: Add account-state endpoint backed by survey service**

Modify `server/src/users/users.controller.ts` constructor:

```typescript
import { TamSurveysService } from '../tam-surveys/tam-surveys.service';

export class UsersController {
  constructor(
    private usersService: UsersService,
    private tamSurveysService: TamSurveysService,
  ) {}
```

Add the endpoint:

```typescript
  @Get('me/account-state')
  async getAccountState(@Request() req: RequestWithUser) {
    return this.tamSurveysService.getAccountState(req.user.sub);
  }
```

- [ ] **Step 4: Import survey module into users module**

Update `server/src/users/users.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TamSurveysModule } from '../tam-surveys/tam-surveys.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), TamSurveysModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 5: Move approved feed logic into service**

Add this method to `server/src/tam-surveys/tam-surveys.service.ts`:

```typescript
  async getApprovedFeed() {
    const surveys = await this.tamSurveysRepo.find({
      where: { isApprovedForFeed: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    return surveys.map((s) => {
      let rating = 5.0;
      if (s.surveyData) {
        const values = Object.values(s.surveyData);
        if (values.length > 0) {
          const sum = values.reduce((acc, val) => acc + Number(val), 0);
          rating = Number((sum / values.length).toFixed(1));
        }
      }

      return {
        id: s.id,
        user_name: s.user?.fullName ?? s.user?.email ?? 'Customer',
        rating,
        feedback: s.openForumFeedback ?? null,
        created_at: s.createdAt,
      };
    });
  }
```

- [ ] **Step 6: Update survey controller to use service**

Modify `server/src/tam-surveys/tam-surveys.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TamSurveysService } from './tam-surveys.service';
import {
  SubmitSurveyRequirementDto,
  SubmitTamSurveyDto,
} from './dto/submit-survey.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TamSurveySettings } from './entities/tam-survey-settings.entity';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('tam-surveys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tam-surveys')
export class TamSurveysController {
  constructor(
    @InjectRepository(TamSurveySettings)
    private tamSurveySettingsRepo: Repository<TamSurveySettings>,
    private tamSurveysService: TamSurveysService,
    private notificationsService: NotificationsService,
  ) {}

  @Get('settings')
  async getSettings() {
    let settings = await this.tamSurveySettingsRepo.findOne({
      where: { id: 1 },
    });
    if (!settings) {
      settings = this.tamSurveySettingsRepo.create({ id: 1, isEnabled: true });
      await this.tamSurveySettingsRepo.save(settings);
    }
    return settings;
  }

  @Post()
  async createSurvey(
    @Req() req: { user: { sub: number } },
    @Body() body: SubmitTamSurveyDto,
  ) {
    const result = await this.tamSurveysService.createVoluntarySurvey(
      req.user.sub,
      body,
    );
    this.notificationsService
      .createForAllAdmins({
        title: 'New Feedback Survey',
        message: 'A new feedback survey was submitted by a customer.',
        type: 'user',
        metadata: { surveyId: result.surveyId },
      })
      .catch((e) => console.error('Failed to notify admins for survey:', e));
    return { success: true };
  }

  @Post('requirements/:requirementId/submit')
  submitRequirement(
    @Req() req: { user: { sub: number } },
    @Param('requirementId', ParseIntPipe) requirementId: number,
    @Body() body: SubmitSurveyRequirementDto,
  ) {
    return this.tamSurveysService.submitRequirement(
      req.user.sub,
      requirementId,
      body,
    );
  }

  @Get('feed')
  async getApprovedFeed() {
    return this.tamSurveysService.getApprovedFeed();
  }
}
```

- [ ] **Step 7: Update admin survey payloads with order ref**

In `server/src/admin/admin.controller.ts`, change survey `relations` from `['user']` to `['user', 'order']` for list and show, and include:

```typescript
order_id: s.orderId ?? null,
order_ref: s.order?.orderId ?? null,
requirement_id: s.requirementId ?? null,
```

- [ ] **Step 8: Run focused server tests**

Run:

```bash
cd server && npx jest users/users.controller.spec tam-surveys/tam-surveys.service.spec --no-coverage
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add server/src/tam-surveys/tam-surveys.controller.ts \
        server/src/tam-surveys/tam-surveys.service.ts \
        server/src/users/users.controller.ts \
        server/src/users/users.controller.spec.ts \
        server/src/users/users.module.ts \
        server/src/admin/admin.controller.ts
git commit -m "feat(surveys): add account state and required submit APIs"
```

---

## Task 4: Admin Completion Status Creates Survey Requirement

**Files:**
- Modify: `server/src/orders/orders.module.ts`
- Modify: `server/src/orders/orders.service.ts`
- Modify: `server/src/orders/orders.service.spec.ts`

- [ ] **Step 1: Add failing order status trigger tests**

In `server/src/orders/orders.service.spec.ts`, in `OrdersService.updateStatus — expiresAt stamping`, add mock:

```typescript
const mockTamSurveysService = {
  createPostDeliveryRequirementIfNeeded: jest.fn(),
};
```

Register provider:

```typescript
{ provide: TamSurveysService, useValue: mockTamSurveysService },
```

Add import:

```typescript
import { TamSurveysService } from '../tam-surveys/tam-surveys.service';
```

Add tests:

```typescript
  it('creates a post-delivery survey requirement when delivered', async () => {
    const order = makeOrder({ orderStatus: OrderStatus.DELIVERED });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: null });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.updateStatus(1, 'delivered');

    expect(
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded,
    ).toHaveBeenCalledWith(order);
  });

  it('creates a post-delivery survey requirement when completed_pickup', async () => {
    const order = makeOrder({ orderStatus: OrderStatus.COMPLETED_PICKUP });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: null });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.updateStatus(1, 'completed_pickup');

    expect(
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded,
    ).toHaveBeenCalledWith(order);
  });

  it('does not create a survey requirement for non-completion statuses', async () => {
    const order = makeOrder({ orderStatus: OrderStatus.FILE_VERIFIED });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.updateStatus(1, 'file_verified');

    expect(
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded,
    ).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run failing order test**

Run:

```bash
cd server && npx jest orders/orders.service.spec --runInBand --no-coverage
```

Expected: fail because `OrdersService` does not inject or call `TamSurveysService`.

- [ ] **Step 3: Import module**

In `server/src/orders/orders.module.ts`, add:

```typescript
import { TamSurveysModule } from '../tam-surveys/tam-surveys.module';
```

Add `TamSurveysModule` to imports:

```typescript
TamSurveysModule,
```

- [ ] **Step 4: Inject and call service**

In `server/src/orders/orders.service.ts`, add import:

```typescript
import { TamSurveysService } from '../tam-surveys/tam-surveys.service';
```

Add constructor param after `filesService`:

```typescript
    private tamSurveysService: TamSurveysService,
```

After the file-expiry block inside `updateStatus()`, add:

```typescript
    if (
      orderStatus === OrderStatus.DELIVERED ||
      orderStatus === OrderStatus.COMPLETED_PICKUP
    ) {
      await this.tamSurveysService.createPostDeliveryRequirementIfNeeded(order);
    }
```

Keep this after the order has been reloaded from the database so `order.userId`, `order.id`, and `order.orderId` are populated.

- [ ] **Step 5: Update other `OrdersService` test modules with provider**

Every testing module that provides `OrdersService` must add:

```typescript
{ provide: TamSurveysService, useValue: { createPostDeliveryRequirementIfNeeded: jest.fn() } },
```

Use `rg -n "providers: \\[|OrdersService" server/src/orders/orders.service.spec.ts` to find each testing module block.

- [ ] **Step 6: Run focused order tests**

Run:

```bash
cd server && npx jest orders/orders.service.spec --runInBand --no-coverage
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/orders/orders.module.ts \
        server/src/orders/orders.service.ts \
        server/src/orders/orders.service.spec.ts
git commit -m "feat(orders): trigger beta survey after admin completion"
```

---

## Task 5: Auth Blocks Held Accounts

**Files:**
- Modify: `server/src/auth/auth.service.ts`
- Modify: `server/src/auth/auth.service.spec.ts`
- Modify: `server/src/auth/strategies/jwt.strategy.ts`
- Create: `server/src/auth/strategies/jwt.strategy.spec.ts`

- [ ] **Step 1: Add failing login tests**

In `server/src/auth/auth.service.spec.ts`, add these tests under `describe('login')`:

```typescript
    it('rejects inactive users', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
        isActive: false,
        accountHoldReason: null,
      });

      await expect(
        authService.login('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('uses beta completion message for beta survey hold', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
        isActive: false,
        accountHoldReason: 'beta_survey_complete',
      });

      await expect(
        authService.login('test@example.com', 'password123'),
      ).rejects.toThrow(
        'Beta testing completed. Your account will reopen at full release.',
      );
    });
```

- [ ] **Step 2: Add failing JWT strategy tests**

Create `server/src/auth/strategies/jwt.strategy.spec.ts`:

```typescript
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy account status enforcement', () => {
  let strategy: JwtStrategy;
  const usersService = { findById: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: usersService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('returns token payload for active users', async () => {
    usersService.findById.mockResolvedValue({ id: 1, isActive: true });

    await expect(
      strategy.validate({ sub: 1, email: 'a@test.com', role: 'customer' }),
    ).resolves.toEqual({ sub: 1, email: 'a@test.com', role: 'customer' });
  });

  it('rejects inactive users with existing tokens', async () => {
    usersService.findById.mockResolvedValue({ id: 1, isActive: false });

    await expect(
      strategy.validate({ sub: 1, email: 'a@test.com', role: 'customer' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 3: Run failing auth tests**

Run:

```bash
cd server && npx jest auth/auth.service.spec auth/strategies/jwt.strategy.spec --no-coverage
```

Expected: fail because inactive users are not checked.

- [ ] **Step 4: Update `AuthService.login()`**

In `server/src/auth/auth.service.ts`, after the password check and before removing `passwordHash`, add:

```typescript
    if (user.isActive === false) {
      if (user.accountHoldReason === 'beta_survey_complete') {
        throw new UnauthorizedException(
          'Beta testing completed. Your account will reopen at full release.',
        );
      }
      throw new UnauthorizedException('Account is inactive');
    }
```

- [ ] **Step 5: Update `JwtStrategy`**

In `server/src/auth/strategies/jwt.strategy.ts`, inject `UsersService` and make `validate` async:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../common/interfaces/request-with-user';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.isActive === false) {
      throw new UnauthorizedException('Account is inactive');
    }
    return { sub: payload.sub, email: payload.email, role: payload.role };
  }
}
```

- [ ] **Step 6: Run focused auth tests**

Run:

```bash
cd server && npx jest auth/auth.service.spec auth/strategies/jwt.strategy.spec --no-coverage
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/auth/auth.service.ts \
        server/src/auth/auth.service.spec.ts \
        server/src/auth/strategies/jwt.strategy.ts \
        server/src/auth/strategies/jwt.strategy.spec.ts
git commit -m "feat(auth): block held beta accounts"
```

---

## Task 6: Mobile Account State Model and Provider

**Files:**
- Create: `apps/mobile/lib/features/customer/profile/models/account_state.dart`
- Create: `apps/mobile/lib/features/customer/profile/providers/account_state_provider.dart`
- Create: `apps/mobile/test/features/customer/profile/account_state_test.dart`

- [ ] **Step 1: Write model tests**

Create `apps/mobile/test/features/customer/profile/account_state_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';

void main() {
  group('AccountState', () {
    test('parses active response', () {
      final state = AccountState.fromJson({
        'accountStatus': 'active',
        'holds': <dynamic>[],
      });

      expect(state.status, AccountGateStatus.active);
      expect(state.holds, isEmpty);
      expect(state.requiredSurveyHold, isNull);
    });

    test('parses survey required response', () {
      final state = AccountState.fromJson({
        'accountStatus': 'survey_required',
        'holds': [
          {
            'type': 'post_delivery_survey',
            'requirementId': 123,
            'orderId': 55,
            'orderRef': 'ORD-10055',
            'requiredAt': '2026-04-30T12:00:00.000Z',
          }
        ],
      });

      expect(state.status, AccountGateStatus.surveyRequired);
      expect(state.requiredSurveyHold?.requirementId, 123);
      expect(state.requiredSurveyHold?.orderRef, 'ORD-10055');
    });
  });
}
```

- [ ] **Step 2: Run failing mobile test**

Run:

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/profile/account_state_test.dart
```

Expected: fail because `account_state.dart` does not exist.

- [ ] **Step 3: Create account state model**

Create `apps/mobile/lib/features/customer/profile/models/account_state.dart`:

```dart
enum AccountGateStatus { unknown, active, surveyRequired }

class SurveyRequirementHold {
  const SurveyRequirementHold({
    required this.requirementId,
    required this.orderId,
    required this.orderRef,
    required this.requiredAt,
  });

  final int requirementId;
  final int orderId;
  final String orderRef;
  final DateTime requiredAt;

  factory SurveyRequirementHold.fromJson(Map<String, dynamic> json) {
    return SurveyRequirementHold(
      requirementId: (json['requirementId'] as num).toInt(),
      orderId: (json['orderId'] as num).toInt(),
      orderRef: json['orderRef']?.toString() ?? '',
      requiredAt: DateTime.parse(json['requiredAt'] as String),
    );
  }
}

class AccountState {
  const AccountState({
    required this.status,
    this.holds = const [],
    this.isLoading = false,
  });

  const AccountState.unknown()
      : status = AccountGateStatus.unknown,
        holds = const [],
        isLoading = false;

  final AccountGateStatus status;
  final List<SurveyRequirementHold> holds;
  final bool isLoading;

  SurveyRequirementHold? get requiredSurveyHold =>
      holds.isEmpty ? null : holds.first;

  bool get requiresSurvey => status == AccountGateStatus.surveyRequired;

  AccountState copyWith({
    AccountGateStatus? status,
    List<SurveyRequirementHold>? holds,
    bool? isLoading,
  }) {
    return AccountState(
      status: status ?? this.status,
      holds: holds ?? this.holds,
      isLoading: isLoading ?? this.isLoading,
    );
  }

  factory AccountState.fromJson(Map<String, dynamic> json) {
    final rawStatus = json['accountStatus']?.toString();
    final rawHolds = json['holds'];
    final holds = rawHolds is List
        ? rawHolds
            .whereType<Map>()
            .map((item) => SurveyRequirementHold.fromJson(
                  Map<String, dynamic>.from(item),
                ))
            .toList()
        : <SurveyRequirementHold>[];

    return AccountState(
      status: rawStatus == 'survey_required'
          ? AccountGateStatus.surveyRequired
          : AccountGateStatus.active,
      holds: holds,
    );
  }
}
```

- [ ] **Step 4: Create provider**

Create `apps/mobile/lib/features/customer/profile/providers/account_state_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/shared/services/api_client.dart';

class AccountStateNotifier extends StateNotifier<AccountState> {
  AccountStateNotifier() : super(const AccountState.unknown());

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await ApiClient.instance.get('/users/me/account-state');
      state = AccountState.fromJson(
        Map<String, dynamic>.from(response.data as Map),
      );
    } catch (_) {
      state = const AccountState(status: AccountGateStatus.active);
    }
  }

  void clear() {
    state = const AccountState.unknown();
  }
}

final accountStateProvider =
    StateNotifierProvider<AccountStateNotifier, AccountState>(
  (ref) => AccountStateNotifier(),
);
```

- [ ] **Step 5: Run model test**

Run:

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/profile/account_state_test.dart
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/customer/profile/models/account_state.dart \
        apps/mobile/lib/features/customer/profile/providers/account_state_provider.dart \
        apps/mobile/test/features/customer/profile/account_state_test.dart
git commit -m "feat(mobile): add account state model"
```

---

## Task 7: Mobile Auth, Router, and Order Update Gating

**Files:**
- Modify: `apps/mobile/lib/features/auth/providers/auth_provider.dart`
- Modify: `apps/mobile/lib/config/routes/app_router.dart`
- Modify: `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`

- [ ] **Step 1: Update `AuthNotifier` to receive `Ref`**

In `apps/mobile/lib/features/auth/providers/auth_provider.dart`, import account provider:

```dart
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
```

Change constructor:

```dart
class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier([this._ref]) : super(AuthState.unauthenticated()) {
    _listenToFcmMessages();
  }

  final Ref? _ref;
```

Change provider:

```dart
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(ref),
);
```

- [ ] **Step 2: Refresh/clear account state in auth methods**

After successful `login`, `register`, and `tryAutoLogin` authenticated state assignment, add:

```dart
      await _ref?.read(accountStateProvider.notifier).refresh();
```

In `logout()`, before setting unauthenticated:

```dart
    _ref?.read(accountStateProvider.notifier).clear();
```

In `tryAutoLogin()` catch block, add:

```dart
      _ref?.read(accountStateProvider.notifier).clear();
```

- [ ] **Step 3: Preserve held-login message**

In `login()` DioException handling, keep the backend message. The existing code already reads `message`; verify it remains:

```dart
      final message = e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString() ?? 'Login failed'
          : 'Login failed';
```

- [ ] **Step 4: Add account state to router refresh**

In `apps/mobile/lib/config/routes/app_router.dart`, import:

```dart
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/features/customer/profile/screens/required_tam_survey_screen.dart';
```

Update `_AuthChangeNotifier` constructor:

```dart
  _AuthChangeNotifier(this._ref) {
    _ref.listen(authProvider, (_, _) => notifyListeners());
    _ref.listen(accountStateProvider, (_, _) => notifyListeners());
  }
```

In `redirect`, after the `isOnSplash` check and before the onboarding/auth/profile redirect blocks, add:

```dart
      final accountState = ref.read(accountStateProvider);
      final isForcedSurvey = state.matchedLocation == '/customer/survey/required';
      if (isForcedSurvey && !isAuth) {
        return '/auth/login';
      }
      if (isAuth && accountState.status == AccountGateStatus.surveyRequired) {
        return isForcedSurvey ? null : '/customer/survey/required';
      }
      if (isForcedSurvey &&
          isAuth &&
          accountState.status != AccountGateStatus.surveyRequired) {
        return '/customer/home';
      }
```

- [ ] **Step 5: Add forced survey route**

In `routes`, after the voluntary `/customer/profile/survey` route, add:

```dart
      GoRoute(
        path: '/customer/survey/required',
        pageBuilder: (_, state) =>
            fadeTransition(const RequiredTamSurveyScreen(), state),
      ),
```

- [ ] **Step 6: Refresh account state on completion websocket update**

In `apps/mobile/lib/features/customer/orders/providers/orders_provider.dart`, import:

```dart
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
```

Change notifier constructor:

```dart
  OrdersNotifier({
    List<Order> initialState = const [],
    bool skipBootstrap = false,
    this.onCompletionUpdate,
  }) : super(initialState) {
```

Add field:

```dart
  final Future<void> Function()? onCompletionUpdate;
```

Inside the websocket update handler, after `state = next;`, add:

```dart
              if (updated.orderStatus == OrderStatus.delivered ||
                  updated.orderStatus == OrderStatus.completedPickup) {
                unawaited(onCompletionUpdate?.call());
              }
```

Add import for unawaited:

```dart
import 'dart:async';
```

Update provider:

```dart
final ordersProvider = StateNotifierProvider<OrdersNotifier, List<Order>>((
  ref,
) {
  return OrdersNotifier(
    onCompletionUpdate: () =>
        ref.read(accountStateProvider.notifier).refresh(),
  );
});
```

- [ ] **Step 7: Analyze touched Dart files**

Run:

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze \
  lib/features/auth/providers/auth_provider.dart \
  lib/config/routes/app_router.dart \
  lib/features/customer/orders/providers/orders_provider.dart
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/lib/features/auth/providers/auth_provider.dart \
        apps/mobile/lib/config/routes/app_router.dart \
        apps/mobile/lib/features/customer/orders/providers/orders_provider.dart
git commit -m "feat(mobile): gate app on required survey state"
```

---

## Task 8: Required Mobile Survey Screen

**Files:**
- Create: `apps/mobile/lib/features/customer/profile/screens/required_tam_survey_screen.dart`
- Create: `apps/mobile/test/features/customer/profile/screens/required_tam_survey_screen_test.dart`

- [ ] **Step 1: Write forced screen widget tests**

Create `apps/mobile/test/features/customer/profile/screens/required_tam_survey_screen_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/features/customer/profile/screens/required_tam_survey_screen.dart';

class _FakeAccountStateNotifier extends AccountStateNotifier {
  _FakeAccountStateNotifier() {
    state = AccountState(
      status: AccountGateStatus.surveyRequired,
      holds: [
        SurveyRequirementHold(
          requirementId: 123,
          orderId: 55,
          orderRef: 'ORD-10055',
          requiredAt: DateTime.utc(2026, 4, 30, 12),
        ),
      ],
    );
  }

  @override
  Future<void> refresh() async {}
}

Widget _wrap() {
  return ProviderScope(
    overrides: [
      accountStateProvider.overrideWith((ref) => _FakeAccountStateNotifier()),
    ],
    child: const MaterialApp(home: RequiredTamSurveyScreen()),
  );
}

void main() {
  group('RequiredTamSurveyScreen', () {
    testWidgets('disables system pop', (tester) async {
      await tester.pumpWidget(_wrap());

      expect(
        find.byWidgetPredicate(
          (widget) => widget is PopScope<dynamic> && widget.canPop == false,
        ),
        findsOneWidget,
      );
    });

    testWidgets('keeps Next disabled until the current question is answered',
        (tester) async {
      await tester.pumpWidget(_wrap());

      var nextButton =
          tester.widget<ElevatedButton>(find.widgetWithText(ElevatedButton, 'Next'));
      expect(nextButton.onPressed, isNull);

      await tester.tap(find.text('Agree'));
      await tester.pump();

      nextButton =
          tester.widget<ElevatedButton>(find.widgetWithText(ElevatedButton, 'Next'));
      expect(nextButton.onPressed, isNotNull);
    });
  });
}
```

- [ ] **Step 2: Run failing widget test**

Run:

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/features/customer/profile/screens/required_tam_survey_screen_test.dart
```

Expected: fail because `required_tam_survey_screen.dart` does not exist.

- [ ] **Step 3: Create required screen**

Create `apps/mobile/lib/features/customer/profile/screens/required_tam_survey_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';

class RequiredTamSurveyScreen extends ConsumerStatefulWidget {
  const RequiredTamSurveyScreen({super.key});

  @override
  ConsumerState<RequiredTamSurveyScreen> createState() =>
      _RequiredTamSurveyScreenState();
}

class _RequiredTamSurveyScreenState
    extends ConsumerState<RequiredTamSurveyScreen> {
  final PageController _controller = PageController();
  final Map<int, int> _answers = {};
  final TextEditingController _featureController = TextEditingController();
  final TextEditingController _deliveryController = TextEditingController();
  int _page = 0;
  bool _submitting = false;
  bool _submitted = false;

  static const _questions = [
    'GRID allows me to manage my printing tasks more efficiently.',
    'Using GRID simplifies my entire printing process.',
    'It was easy to learn how to use the GRID app.',
    'I find the GRID app intuitive and easy to navigate.',
    'I intend to continue using GRID for my printing needs.',
    'I would recommend GRID to my peers or colleagues.',
    'Accuracy of the prints received compared to your digital order.',
    'Physical condition of the prints (no damage, clean finish).',
    'Speed and punctuality of the delivery/pickup readiness.',
    'Clarity of the status updates.',
    'The delivery/pickup system fits my schedule perfectly.',
    'Color accuracy and resolution of the final product.',
    'The weight and feel of the paper/media used.',
    'Performance of the app.',
  ];

  static const _labels = [
    'Strongly Disagree',
    'Disagree',
    'Neutral',
    'Agree',
    'Strongly Agree',
  ];

  @override
  void dispose() {
    _controller.dispose();
    _featureController.dispose();
    _deliveryController.dispose();
    super.dispose();
  }

  Future<void> _next() async {
    HapticFeedback.selectionClick();
    if (_page < _questions.length) {
      await _controller.nextPage(
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
      );
    } else {
      await _submit();
    }
  }

  Future<void> _submit() async {
    final hold = ref.read(accountStateProvider).requiredSurveyHold;
    if (hold == null || _answers.length != _questions.length) return;

    setState(() => _submitting = true);
    try {
      await ApiClient.instance.post(
        '/tam-surveys/requirements/${hold.requirementId}/submit',
        data: {
          'surveyData': {
            for (final entry in _answers.entries)
              entry.key.toString(): entry.value,
          },
          'openForumFeedback': {
            'feature': _featureController.text.trim(),
            'delivery': _deliveryController.text.trim(),
          },
        },
      );
      if (!mounted) return;
      setState(() {
        _submitted = true;
        _submitting = false;
      });
      await Future.delayed(const Duration(milliseconds: 1300));
      await ref.read(authProvider.notifier).logout();
      if (mounted) context.go('/auth/login');
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to submit survey. Please retry.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final hold = ref.watch(accountStateProvider).requiredSurveyHold;

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: colors.background,
        body: SafeArea(
          child: _submitted
              ? _ThankYou(colors: colors)
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.xl,
                        AppSpacing.lg,
                        AppSpacing.xl,
                        AppSpacing.sm,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Beta Feedback',
                            style: AppTypography.h1
                                .copyWith(color: colors.onBackground),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            hold == null
                                ? 'Please complete this short survey.'
                                : 'Order ${hold.orderRef} is complete. Please answer before leaving beta.',
                            style: AppTypography.body
                                .copyWith(color: colors.onSurfaceDim),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          LinearProgressIndicator(
                            value: (_page + 1) / (_questions.length + 1),
                            minHeight: 6,
                            backgroundColor: colors.outlineVariant,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(colors.accent),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: PageView.builder(
                        controller: _controller,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _questions.length + 1,
                        onPageChanged: (value) => setState(() => _page = value),
                        itemBuilder: (context, index) {
                          if (index == _questions.length) {
                            return _OpenFeedbackPage(
                              colors: colors,
                              featureController: _featureController,
                              deliveryController: _deliveryController,
                            );
                          }
                          return _QuestionPage(
                            colors: colors,
                            number: index + 1,
                            total: _questions.length,
                            question: _questions[index],
                            selected: _answers[index],
                            labels: _labels,
                            onChanged: (value) {
                              setState(() => _answers[index] = value);
                            },
                          );
                        },
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.xl,
                        AppSpacing.sm,
                        AppSpacing.xl,
                        AppSpacing.xl,
                      ),
                      child: SizedBox(
                        width: double.infinity,
                        height: 54,
                        child: ElevatedButton(
                          onPressed: _submitting ||
                                  (_page < _questions.length &&
                                      _answers[_page] == null)
                              ? null
                              : _next,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: colors.accent,
                            foregroundColor: colors.accentOnColor,
                            disabledBackgroundColor: colors.surfaceVariant,
                          ),
                          child: _submitting
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : Text(
                                  _page == _questions.length
                                      ? 'Submit Feedback'
                                      : 'Next',
                                  style: AppTypography.button,
                                ),
                        ),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

class _QuestionPage extends StatelessWidget {
  const _QuestionPage({
    required this.colors,
    required this.number,
    required this.total,
    required this.question,
    required this.selected,
    required this.labels,
    required this.onChanged,
  });

  final AppColorSet colors;
  final int number;
  final int total;
  final String question;
  final int? selected;
  final List<String> labels;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      children: [
        Text(
          'Question $number of $total',
          style: AppTypography.overline.copyWith(color: colors.onSurfaceDim),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          question,
          style: AppTypography.h2.copyWith(color: colors.onBackground),
        ),
        const SizedBox(height: AppSpacing.xl),
        for (int i = 0; i < labels.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: _AnswerTile(
              colors: colors,
              label: labels[i],
              selected: selected == i,
              onTap: () => onChanged(i),
            ),
          ),
      ],
    );
  }
}

class _AnswerTile extends StatelessWidget {
  const _AnswerTile({
    required this.colors,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final AppColorSet colors;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: selected ? colors.accent : colors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? colors.accent : colors.outline,
          ),
        ),
        child: Text(
          label,
          style: AppTypography.bodyBold.copyWith(
            color: selected ? colors.accentOnColor : colors.onSurface,
          ),
        ),
      ),
    );
  }
}

class _OpenFeedbackPage extends StatelessWidget {
  const _OpenFeedbackPage({
    required this.colors,
    required this.featureController,
    required this.deliveryController,
  });

  final AppColorSet colors;
  final TextEditingController featureController;
  final TextEditingController deliveryController;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      children: [
        Text(
          'Additional Feedback',
          style: AppTypography.h2.copyWith(color: colors.onBackground),
        ),
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: featureController,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'What feature or service should GRID add?',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        TextField(
          controller: deliveryController,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Any comments about your order experience?',
            border: OutlineInputBorder(),
          ),
        ),
      ],
    );
  }
}

class _ThankYou extends StatelessWidget {
  const _ThankYou({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_rounded, color: colors.success, size: 72),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Thank You',
              style: AppTypography.h1.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Your beta feedback was submitted. You will be logged out now.',
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Analyze required survey screen**

Run:

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze lib/features/customer/profile/screens/required_tam_survey_screen.dart
```

Expected: no errors.

- [ ] **Step 5: Run mobile focused tests**

Run:

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test \
  test/features/customer/profile/account_state_test.dart \
  test/features/customer/profile/screens/required_tam_survey_screen_test.dart
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/features/customer/profile/screens/required_tam_survey_screen.dart \
        apps/mobile/test/features/customer/profile/screens/required_tam_survey_screen_test.dart
git commit -m "feat(mobile): add required beta survey screen"
```

---

## Task 9: Admin Survey Order Metadata

**Files:**
- Modify: `admin/src/pages/tam-surveys/list.tsx`
- Modify: `admin/src/pages/tam-surveys/show.tsx`

- [ ] **Step 1: Add list column**

In `admin/src/pages/tam-surveys/list.tsx`, after the Customer column, add:

```tsx
        <Table.Column
          title="Order"
          dataIndex="order_ref"
          width={130}
          render={(v) =>
            v ? (
              <Tag color="blue" style={{ fontFamily: "monospace" }}>
                {v}
              </Tag>
            ) : (
              <Tag>Voluntary</Tag>
            )
          }
        />
```

Increase table scroll:

```tsx
scroll={{ x: 930 }}
```

- [ ] **Step 2: Add detail metadata**

In `admin/src/pages/tam-surveys/show.tsx`, in Customer Details after Submitted On, add:

```tsx
          {data.order_ref && (
            <>
              <Text type="secondary" style={{ marginTop: 8 }}>Linked Order</Text>
              <Tag color="blue" style={{ width: "fit-content", fontFamily: "monospace" }}>
                {data.order_ref}
              </Tag>
            </>
          )}
```

- [ ] **Step 3: Run admin build**

Run:

```bash
cd admin && npm run build
```

Expected: TypeScript and Vite build succeed.

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/tam-surveys/list.tsx \
        admin/src/pages/tam-surveys/show.tsx
git commit -m "feat(admin): show linked order on surveys"
```

---

## Task 10: End-to-End Verification

**Files:**
- No new files.

- [ ] **Step 1: Run backend focused tests**

Run:

```bash
cd server && npx jest tam-surveys/tam-surveys.service.spec orders/orders.service.spec auth/auth.service.spec auth/strategies/jwt.strategy.spec users/users.controller.spec --runInBand --no-coverage
```

Expected: PASS.

- [ ] **Step 2: Run backend full test suite**

Run:

```bash
cd server && npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run mobile tests**

Run:

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test
```

Expected: PASS.

- [ ] **Step 4: Run mobile analyzer**

Run:

```bash
cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter analyze
```

Expected: no errors.

- [ ] **Step 5: Run admin tests and build**

Run:

```bash
cd admin && npm test && npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 6: Manual backend smoke path**

With server running and seeded beta user:

1. Admin marks a beta user's order `delivered` or `completed_pickup`.
2. Confirm `GET /api/users/me/account-state` as that user returns `survey_required`.
3. Submit `POST /api/tam-surveys/requirements/:id/submit` with 14 answers.
4. Confirm login for that user fails with `Beta testing completed. Your account will reopen at full release.`
