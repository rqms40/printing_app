const DIRECT_CAD_EXTENSIONS = new Set(["stl", "obj", "glb", "gltf"]);

export function getFileExtension(name: string): string {
  const clean = name.split("?")[0]?.split("#")[0] ?? name;
  const parts = clean.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
}

export function canRenderCadExtension(extension: string): boolean {
  return DIRECT_CAD_EXTENSIONS.has(extension.toLowerCase());
}

function extensionFromUrl(url: string): string {
  try {
    return getFileExtension(new URL(url).pathname);
  } catch {
    return getFileExtension(url);
  }
}

export function resolveCadPreview({
  originalExtension,
  originalUrl,
  previewUrl,
}: {
  originalExtension: string;
  originalUrl: string;
  previewUrl?: string | null;
}): { fileUrl: string; fileExtension: string } | null {
  if (previewUrl) {
    const previewExtension = extensionFromUrl(previewUrl);
    if (canRenderCadExtension(previewExtension)) {
      return { fileUrl: previewUrl, fileExtension: previewExtension };
    }
  }

  const normalizedOriginalExtension = originalExtension.toLowerCase();
  if (canRenderCadExtension(normalizedOriginalExtension)) {
    return {
      fileUrl: originalUrl,
      fileExtension: normalizedOriginalExtension,
    };
  }

  return null;
}
