# File Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file analysis (dimensions, color space, CMYK/RGB), paper-size mismatch validation, per-user print mode preferences (fit-to-paper / actual size), enhanced file preview with local PDF rendering, and a floating ruler overlay — across server, admin, and mobile.

**Architecture:** Server gains a `FileAnalysisService` using `sharp` (images) and `pdf-lib` (PDFs) that runs at upload time and stores results in new `FileMetadata` columns. A `PaperSizeValidator` service compares those dimensions against the order's `paperSize`. User entity gets a `defaultPrintMode` preference; `PaperSpec` gets a `printMode` field. Admin `OrderShow` gains a file preview modal and inspection card. Mobile upgrades to `pdfx` for web-compatible PDF preview, shows inspection results in the order flow, and gains a floating ruler overlay in `FilePreviewSheet`.

**Tech Stack:** NestJS + TypeORM + sharp + pdf-lib (server) · React + Ant Design (admin) · Flutter + Riverpod + pdfx (mobile)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server/src/files/file-analysis.service.ts` | Create | Extract dimensions + color space from buffer |
| `server/src/files/file-analysis.service.spec.ts` | Create | Unit tests for analysis |
| `server/src/files/entities/file-metadata.entity.ts` | Modify | Add widthPt, heightPt, widthPx, heightPx, colorSpace, pageCount, dpi |
| `server/src/files/files.service.ts` | Modify | Call FileAnalysisService in storeMetadata() |
| `server/src/files/files.module.ts` | Modify | Register FileAnalysisService |
| `server/src/files/paper-size-validator.service.ts` | Create | Paper size table + validation logic |
| `server/src/files/paper-size-validator.service.spec.ts` | Create | Tests for validation |
| `server/src/files/dto/file-inspection.dto.ts` | Create | Response DTO with inspection results |
| `server/src/orders/entities/paper-specs.entity.ts` | Modify | Add printMode column |
| `server/src/orders/dto/create-order.dto.ts` | Modify | Add printMode to PaperSpecsDto |
| `server/src/users/entities/user.entity.ts` | Modify | Add defaultPrintMode column |
| `server/src/users/dto/update-profile.dto.ts` | Modify | Add defaultPrintMode field |
| `admin/src/pages/orders/show.tsx` | Modify | File preview modal + inspection card |
| `admin/src/components/FilePreviewModal.tsx` | Create | Reusable file preview (image/PDF iframe) + ruler |
| `apps/mobile/pubspec.yaml` | Modify | Add pdfx package |
| `apps/mobile/lib/shared/widgets/file_preview_sheet.dart` | Modify | Replace syncfusion with pdfx, add ruler overlay |
| `apps/mobile/lib/shared/widgets/ruler_overlay.dart` | Create | Floating ruler widget |
| `apps/mobile/lib/shared/models/uploaded_file.dart` | Modify | Add analysis fields |
| `apps/mobile/lib/features/customer/order/screens/upload_screen.dart` | Modify | Local PDF preview + inspection warning |
| `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart` | Modify | Add defaultPrintMode preference UI |

---

## Section 1 — Server: File Analysis Engine

### Task 1: Install dependencies + create FileAnalysisService

**Files:**
- Create: `server/src/files/file-analysis.service.ts`
- Create: `server/src/files/file-analysis.service.spec.ts`

- [ ] **Step 1: Install packages**

  ```bash
  cd server && npm install sharp pdf-lib && npm install --save-dev @types/sharp
  ```

  Expected: `sharp` and `pdf-lib` appear in `package.json` dependencies.

- [ ] **Step 2: Write the failing tests**

  Create `server/src/files/file-analysis.service.spec.ts`:

  ```typescript
  import { FileAnalysisService } from './file-analysis.service';

  describe('FileAnalysisService', () => {
    let service: FileAnalysisService;

    beforeEach(() => {
      service = new FileAnalysisService();
    });

    it('returns null result for unsupported mime type', async () => {
      const result = await service.analyze(Buffer.from('hello'), 'text/plain');
      expect(result).toBeNull();
    });

    it('returns null gracefully when buffer is corrupt', async () => {
      const result = await service.analyze(Buffer.from('not-a-pdf'), 'application/pdf');
      expect(result).toBeNull();
    });

    it('returns null gracefully when image buffer is corrupt', async () => {
      const result = await service.analyze(Buffer.from('not-an-image'), 'image/jpeg');
      expect(result).toBeNull();
    });
  });
  ```

- [ ] **Step 3: Run test to confirm it fails**

  ```bash
  cd server && npx jest file-analysis.service --no-coverage
  ```

  Expected: FAIL — `FileAnalysisService` not found.

- [ ] **Step 4: Implement FileAnalysisService**

  Create `server/src/files/file-analysis.service.ts`:

  ```typescript
  import { Injectable } from '@nestjs/common';
  import { PDFDocument } from 'pdf-lib';
  import sharp from 'sharp';

  export interface FileAnalysisResult {
    widthPt: number | null;   // PDF points (72pt = 1 inch)
    heightPt: number | null;
    widthPx: number | null;   // Image pixels
    heightPx: number | null;
    colorSpace: string | null; // 'srgb' | 'cmyk' | 'rgb' | 'b-w' | 'unknown'
    pageCount: number | null;
    dpi: number | null;
  }

  @Injectable()
  export class FileAnalysisService {
    async analyze(
      buffer: Buffer,
      mimeType: string,
    ): Promise<FileAnalysisResult | null> {
      try {
        if (mimeType === 'application/pdf') return this.analyzePdf(buffer);
        if (mimeType.startsWith('image/')) return this.analyzeImage(buffer);
        return null;
      } catch {
        return null;
      }
    }

    private async analyzePdf(buffer: Buffer): Promise<FileAnalysisResult | null> {
      try {
        const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const page = pdf.getPage(0);
        const { width, height } = page.getSize();
        const hasCmyk = buffer.toString('latin1').includes('/DeviceCMYK');
        return {
          widthPt: width,
          heightPt: height,
          widthPx: null,
          heightPx: null,
          colorSpace: hasCmyk ? 'cmyk' : 'rgb',
          pageCount: pdf.getPageCount(),
          dpi: null,
        };
      } catch {
        return null;
      }
    }

    private async analyzeImage(buffer: Buffer): Promise<FileAnalysisResult | null> {
      try {
        const meta = await sharp(buffer).metadata();
        return {
          widthPt: null,
          heightPt: null,
          widthPx: meta.width ?? null,
          heightPx: meta.height ?? null,
          colorSpace: meta.space ?? null,
          pageCount: null,
          dpi: meta.density ?? null,
        };
      } catch {
        return null;
      }
    }
  }
  ```

- [ ] **Step 5: Run tests**

  ```bash
  cd server && npx jest file-analysis.service --no-coverage
  ```

  Expected: 3 tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add server/src/files/file-analysis.service.ts server/src/files/file-analysis.service.spec.ts server/package.json server/package-lock.json
  git commit -m "feat(server): add FileAnalysisService with sharp + pdf-lib"
  ```

