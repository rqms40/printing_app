import { useState, useEffect } from "react";
import { Modal, Button, Switch, Alert, Typography, Space, Spin } from "antd";
import { CheckCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { PDFViewer } from "./pdf-viewer";
import { CADViewer } from "./cad-viewer";
import { apiClient } from "@/providers/api-client";
import { getFileExtension, resolveCadPreview } from "./preview-support";

const { Text } = Typography;

interface FileInspectorModalProps {
  open: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  fileMetadataId?: number | null;
  expectedPageCount?: number;
  onVerify?: () => void;
}

export function FileInspectorModal({
  open,
  onClose,
  fileUrl,
  fileName,
  fileMetadataId,
  expectedPageCount,
  onVerify,
}: FileInspectorModalProps) {
  const [extractedPageCount, setExtractedPageCount] = useState<number | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [previewGlbUrl, setPreviewGlbUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const extension = getFileExtension(fileName);
  const isPDF = extension === "pdf";

  // Fetch presigned URL when the modal opens
  useEffect(() => {
    if (!open) return;

    setPresignedUrl(null);
    setPreviewGlbUrl(null);
    setUrlError(null);
    setExtractedPageCount(null);
    setIsValidated(false);

    if (fileMetadataId) {
      setUrlLoading(true);
      Promise.all([
        apiClient.get(`/files/${fileMetadataId}/presigned-url`),
        apiClient.get(`/files/${fileMetadataId}/inspect`).catch(() => null),
      ])
        .then(([urlRes, inspectRes]) => {
          setPresignedUrl(urlRes.data.url);
          setPreviewGlbUrl(inspectRes?.data?.previewGlbUrl ?? null);
        })
        .catch((err) => {
          console.error("Failed to get presigned URL:", err);
          setUrlError(
            "Failed to generate a download link. The file may have been deleted or the storage service is unavailable."
          );
        })
        .finally(() => {
          setUrlLoading(false);
        });
    } else {
      // Fallback: try the raw file_url (may fail due to CORS/auth)
      setPresignedUrl(fileUrl);
    }
  }, [open, fileMetadataId, fileUrl]);

  const handlePageCountExtracted = (count: number) => {
    setExtractedPageCount(count);
    if (expectedPageCount && count === expectedPageCount) {
      setIsValidated(true);
    }
  };

  const handleClose = () => {
    setExtractedPageCount(null);
    setIsValidated(false);
    setPresignedUrl(null);
    setPreviewGlbUrl(null);
    setUrlError(null);
    onClose();
  };

  const renderContent = () => {
    if (urlLoading) {
      return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
          <Spin size="large" tip="Generating secure file link..." />
        </div>
      );
    }

    if (urlError) {
      return (
        <Alert
          message="Cannot Access File"
          description={urlError}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      );
    }

    if (!presignedUrl) {
      return (
        <Alert
          message="No File URL"
          description="This order does not have an accessible file URL."
          type="warning"
          showIcon
        />
      );
    }

    if (isPDF) {
      return (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {extractedPageCount !== null && (
            <Alert
              message={
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <Text strong>
                    Detected Page Count: {extractedPageCount}
                  </Text>
                  {expectedPageCount && (
                    <Text type={extractedPageCount === expectedPageCount ? "success" : "danger"}>
                      Expected: {expectedPageCount}
                    </Text>
                  )}
                  <Space>
                    <Text>Manual Validation:</Text>
                    <Switch
                      checked={isValidated}
                      onChange={setIsValidated}
                      checkedChildren={<CheckCircleOutlined />}
                      unCheckedChildren={<ExclamationCircleOutlined />}
                    />
                  </Space>
                </div>
              }
              type={isValidated ? "success" : "warning"}
              showIcon
              icon={isValidated ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
            />
          )}
          <PDFViewer fileUrl={presignedUrl} onPageCountExtracted={handlePageCountExtracted} />
        </Space>
      );
    }

    const cadPreview = resolveCadPreview({
      originalExtension: extension,
      originalUrl: presignedUrl,
      previewUrl: previewGlbUrl,
    });

    if (cadPreview) {
      return (
        <CADViewer
          fileUrl={cadPreview.fileUrl}
          fileExtension={cadPreview.fileExtension}
        />
      );
    }

    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <Text type="secondary">Preview not available for .{extension} files.</Text>
        <br />
        <Button type="primary" href={presignedUrl} target="_blank" style={{ marginTop: 16 }}>
          Download File
        </Button>
      </div>
    );
  };

  return (
    <Modal
      title={`Inspecting: ${fileName}`}
      open={open}
      onCancel={handleClose}
      footer={[
        <Button key="close" onClick={handleClose}>
          Close Inspector
        </Button>,
        isValidated && isPDF ? (
          <Button 
            key="verified" 
            type="primary" 
            onClick={() => {
              if (onVerify) {
                onVerify();
              } else {
                handleClose();
              }
            }}
          >
            Verified
          </Button>
        ) : null,
      ]}
      width={900}
      destroyOnClose
    >
      {renderContent()}
    </Modal>
  );
}
