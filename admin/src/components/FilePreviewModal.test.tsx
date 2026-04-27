// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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
    const imgs = screen.getAllByRole('img');
    expect(imgs.some((el) => el.tagName.toLowerCase() === 'img')).toBe(true);
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
    expect(screen.getAllByText(/CMYK/i).length).toBeGreaterThan(0);
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