---

### Task 2: Add analysis columns to FileMetadata entity

**Files:**
- Modify: `server/src/files/entities/file-metadata.entity.ts`

- [ ] **Step 1: Add columns**

  Open `server/src/files/entities/file-metadata.entity.ts`. After the `size` column and before the `url` column, add:

  ```typescript
  @Column({ name: 'width_pt', type: 'decimal', precision: 10, scale: 3, nullable: true })
  widthPt: number | null;

  @Column({ name: 'height_pt', type: 'decimal', precision: 10, scale: 3, nullable: true })
  heightPt: number | null;

  @Column({ name: 'width_px', type: 'integer', nullable: true })
  widthPx: number | null;

  @Column({ name: 'height_px', type: 'integer', nullable: true })
  heightPx: number | null;

  @Column({ name: 'color_space', type: 'varchar', length: 20, nullable: true })
  colorSpace: string | null;

  @Column({ name: 'page_count', type: 'integer', nullable: true })
  pageCount: number | null;

  @Column({ name: 'dpi', type: 'integer', nullable: true })
  dpi: number | null;
  ```

  > `synchronize: true` in dev auto-creates these columns — no migration file needed.

- [ ] **Step 2: Run server tests to confirm no regressions**

  ```bash
  cd server && npx jest --no-coverage 2>&1 | tail -5
  ```

  Expected: all existing tests pass.

- [ ] **Step 3: Commit**

  ```bash
  git add server/src/files/entities/file-metadata.entity.ts
  git commit -m "feat(server): add dimension and color space columns to FileMetadata"
  ```

---

### Task 3: Wire FileAnalysisService into storeMetadata

**Files:**
- Modify: `server/src/files/files.service.ts`
- Modify: `server/src/files/files.module.ts`

- [ ] **Step 1: Register FileAnalysisService in FilesModule**

  Open `server/src/files/files.module.ts`. Add `FileAnalysisService` to providers:

  ```typescript
  import { FileAnalysisService } from './file-analysis.service';

  @Module({
    // ...existing...
    providers: [FilesService, FileAnalysisService],
  })
  export class FilesModule {}
  ```

- [ ] **Step 2: Inject and call in FilesService.storeMetadata()**

  Open `server/src/files/files.service.ts`. Inject `FileAnalysisService`:

  ```typescript
  import { FileAnalysisService } from './file-analysis.service';

  @Injectable()
  export class FilesService {
    constructor(
      @InjectRepository(FileMetadata)
      private readonly repo: Repository<FileMetadata>,
      private readonly storageService: StorageService,
      private readonly analysisService: FileAnalysisService,
    ) {}
  ```

  In `storeMetadata()`, after the MinIO upload succeeds and before `repo.save()`, add:

  ```typescript
  const analysis = await this.analysisService.analyze(file.buffer, file.mimetype);

  const metadata = this.repo.create({
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url,
    objectKey,
    uploadedBy,
    widthPt: analysis?.widthPt ?? null,
    heightPt: analysis?.heightPt ?? null,
    widthPx: analysis?.widthPx ?? null,
    heightPx: analysis?.heightPx ?? null,
    colorSpace: analysis?.colorSpace ?? null,
    pageCount: analysis?.pageCount ?? null,
    dpi: analysis?.dpi ?? null,
  });
  ```

