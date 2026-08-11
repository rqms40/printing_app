import { useEffect, useRef } from "react";
import { Typography } from "antd";

const { Text } = Typography;

type Point = [number, number] | null;

function parseSignaturePoints(signatureData: string): Point[] | null {
  try {
    const parsed = JSON.parse(signatureData) as {
      format?: string;
      points?: unknown[];
    };
    if (!Array.isArray(parsed.points)) return null;
    return parsed.points.map((p) => {
      if (p == null) return null;
      if (Array.isArray(p) && p.length >= 2) {
        const x = Number(p[0]);
        const y = Number(p[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return [x, y] as [number, number];
      }
      return null;
    });
  } catch {
    return null;
  }
}

interface Props {
  signatureData?: string | null;
  label?: string;
  height?: number;
  emptyText?: string;
}

/**
 * Read-only canvas preview of a drawn signature
 * (`gridgo-signature-v1` points JSON from mobile/admin pads).
 */
export function SignaturePreview({
  signatureData,
  label = "Signature",
  height = 140,
  emptyText = "No signature on file",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const points = signatureData ? parseSignaturePoints(signatureData) : null;
  const hasInk =
    Array.isArray(points) && points.some((p) => p != null && p.length >= 2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk || !points) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 400;
    const h = rect.height || height;

    canvas.width = width * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, h);

    // Fit signature into canvas with padding.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      if (!p) continue;
      minX = Math.min(minX, p[0]);
      minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]);
      maxY = Math.max(maxY, p[1]);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return;

    const pad = 16;
    const srcW = Math.max(maxX - minX, 1);
    const srcH = Math.max(maxY - minY, 1);
    const scale = Math.min((width - pad * 2) / srcW, (h - pad * 2) / srcH);

    ctx.strokeStyle = "#F0F0F0";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let started = false;
    for (const p of points) {
      if (!p) {
        started = false;
        continue;
      }
      const x = pad + (p[0] - minX) * scale;
      const y = pad + (p[1] - minY) * scale;
      if (!started) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  }, [hasInk, height, points, signatureData]);

  return (
    <div>
      <Text strong style={{ fontSize: 13, display: "block", marginBottom: 6 }}>
        {label}
      </Text>
      {hasInk ? (
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height,
            background: "#1A1A1A",
            border: "1px solid #2E2E2E",
            borderRadius: 8,
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#141414",
            border: "1px dashed #333",
            borderRadius: 8,
            color: "#666",
            fontSize: 12,
          }}
        >
          {emptyText}
        </div>
      )}
    </div>
  );
}

/** Extract signatureData from a checklist Results entry. */
export function extractSignatureData(
  entry: unknown,
): string | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const raw = (entry as { signatureData?: unknown }).signatureData;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}
