import { describe, expect, it, vi } from "vitest";

import { loadOrderFilePreview } from "./preview";

describe("loadOrderFilePreview", () => {
  it("uses a backend preview URL for metadata-backed files", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ data: { url: "https://files.example/signed.pdf" } })
      .mockResolvedValueOnce({
        data: {
          mimeType: "application/pdf",
          widthMm: 210,
          heightMm: 297,
          widthPx: null,
          heightPx: null,
          colorSpace: "cmyk",
          pageCount: 2,
          dpi: null,
          sizeValidation: { status: "match", orientation: "portrait" },
        },
      });

    const preview = await loadOrderFilePreview({
      get,
      fileUrl: "http://localhost:9000/grid-print/uploads/job.pdf",
      fileName: "job.pdf",
      fileMetadataId: 6,
      paperSize: "a4",
    });

    expect(preview.url).toBe("https://files.example/signed.pdf");
    expect(preview.mimeType).toBe("application/pdf");
    expect(preview.inspection?.sizeValidation?.status).toBe("match");
    expect(get).toHaveBeenNthCalledWith(1, "/files/6/presigned-url");
    expect(get).toHaveBeenNthCalledWith(2, "/files/6/inspect?paperSize=a4");
  });

  it("does not inspect a file when the preview URL cannot be generated", async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error("File not found"));

    await expect(
      loadOrderFilePreview({
        get,
        fileUrl: "http://localhost:9000/grid-print/uploads/missing.pdf",
        fileName: "missing.pdf",
        fileMetadataId: 5,
        paperSize: "a4",
      }),
    ).rejects.toThrow("File not found");

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/files/5/presigned-url");
  });

  it("falls back to a direct URL only for legacy files without metadata", async () => {
    const get = vi.fn();

    const preview = await loadOrderFilePreview({
      get,
      fileUrl: "https://legacy.example/file.png",
      fileName: "file.png",
      fileMetadataId: undefined,
      paperSize: "a4",
    });

    expect(preview.url).toBe("https://legacy.example/file.png");
    expect(preview.mimeType).toBe("image/png");
    expect(preview.inspection).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});