- [ ] **Step 3: Run full server tests**

  ```bash
  cd server && npx jest --no-coverage 2>&1 | tail -5
  ```

  Expected: all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add server/src/files/files.service.ts server/src/files/files.module.ts
  git commit -m "feat(server): wire FileAnalysisService into storeMetadata upload flow"
  ```

---

## Section 2 — Server: Paper Size Validator

### Task 4: Create PaperSizeValidatorService

**Files:**
- Create: `server/src/files/paper-size-validator.service.ts`
- Create: `server/src/files/paper-size-validator.service.spec.ts`
- Create: `server/src/files/dto/file-inspection.dto.ts`

- [ ] **Step 1: Create response DTO**

  Create `server/src/files/dto/file-inspection.dto.ts`:

  ```typescript
  export type SizeValidationStatus = 'match' | 'mismatch' | 'unknown';

  export class SizeValidationResult {
    status: SizeValidationStatus;
    orientation?: 'portrait' | 'landscape';
    fileSizeMm?: string;         // e.g. "210×297mm"
    expectedSizeMm?: string;     // e.g. "210×297mm (A4)"
    message?: string;
  }

  export class FileInspectionDto {
    mimeType: string;
    widthMm: number | null;
    heightMm: number | null;
    widthPx: number | null;
    heightPx: number | null;
    colorSpace: string | null;
    pageCount: number | null;
    dpi: number | null;
    sizeValidation: SizeValidationResult | null;
  }
  ```

- [ ] **Step 2: Write failing tests**

  Create `server/src/files/paper-size-validator.service.spec.ts`:

  ```typescript
  import { PaperSizeValidatorService } from './paper-size-validator.service';

  describe('PaperSizeValidatorService', () => {
    let service: PaperSizeValidatorService;

    beforeEach(() => {
      service = new PaperSizeValidatorService();
    });

    it('returns match for A4 PDF (595×842pt)', () => {
      // 595pt × 842pt = ~210mm × 297mm = A4
      const result = service.validate({ widthPt: 595, heightPt: 842 }, 'A4');
      expect(result.status).toBe('match');
      expect(result.orientation).toBe('portrait');
    });

    it('returns match for landscape A4 (842×595pt)', () => {
      const result = service.validate({ widthPt: 842, heightPt: 595 }, 'A4');
      expect(result.status).toBe('match');
      expect(result.orientation).toBe('landscape');
    });

    it('returns mismatch for A3 PDF against A4 paper size', () => {
      // A3 = 842×1191pt
      const result = service.validate({ widthPt: 842, heightPt: 1191 }, 'A4');
      expect(result.status).toBe('mismatch');
      expect(result.fileSizeMm).toContain('297');
    });

    it('returns unknown when no dimensions available', () => {
      const result = service.validate({ widthPt: null, heightPt: null }, 'A4');
      expect(result.status).toBe('unknown');
    });

    it('returns unknown for unrecognised paper size string', () => {
      const result = service.validate({ widthPt: 595, heightPt: 842 }, 'CUSTOM_WEIRD');
      expect(result.status).toBe('unknown');
    });

    it('validates image dimensions via dpi + px', () => {
      // 2480px × 3508px at 300dpi = A4
      const result = service.validate(
        { widthPx: 2480, heightPx: 3508, dpi: 300 },
        'A4',
      );
      expect(result.status).toBe('match');
    });
  });
  ```

- [ ] **Step 3: Run test to confirm failure**

  ```bash
  cd server && npx jest paper-size-validator --no-coverage
  ```

  Expected: FAIL — module not found.

- [ ] **Step 4: Implement PaperSizeValidatorService**

  Create `server/src/files/paper-size-validator.service.ts`:

  ```typescript
  import { Injectable } from '@nestjs/common';
  import { SizeValidationResult } from './dto/file-inspection.dto';

  const PT_TO_MM = 25.4 / 72;
  const TOLERANCE_MM = 5;

  const PAPER_SIZES_MM: Record<string, { width: number; height: number }> = {
    A1:     { width: 594,  height: 841  },
    A2:     { width: 420,  height: 594  },
    A3:     { width: 297,  height: 420  },
    A4:     { width: 210,  height: 297  },
    A5:     { width: 148,  height: 210  },
    LETTER: { width: 216,  height: 279  },
    LEGAL:  { width: 216,  height: 356  },
  };

  interface DimensionInput {
    widthPt?: number | null;
    heightPt?: number | null;
    widthPx?: number | null;
    heightPx?: number | null;
    dpi?: number | null;
  }

  @Injectable()
  export class PaperSizeValidatorService {
    validate(dims: DimensionInput, paperSize: string): SizeValidationResult {
      const target = PAPER_SIZES_MM[paperSize.toUpperCase()];
      if (!target) return { status: 'unknown', message: `Unknown paper size: ${paperSize}` };

      const { wMm, hMm } = this.toMm(dims);
      if (wMm === null || hMm === null) {
        return { status: 'unknown', message: 'File dimensions unavailable' };
      }

      const within = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE_MM;
      const portrait  = within(wMm, target.width)  && within(hMm, target.height);
      const landscape = within(wMm, target.height) && within(hMm, target.width);

      if (portrait || landscape) {
        return { status: 'match', orientation: landscape ? 'landscape' : 'portrait' };
      }

      return {
        status: 'mismatch',
        fileSizeMm: `${Math.round(wMm)}×${Math.round(hMm)}mm`,
        expectedSizeMm: `${target.width}×${target.height}mm (${paperSize.toUpperCase()})`,
        message: `File is ${Math.round(wMm)}×${Math.round(hMm)}mm, expected ${paperSize.toUpperCase()} (${target.width}×${target.height}mm)`,
      };
    }

    private toMm(dims: DimensionInput): { wMm: number | null; hMm: number | null } {
      if (dims.widthPt && dims.heightPt) {
        return { wMm: dims.widthPt * PT_TO_MM, hMm: dims.heightPt * PT_TO_MM };
      }
      if (dims.widthPx && dims.heightPx && dims.dpi && dims.dpi > 0) {
        return {
          wMm: (dims.widthPx / dims.dpi) * 25.4,
          hMm: (dims.heightPx / dims.dpi) * 25.4,
        };
      }
      return { wMm: null, hMm: null };
    }
  }
  ```

- [ ] **Step 5: Run tests**

  ```bash
  cd server && npx jest paper-size-validator --no-coverage
  ```

  Expected: 6 tests pass.

- [ ] **Step 6: Register service in FilesModule**

  Open `server/src/files/files.module.ts`. Add `PaperSizeValidatorService` to providers and exports:

  ```typescript
  import { PaperSizeValidatorService } from './paper-size-validator.service';

  @Module({
    providers: [FilesService, FileAnalysisService, PaperSizeValidatorService],
    exports: [FilesService, PaperSizeValidatorService],
  })
  export class FilesModule {}
  ```

- [ ] **Step 7: Expose inspection on GET /files/:id**

  In `server/src/files/files.controller.ts`, add a new endpoint:

  ```typescript
  import { PaperSizeValidatorService } from './paper-size-validator.service';
  import { FileInspectionDto } from './dto/file-inspection.dto';

  // Inject PaperSizeValidatorService in constructor

  @Get(':id/inspect')
  @UseGuards(JwtAuthGuard)
  async inspect(
    @Param('id', ParseIntPipe) id: number,
    @Query('paperSize') paperSize?: string,
  ): Promise<FileInspectionDto> {
    const file = await this.filesService.findById(id);
    const PT_TO_MM = 25.4 / 72;
    const widthMm = file.widthPt ? file.widthPt * PT_TO_MM : null;
    const heightMm = file.heightPt ? file.heightPt * PT_TO_MM : null;
    return {
      mimeType: file.mimeType,
      widthMm,
      heightMm,
      widthPx: file.widthPx,
      heightPx: file.heightPx,
      colorSpace: file.colorSpace,
      pageCount: file.pageCount,
      dpi: file.dpi,
      sizeValidation: paperSize
        ? this.validator.validate(
            { widthPt: file.widthPt, heightPt: file.heightPt, widthPx: file.widthPx, heightPx: file.heightPx, dpi: file.dpi },
            paperSize,
          )
        : null,
    };
  }
  ```

- [ ] **Step 8: Run all server tests**

  ```bash
  cd server && npx jest --no-coverage 2>&1 | tail -5
  ```

  Expected: all tests pass.

- [ ] **Step 9: Commit**

  ```bash
  git add server/src/files/
  git commit -m "feat(server): add PaperSizeValidatorService and GET /files/:id/inspect endpoint"
  ```

---

## Section 3 — Server: Print Mode Preferences

### Task 5: Add print mode to User and PaperSpec

**Files:**
- Modify: `server/src/users/entities/user.entity.ts`
- Modify: `server/src/users/dto/update-profile.dto.ts`
- Modify: `server/src/orders/entities/paper-specs.entity.ts`
- Modify: `server/src/orders/dto/create-order.dto.ts`

- [ ] **Step 1: Add defaultPrintMode to User entity**

  Open `server/src/users/entities/user.entity.ts`. After the `fileRetentionDays` column, add:

  ```typescript
  @Column({ name: 'default_print_mode', type: 'varchar', length: 20, nullable: true, default: 'fitToPage' })
  defaultPrintMode: 'fitToPage' | 'actualSize' | null;
  ```

- [ ] **Step 2: Add to UpdateProfileDto**

  Open `server/src/users/dto/update-profile.dto.ts`. Add:

  ```typescript
  @ApiPropertyOptional({ enum: ['fitToPage', 'actualSize'] })
  @IsOptional()
  @IsIn(['fitToPage', 'actualSize'])
  defaultPrintMode?: 'fitToPage' | 'actualSize';
  ```

- [ ] **Step 3: Add printMode to PaperSpec entity**

  Open `server/src/orders/entities/paper-specs.entity.ts`. Add after `binding`:

  ```typescript
  @Column({ name: 'print_mode', length: 20, nullable: true, default: 'fitToPage' })
  printMode: string | null;
  ```

- [ ] **Step 4: Add printMode to PaperSpecsDto**

  Open `server/src/orders/dto/create-order.dto.ts`. Add to `PaperSpecsDto`:

  ```typescript
  @IsOptional()
  @IsIn(['fitToPage', 'actualSize'])
  printMode?: 'fitToPage' | 'actualSize';
  ```

  In `OrdersService.create()`, wire it through when building the `PaperSpec`:
  ```typescript
  // where paper spec is created, add:
  printMode: dto.paperSpecs?.printMode ?? 'fitToPage',
  ```

- [ ] **Step 5: Run server tests**

  ```bash
  cd server && npx jest --no-coverage 2>&1 | tail -5
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add server/src/users/entities/user.entity.ts server/src/users/dto/update-profile.dto.ts \
          server/src/orders/entities/paper-specs.entity.ts server/src/orders/dto/create-order.dto.ts
  git commit -m "feat(server): add defaultPrintMode to User and printMode to PaperSpec"
  ```

---

## Section 4 — Admin UI: File Preview + Inspection

### Task 6: File preview modal with inspection card in OrderShow

**Files:**
- Create: `admin/src/components/FilePreviewModal.tsx`
- Modify: `admin/src/pages/orders/show.tsx`

- [ ] **Step 1: Write test for FilePreviewModal**

  Create `admin/src/components/FilePreviewModal.test.tsx`:

  ```typescript
  import { render, screen } from '@testing-library/react';
  import { FilePreviewModal } from './FilePreviewModal';

  describe('FilePreviewModal', () => {
    it('renders image preview when mimeType is image/jpeg', () => {
      render(
        <FilePreviewModal
          open
          onClose={() => {}}
          fileName="photo.jpg"
          fileUrl="https://example.com/photo.jpg"
          mimeType="image/jpeg"
        />,
      );
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('renders iframe for PDF files', () => {
      render(
        <FilePreviewModal
          open
          onClose={() => {}}
          fileName="doc.pdf"
          fileUrl="https://example.com/doc.pdf"
          mimeType="application/pdf"
        />,
      );
      expect(document.querySelector('iframe')).toBeInTheDocument();
    });

    it('shows CMYK warning badge when colorSpace is cmyk', () => {
      render(
        <FilePreviewModal
          open
          onClose={() => {}}
          fileName="print.pdf"
          fileUrl="https://example.com/print.pdf"
          mimeType="application/pdf"
          inspection={{ colorSpace: 'cmyk', widthMm: 210, heightMm: 297, pageCount: 1, dpi: null, widthPx: null, heightPx: null, mimeType: 'application/pdf', sizeValidation: null }}
        />,
      );
      expect(screen.getByText(/CMYK/i)).toBeInTheDocument();
    });

    it('shows size mismatch warning', () => {
      render(
        <FilePreviewModal
          open
          onClose={() => {}}
          fileName="wrong.pdf"
          fileUrl="https://example.com/wrong.pdf"
          mimeType="application/pdf"
          inspection={{
            colorSpace: 'rgb', widthMm: 297, heightMm: 420, pageCount: 1, dpi: null,
            widthPx: null, heightPx: null, mimeType: 'application/pdf',
            sizeValidation: { status: 'mismatch', fileSizeMm: '297×420mm', expectedSizeMm: '210×297mm (A4)', message: 'File is A3, expected A4' },
          }}
        />,
      );
      expect(screen.getByText(/mismatch/i)).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run test to confirm failure**

  ```bash
  cd admin && npx vitest run src/components/FilePreviewModal.test.tsx
  ```

  Expected: FAIL — component not found.

- [ ] **Step 3: Implement FilePreviewModal**

  Create `admin/src/components/FilePreviewModal.tsx`:

  ```typescript
  import { Modal, Tag, Alert, Descriptions, Button, Space, Tooltip } from 'antd';
  import {
    FileImageOutlined, FilePdfOutlined, RulerOutlined,
    ExclamationCircleOutlined, CheckCircleOutlined,
  } from '@ant-design/icons';
  import { useState } from 'react';

  interface SizeValidation {
    status: 'match' | 'mismatch' | 'unknown';
    fileSizeMm?: string;
    expectedSizeMm?: string;
    message?: string;
    orientation?: string;
  }

  interface FileInspection {
    mimeType: string;
    widthMm: number | null;
    heightMm: number | null;
    widthPx: number | null;
    heightPx: number | null;
    colorSpace: string | null;
    pageCount: number | null;
    dpi: number | null;
    sizeValidation: SizeValidation | null;
  }

  interface Props {
    open: boolean;
    onClose: () => void;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    inspection?: FileInspection | null;
  }

  export function FilePreviewModal({ open, onClose, fileName, fileUrl, mimeType, inspection }: Props) {
    const [showRuler, setShowRuler] = useState(false);
    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    const colorSpaceTag = () => {
      if (!inspection?.colorSpace) return null;
      const isCmyk = inspection.colorSpace === 'cmyk';
      return (
        <Tooltip title={isCmyk ? 'CMYK color space — optimized for print' : 'RGB color space — screen optimized, may shift when printed'}>
          <Tag color={isCmyk ? 'green' : 'orange'}>{inspection.colorSpace.toUpperCase()}</Tag>
        </Tooltip>
      );
    };

    return (
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={860}
        title={
          <Space>
            {isPdf ? <FilePdfOutlined /> : <FileImageOutlined />}
            {fileName}
            {colorSpaceTag()}
            {inspection?.pageCount && <Tag>{inspection.pageCount}p</Tag>}
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        {/* Size mismatch warning */}
        {inspection?.sizeValidation?.status === 'mismatch' && (
          <Alert
            type="warning"
            showIcon
            message={`Size mismatch: ${inspection.sizeValidation.message}`}
            style={{ borderRadius: 0 }}
          />
        )}
        {inspection?.sizeValidation?.status === 'match' && (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message={`Size matches ${inspection.sizeValidation.orientation ?? ''} — ${inspection.sizeValidation.orientation === 'landscape' ? 'landscape' : 'portrait'}`}
            style={{ borderRadius: 0 }}
          />
        )}

        {/* File preview area */}
        <div style={{ position: 'relative', background: '#1a1a1a', minHeight: 500 }}>
          {isImage && (
            <img
              src={fileUrl}
              alt={fileName}
              style={{ width: '100%', maxHeight: 600, objectFit: 'contain', display: 'block' }}
            />
          )}
          {isPdf && (
            <iframe
              src={fileUrl}
              title={fileName}
              style={{ width: '100%', height: 560, border: 'none', display: 'block' }}
            />
          )}
          {!isImage && !isPdf && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#888' }}>
              Preview not available for this file type
            </div>
          )}

          {/* Ruler overlay toggle */}
          {(isImage || isPdf) && (
            <Button
              size="small"
              icon={<RulerOutlined />}
              onClick={() => setShowRuler((v) => !v)}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: showRuler ? '#FFD700' : 'rgba(0,0,0,0.5)',
                borderColor: 'transparent',
                color: showRuler ? '#000' : '#fff',
              }}
            >
              Ruler
            </Button>
          )}

          {/* Ruler overlay */}
          {showRuler && inspection?.widthMm && inspection?.heightMm && (
            <div
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none',
                borderTop: '2px solid rgba(255,215,0,0.8)',
                borderLeft: '2px solid rgba(255,215,0,0.8)',
              }}
            >
              <span style={{
                position: 'absolute', top: 4, left: 8,
                background: 'rgba(0,0,0,0.7)', color: '#FFD700',
                fontSize: 11, padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace',
              }}>
                {Math.round(inspection.widthMm)}mm × {Math.round(inspection.heightMm)}mm
              </span>
            </div>
          )}
        </div>

        {/* Inspection metadata */}
        {inspection && (
          <Descriptions
            column={4}
            size="small"
            style={{ padding: '12px 16px', borderTop: '1px solid #2e2e2e' }}
          >
            {inspection.widthMm && (
              <Descriptions.Item label="Width">{Math.round(inspection.widthMm)}mm</Descriptions.Item>
            )}
            {inspection.heightMm && (
              <Descriptions.Item label="Height">{Math.round(inspection.heightMm)}mm</Descriptions.Item>
            )}
            {inspection.widthPx && (
              <Descriptions.Item label="Resolution">{inspection.widthPx}×{inspection.heightPx}px</Descriptions.Item>
            )}
            {inspection.dpi && (
              <Descriptions.Item label="DPI">{inspection.dpi}</Descriptions.Item>
            )}
            {inspection.pageCount && (
              <Descriptions.Item label="Pages">{inspection.pageCount}</Descriptions.Item>
            )}
            {inspection.colorSpace && (
              <Descriptions.Item label="Color Space">
                <Tag color={inspection.colorSpace === 'cmyk' ? 'green' : 'orange'}>
                  {inspection.colorSpace.toUpperCase()}
                </Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    );
  }
  ```

- [ ] **Step 4: Wire into OrderShow**

  Open `admin/src/pages/orders/show.tsx`.

  Add imports:
  ```typescript
  import { FilePreviewModal } from '@/components/FilePreviewModal';
  import { apiClient } from '@/providers/api-client';
  ```

  Add state near top of component:
  ```typescript
  const [previewFile, setPreviewFile] = useState<{
    url: string; name: string; mimeType: string; inspection: unknown;
  } | null>(null);
  ```

  Add `openPreview` helper:
  ```typescript
  const openPreview = async (fileUrl: string, fileName: string, mimeType: string, fileMetadataId?: number, paperSize?: string) => {
    let inspection = null;
    if (fileMetadataId) {
      try {
        const params = paperSize ? `?paperSize=${paperSize}` : '';
        const res = await apiClient.get(`/files/${fileMetadataId}/inspect${params}`);
        inspection = res.data;
      } catch { /* inspection is non-critical */ }
    }
    setPreviewFile({ url: fileUrl, name: fileName, mimeType, inspection });
  };
  ```

  In the Order Items table, make the filename a clickable button:
  ```typescript
  // In the items table columns, change filename cell to:
  <Button
    type="link"
    size="small"
    style={{ padding: 0 }}
    onClick={() => void openPreview(
      item.file_url ?? '',
      item.file_name ?? 'File',
      item.file_name?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      item.file_metadata_id,
      item.paper_specs?.paper_size,
    )}
  >
    {item.file_name ?? '—'}
  </Button>
  ```

  Add `FilePreviewModal` at the bottom of the JSX (before the closing fragment):
  ```tsx
  <FilePreviewModal
    open={!!previewFile}
    onClose={() => setPreviewFile(null)}
    fileName={previewFile?.name ?? ''}
    fileUrl={previewFile?.url ?? ''}
    mimeType={previewFile?.mimeType ?? ''}
    inspection={previewFile?.inspection as never}
  />
  ```

- [ ] **Step 5: Run admin tests**

  ```bash
  cd admin && npx vitest run 2>&1 | tail -5
  ```

  Expected: all tests pass including new FilePreviewModal tests.

- [ ] **Step 6: Commit**

  ```bash
  git add admin/src/components/FilePreviewModal.tsx admin/src/components/FilePreviewModal.test.tsx \
          admin/src/pages/orders/show.tsx
  git commit -m "feat(admin): add file preview modal with inspection card and ruler overlay"
  ```

---

## Section 5 — Mobile: PDF Preview Enhancement

### Task 7: Add pdfx, upgrade FilePreviewSheet to web-compatible PDF rendering

**Files:**
- Modify: `apps/mobile/pubspec.yaml`
- Modify: `apps/mobile/lib/shared/widgets/file_preview_sheet.dart`
- Create: `apps/mobile/lib/shared/widgets/ruler_overlay.dart`

- [ ] **Step 1: Add pdfx to pubspec**

  Open `apps/mobile/pubspec.yaml`. In the `dependencies:` section, add:

  ```yaml
  pdfx: ^2.8.0
  ```

  Run:

  ```bash
  cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter pub get
  ```

  Expected: resolves without conflicts.

- [ ] **Step 2: Create RulerOverlay widget**

  Create `apps/mobile/lib/shared/widgets/ruler_overlay.dart`:

  ```dart
  import 'package:flutter/material.dart';
  import 'package:printing_app/config/theme/app_colors.dart';
  import 'package:printing_app/config/theme/app_spacing.dart';

  class RulerOverlay extends StatelessWidget {
    const RulerOverlay({
      super.key,
      required this.widthMm,
      required this.heightMm,
    });

    final double widthMm;
    final double heightMm;

    @override
    Widget build(BuildContext context) {
      return IgnorePointer(
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(color: AppColors.brand.withValues(alpha: 0.8), width: 2),
              left: BorderSide(color: AppColors.brand.withValues(alpha: 0.8), width: 2),
            ),
          ),
          child: Align(
            alignment: Alignment.topLeft,
            child: Container(
              margin: const EdgeInsets.only(top: AppSpacing.xs, left: AppSpacing.sm),
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                '${widthMm.round()}mm × ${heightMm.round()}mm',
                style: TextStyle(
                  color: AppColors.brand,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      );
    }
  }
  ```

- [ ] **Step 3: Write failing widget test for RulerOverlay**

  Create `apps/mobile/test/shared/widgets/ruler_overlay_test.dart`:

  ```dart
  import 'package:flutter/material.dart';
  import 'package:flutter_test/flutter_test.dart';
  import 'package:printing_app/shared/widgets/ruler_overlay.dart';

  void main() {
    testWidgets('RulerOverlay shows mm dimensions', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 300,
              height: 400,
              child: RulerOverlay(widthMm: 210, heightMm: 297),
            ),
          ),
        ),
      );
      expect(find.text('210mm × 297mm'), findsOneWidget);
    });
  }
  ```

- [ ] **Step 4: Run test to confirm failure**

  ```bash
  cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/shared/widgets/ruler_overlay_test.dart
  ```

  Expected: FAIL — `RulerOverlay` not found.

- [ ] **Step 5: Update FilePreviewSheet — replace syncfusion PDF viewer with pdfx + add ruler toggle**

  Open `apps/mobile/lib/shared/widgets/file_preview_sheet.dart`.

  Add imports:
  ```dart
  import 'package:pdfx/pdfx.dart';
  import 'package:printing_app/shared/widgets/ruler_overlay.dart';
  ```

  Add state in the `State` class:
  ```dart
  bool _showRuler = false;
  PdfController? _pdfController;
  ```

  Replace the PDF viewer section (currently `SfPdfViewer.network(...)`) with:
  ```dart
  // PDF preview using pdfx (web-compatible)
  Builder(builder: (context) {
    _pdfController ??= PdfController(
      document: PdfDocument.openUrl(_presignedUrl!),
    );
    return PdfView(
      controller: _pdfController!,
      scrollDirection: Axis.vertical,
    );
  }),
  ```

  Add ruler toggle button to the preview header row (next to the close button):
  ```dart
  if (_presignedUrl != null)
    IconButton(
      icon: Icon(
        Icons.straighten_rounded,
        color: _showRuler ? AppColors.brand : Colors.white60,
      ),
      onPressed: () => setState(() => _showRuler = !_showRuler),
      tooltip: 'Toggle ruler',
    ),
  ```

  Wrap the preview content in a `Stack` and conditionally show `RulerOverlay`:
  ```dart
  Stack(
    children: [
      // existing preview widget (image or PdfView)
      _buildPreviewContent(),
      if (_showRuler && _widthMm != null && _heightMm != null)
        Positioned.fill(
          child: RulerOverlay(widthMm: _widthMm!, heightMm: _heightMm!),
        ),
    ],
  ),
  ```

  > `_widthMm` and `_heightMm` are fetched from `GET /files/:id/inspect` (see Task 8).

- [ ] **Step 6: Run widget tests**

  ```bash
  cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test test/shared/widgets/ruler_overlay_test.dart
  ```

  Expected: 1 test passes.

- [ ] **Step 7: Run full test suite**

  ```bash
  cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test 2>&1 | tail -5
  ```

  Expected: all existing tests pass.

- [ ] **Step 8: Commit**

  ```bash
  git add apps/mobile/pubspec.yaml apps/mobile/pubspec.lock \
          apps/mobile/lib/shared/widgets/ruler_overlay.dart \
          apps/mobile/lib/shared/widgets/file_preview_sheet.dart \
          apps/mobile/test/shared/widgets/ruler_overlay_test.dart
  git commit -m "feat(mobile): add pdfx PDF viewer, RulerOverlay widget, and ruler toggle in FilePreviewSheet"
  ```

---

## Section 6 — Mobile: File Inspection in Order Flow

### Task 8: Fetch and display file inspection results during order upload

**Files:**
- Modify: `apps/mobile/lib/shared/models/uploaded_file.dart`
- Modify: `apps/mobile/lib/features/customer/order/screens/upload_screen.dart`
- Modify: `apps/mobile/lib/shared/widgets/file_preview_sheet.dart`

- [ ] **Step 1: Add analysis fields to UploadedFile model**

  Open `apps/mobile/lib/shared/models/uploaded_file.dart`. Add fields and update `fromJson`:

  ```dart
  final double? widthMm;
  final double? heightMm;
  final String? colorSpace;
  final int? pageCount;
  ```

  Update `fromJson`:
  ```dart
  widthMm: (json['widthMm'] as num?)?.toDouble(),
  heightMm: (json['heightMm'] as num?)?.toDouble(),
  colorSpace: json['colorSpace'] as String?,
  pageCount: json['pageCount'] as int?,
  ```

- [ ] **Step 2: Write test for fromJson with new fields**

  Open `apps/mobile/test/shared/models/uploaded_file_test.dart`. Add:

  ```dart
  test('fromJson parses analysis fields', () {
    final json = {
      'id': 1, 'originalName': 'test.pdf', 'mimeType': 'application/pdf',
      'size': 1024, 'createdAt': '2026-01-01T00:00:00.000Z',
      'widthMm': 210.0, 'heightMm': 297.0, 'colorSpace': 'rgb', 'pageCount': 3,
    };
    final file = UploadedFile.fromJson(json);
    expect(file.widthMm, 210.0);
    expect(file.heightMm, 297.0);
    expect(file.colorSpace, 'rgb');
    expect(file.pageCount, 3);
  });
  ```

- [ ] **Step 3: Show CMYK warning and size mismatch in upload_screen.dart**

  Open `apps/mobile/lib/features/customer/order/screens/upload_screen.dart`.

  After successful file upload (where `fileMetadataId` is received), call the inspect endpoint:
  ```dart
  // After upload succeeds and we have fileMetadataId:
  final paperSize = ref.read(orderFlowProvider).paperSize?.name; // e.g. 'A4'
  if (fileMetadataId != null && paperSize != null) {
    try {
      final res = await ApiClient.instance.get(
        '/files/$fileMetadataId/inspect?paperSize=$paperSize',
      );
      // Store inspection result in local state for warning display
      setState(() => _inspection = res.data as Map<String, dynamic>);
    } catch (_) {}
  }
  ```

  Display warnings below the upload card:
  ```dart
  if (_inspection != null) ...[
    const SizedBox(height: AppSpacing.sm),
    if (_inspection!['colorSpace'] == 'cmyk')
      _InspectionChip(
        icon: Icons.palette_outlined,
        label: 'CMYK — print ready',
        color: Colors.green,
      ),
    if (_inspection!['colorSpace'] != null && _inspection!['colorSpace'] != 'cmyk')
      _InspectionChip(
        icon: Icons.palette_outlined,
        label: 'RGB — colors may shift when printed',
        color: Colors.orange,
      ),
    if (_inspection!['sizeValidation']?['status'] == 'mismatch')
      _InspectionChip(
        icon: Icons.warning_amber_rounded,
        label: _inspection!['sizeValidation']['message'] as String,
        color: Colors.red,
      ),
    if (_inspection!['sizeValidation']?['status'] == 'match')
      _InspectionChip(
        icon: Icons.check_circle_outline,
        label: 'Size matches ${paperSize?.toUpperCase() ?? ""}',
        color: Colors.green,
      ),
  ],
  ```

  Add `_InspectionChip` private widget at the bottom of the file:
  ```dart
  class _InspectionChip extends StatelessWidget {
    const _InspectionChip({ required this.icon, required this.label, required this.color });
    final IconData icon;
    final String label;
    final Color color;

    @override
    Widget build(BuildContext context) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: AppSpacing.xs),
            Flexible(
              child: Text(label, style: TextStyle(fontSize: 12, color: color)),
            ),
          ],
        ),
      );
    }
  }
  ```

- [ ] **Step 4: Pass widthMm/heightMm into FilePreviewSheet for ruler**

  Open `apps/mobile/lib/shared/widgets/file_preview_sheet.dart`. Accept new optional params:

  ```dart
  // In the show() static method / constructor, add:
  final double? widthMm;
  final double? heightMm;
  ```

  Store as `_widthMm` and `_heightMm` in state — ruler overlay uses them (already wired in Task 7 Step 5).

- [ ] **Step 5: Run tests**

  ```bash
  cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test 2>&1 | tail -5
  ```

  Expected: all tests pass.

- [ ] **Step 6: Build web**

  ```bash
  cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -3
  ```

  Expected: `✓ Built build/web`

- [ ] **Step 7: Commit**

  ```bash
  git add apps/mobile/lib/shared/models/uploaded_file.dart \
          apps/mobile/lib/features/customer/order/screens/upload_screen.dart \
          apps/mobile/lib/shared/widgets/file_preview_sheet.dart \
          apps/mobile/test/shared/models/uploaded_file_test.dart
  git commit -m "feat(mobile): show CMYK warning and size mismatch in order upload flow"
  ```

---

## Section 7 — Mobile: Printing Preferences

### Task 9: Add defaultPrintMode preference to profile screen and order flow

**Files:**
- Modify: `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart`
- Modify: `apps/mobile/lib/features/customer/order/providers/order_provider.dart`

- [ ] **Step 1: Write test for print mode pre-fill in order flow**

  Open the order provider test file. Add:

  ```dart
  test('paperSpecs include printMode from user default when set', () {
    // The order flow notifier should accept and hold a printMode value
    final notifier = OrderFlowNotifier();
    notifier.setPrintMode('actualSize');
    expect(notifier.state.printMode, 'actualSize');
  });
  ```

- [ ] **Step 2: Add printMode to OrderFlowState**

  Open `apps/mobile/lib/features/customer/order/providers/order_provider.dart`. Add `printMode` to `OrderFlowState`:

  ```dart
  final String printMode; // 'fitToPage' | 'actualSize'

  // In constructor default: printMode = 'fitToPage'
  ```

  Add `setPrintMode` method to `OrderFlowNotifier`:
  ```dart
  void setPrintMode(String mode) {
    state = state.copyWith(printMode: mode);
  }
  ```

  Include `printMode` when building `PaperSpecsDto` for order submission:
  ```dart
  'printMode': state.printMode,
  ```

- [ ] **Step 3: Add print mode toggle to profile screen**

  Open `apps/mobile/lib/features/customer/profile/screens/profile_screen.dart`.

  After the file retention settings section, add a "Printing Preferences" section:

  ```dart
  // Print mode preference tile
  ListTile(
    leading: const Icon(Icons.fit_screen_outlined),
    title: const Text('Default Print Mode'),
    subtitle: Text(_printMode == 'fitToPage' ? 'Fit to paper' : 'Actual size'),
    trailing: SegmentedButton<String>(
      segments: const [
        ButtonSegment(value: 'fitToPage', label: Text('Fit')),
        ButtonSegment(value: 'actualSize', label: Text('Actual')),
      ],
      selected: {_printMode},
      onSelectionChanged: (val) => _updatePrintMode(val.first),
    ),
  ),
  ```

  `_updatePrintMode` calls `PATCH /users/me/profile` with `{ defaultPrintMode: mode }`.

  On order flow initialization, read the user's `defaultPrintMode` and call `setPrintMode()` on the order flow notifier:
  ```dart
  // In upload_screen.dart or order flow initialization:
  final userProfile = await ApiClient.instance.get('/users/me/profile');
  final defaultMode = userProfile.data['defaultPrintMode'] as String? ?? 'fitToPage';
  ref.read(orderFlowProvider.notifier).setPrintMode(defaultMode);
  ```

- [ ] **Step 4: Run tests**

  ```bash
  cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter test 2>&1 | tail -5
  ```

  Expected: all tests pass.

- [ ] **Step 5: Build web**

  ```bash
  cd apps/mobile && /home/jd/fvm/versions/3.41.6/bin/flutter build web --release --no-tree-shake-icons 2>&1 | tail -3
  ```

  Expected: `✓ Built build/web`

- [ ] **Step 6: Commit**

  ```bash
  git add apps/mobile/lib/features/customer/profile/screens/profile_screen.dart \
          apps/mobile/lib/features/customer/order/providers/order_provider.dart
  git commit -m "feat(mobile): add defaultPrintMode preference to profile screen and pre-fill in order flow"
  ```

---

## Manual Verification Checklist

After all tasks complete:

- [ ] Upload a CMYK PDF → inspect endpoint returns `colorSpace: 'cmyk'`, mobile shows green "CMYK — print ready" chip
- [ ] Upload an A3 PDF to an A4 order → size mismatch warning shown on mobile and admin
- [ ] Admin clicks filename in order detail → file preview modal opens with inspection metadata
- [ ] Toggle ruler in admin modal → `widthMm × heightMm` overlay appears
- [ ] Set print mode to "Actual size" in profile → new orders pre-fill `printMode: 'actualSize'`
- [ ] Open file preview on mobile → ruler toggle shows dimension overlay
- [ ] PDF previews work in Flutter Web (via pdfx)

