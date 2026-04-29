import type { FileInspection } from "@/components/file-preview-modal";

type ApiGet = <T = unknown>(url: string) => Promise<{ data: T }>;

interface LoadOrderFilePreviewInput {
  get: ApiGet;
  fileUrl?: string | null;
  fileName: string;
  fileMetadataId?: number | null;
  paperSize?: string | null;
}

interface PresignedUrlResponse {
  url?: string;
}

export interface OrderFilePreview {
  url: string;
  name: string;
  mimeType: string;
  inspection: FileInspection | null;
}

export function inferFileMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";

  return "application/octet-stream";
}

function buildInspectionPath(fileMetadataId: number, paperSize?: string | null) {
  const params = paperSize
    ? `?paperSize=${encodeURIComponent(paperSize)}`
    : "";

  return `/files/${fileMetadataId}/inspect${params}`;
}

export async function loadOrderFilePreview({
  get,
  fileUrl,
  fileName,
  fileMetadataId,
  paperSize,
}: LoadOrderFilePreviewInput): Promise<OrderFilePreview> {
  const mimeType = inferFileMimeType(fileName);

  if (!fileMetadataId) {
    if (!fileUrl) {
      throw new Error("This order item does not have an attached file URL.");
    }

    return {
      url: fileUrl,
      name: fileName,
      mimeType,
      inspection: null,
    };
  }

  const presignedResponse = await get<PresignedUrlResponse>(
    `/files/${fileMetadataId}/presigned-url`,
  );

  if (!presignedResponse.data.url) {
    throw new Error("The server did not return a preview URL for this file.");
  }

  let inspection: FileInspection | null = null;
  try {
    const inspectionResponse = await get<FileInspection>(
      buildInspectionPath(fileMetadataId, paperSize),
    );
    inspection = inspectionResponse.data;
  } catch {
    inspection = null;
  }

  return {
    url: presignedResponse.data.url,
    name: fileName,
    mimeType: inspection?.mimeType ?? mimeType,
    inspection,
  };
}
