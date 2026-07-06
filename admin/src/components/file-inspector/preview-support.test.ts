import { describe, expect, it } from "vitest";
import {
  canRenderCadExtension,
  getFileExtension,
  resolveCadPreview,
} from "./preview-support";

describe("file inspector preview support", () => {
  it("treats STL, OBJ, GLB, and GLTF as direct admin CAD formats", () => {
    expect(canRenderCadExtension("stl")).toBe(true);
    expect(canRenderCadExtension("obj")).toBe(true);
    expect(canRenderCadExtension("glb")).toBe(true);
    expect(canRenderCadExtension("gltf")).toBe(true);
    expect(canRenderCadExtension("3mf")).toBe(false);
  });

  it("uses a converted preview GLB for 3MF files", () => {
    const resolved = resolveCadPreview({
      originalExtension: "3mf",
      originalUrl: "https://files.local/uploads/model.3mf?sig=abc",
      previewUrl: "https://files.local/uploads/model.3mf.preview.glb?sig=def",
    });

    expect(resolved).toEqual({
      fileUrl: "https://files.local/uploads/model.3mf.preview.glb?sig=def",
      fileExtension: "glb",
    });
  });

  it("falls back to the original URL for direct CAD formats", () => {
    const resolved = resolveCadPreview({
      originalExtension: getFileExtension("part.obj"),
      originalUrl: "https://files.local/uploads/part.obj?sig=abc",
      previewUrl: null,
    });

    expect(resolved).toEqual({
      fileUrl: "https://files.local/uploads/part.obj?sig=abc",
      fileExtension: "obj",
    });
  });
});
