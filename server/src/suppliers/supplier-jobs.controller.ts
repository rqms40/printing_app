import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import type { TransitionActor } from '../orders/order-status-transition';
import { AcceptSupplierJobDto } from './dto/accept-supplier-job.dto';
import { DeclineSupplierJobDto } from './dto/decline-supplier-job.dto';
import { ProductionStatusDto } from './dto/production-status.dto';
import { SelfQcDto } from './dto/self-qc.dto';
import { SupplierJobsService } from './supplier-jobs.service';

const SELF_QC_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const;

/**
 * Supplier-facing job APIs (Task 5.1).
 * Role: supplier only. Job id = SupplierAssignment id (own assignment only).
 */
@ApiTags('supplier-jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPPLIER)
@Controller('supplier/jobs')
export class SupplierJobsController {
  constructor(private readonly supplierJobsService: SupplierJobsService) {}

  /** Assigned / accepted / in-production job inbox. */
  @Get()
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['assigned', 'accepted', 'in_production', 'all'],
    description: 'Job list filter (default: all active)',
  })
  listJobs(@Request() req: RequestWithUser, @Query('filter') filter?: string) {
    return this.supplierJobsService.listJobs(
      {
        userId: req.user.sub,
        role: req.user.role as TransitionActor,
      },
      filter,
    );
  }

  /** Job detail: approved artwork + specs only (no pre-QA files). */
  @Get(':id')
  getJob(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.supplierJobsService.getJob(
      id,
      {
        userId: req.user.sub,
        role: req.user.role as TransitionActor,
      },
      req.hostname,
    );
  }

  /** Accept with final price + promised date → supplier_accepted. */
  @Post(':id/accept')
  accept(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AcceptSupplierJobDto,
    @Request() req: RequestWithUser,
  ) {
    return this.supplierJobsService.acceptJob(id, dto, {
      userId: req.user.sub,
      role: req.user.role as TransitionActor,
    });
  }

  /** Decline → re-queue order to approved_for_matching. */
  @Post(':id/decline')
  decline(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeclineSupplierJobDto,
    @Request() req: RequestWithUser,
  ) {
    return this.supplierJobsService.declineJob(id, dto, {
      userId: req.user.sub,
      role: req.user.role as TransitionActor,
    });
  }

  /** Production milestone updates (requires payment authorization). */
  @Post(':id/production-status')
  productionStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProductionStatusDto,
    @Request() req: RequestWithUser,
  ) {
    return this.supplierJobsService.updateProductionStatus(id, dto, {
      userId: req.user.sub,
      role: req.user.role as TransitionActor,
    });
  }

  /**
   * Self-QC with evidence.
   * Accepts JSON `{ evidenceFileIds }` or multipart (file + fields).
   */
  @Post(':id/self-qc')
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: SelfQcDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (
          SELF_QC_IMAGE_MIME_TYPES.includes(
            file.mimetype as (typeof SELF_QC_IMAGE_MIME_TYPES)[number],
          )
        ) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Unsupported self-QC file type: ${file.mimetype}`,
            ),
            false,
          );
        }
      },
    }),
  )
  selfQc(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SelfQcDto,
    @Request() req: RequestWithUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.supplierJobsService.submitSelfQc(
      id,
      dto ?? {},
      {
        userId: req.user.sub,
        role: req.user.role as TransitionActor,
      },
      file,
    );
  }

  /** supplier_self_qc → ready_for_dispatch. */
  @Post(':id/ready-for-pickup')
  readyForPickup(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.supplierJobsService.readyForPickup(id, {
      userId: req.user.sub,
      role: req.user.role as TransitionActor,
    });
  }
}
