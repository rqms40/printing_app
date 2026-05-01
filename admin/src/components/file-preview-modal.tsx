import { Modal, Tag, Alert, Descriptions, Button, Space, Tooltip } from 'antd';
import {
  FileImageOutlined, FilePdfOutlined, ColumnWidthOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';

interface SizeValidation {
  status: 'match' | 'mismatch' | 'unknown';
  fileSizeMm?: string;
  expectedSizeMm?: string;
  message?: string;
  orientation?: string;
}

export interface FileInspection {
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

interface FilePreviewModalProps {
  open: boolean;
  onClose: () => void;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  inspection?: FileInspection | null;
}

export function FilePreviewModal({ open, onClose, fileName, fileUrl, mimeType, inspection }: FilePreviewModalProps) {
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
          message={`Size matches — ${inspection.sizeValidation.orientation ?? 'portrait'}`}
          style={{ borderRadius: 0 }}
        />
      )}

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

        {(isImage || isPdf) && (
          <Button
            size="small"
            icon={<ColumnWidthOutlined />}
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
          {inspection.widthPx && inspection.heightPx && (
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
