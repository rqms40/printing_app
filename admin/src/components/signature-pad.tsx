import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Space, Typography } from "antd";
import { ClearOutlined } from "@ant-design/icons";

const { Text } = Typography;

type Point = { x: number; y: number } | null;

export interface SignaturePadValue {
  /** JSON string matching mobile `gridgo-signature-v1` format. */
  signatureData: string | null;
  hasInk: boolean;
}

interface Props {
  disabled?: boolean;
  height?: number;
  onChange: (value: SignaturePadValue) => void;
  /** Reset pad when this key changes (e.g. after submit). */
  resetKey?: number | string;
}

/**
 * Canvas signature pad for Pickup QA digital sign-off.
 * Emits the same point-JSON format as the mobile rider proof sheet.
 */
export function SignaturePad({
  disabled,
  height = 160,
  onChange,
  resetKey,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const points = useRef<Point[]>([]);
  const [hasInk, setHasInk] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#F0F0F0";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    let started = false;
    for (const p of points.current) {
      if (!p) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }
  }, []);

  const emit = useCallback(() => {
    const ink = points.current.some((p) => p != null);
    setHasInk(ink);
    if (!ink) {
      onChange({ signatureData: null, hasInk: false });
      return;
    }
    const payload = {
      format: "gridgo-signature-v1",
      points: points.current.map((p) => (p ? [p.x, p.y] : null)),
    };
    onChange({
      signatureData: JSON.stringify(payload),
      hasInk: true,
    });
  }, [onChange]);

  const clear = useCallback(() => {
    points.current = [];
    redraw();
    setHasInk(false);
    onChange({ signatureData: null, hasInk: false });
  }, [onChange, redraw]);

  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    redraw();
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redraw]);

  const posFromEvent = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Text strong style={{ fontSize: 13 }}>
          Digital sign-off
        </Text>
        <Button
          size="small"
          icon={<ClearOutlined />}
          disabled={disabled || !hasInk}
          onClick={clear}
        >
          Clear
        </Button>
      </div>
      <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
        Draw your signature below to confirm this quality check.
      </Text>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height,
          touchAction: "none",
          cursor: disabled ? "not-allowed" : "crosshair",
          background: "#1A1A1A",
          border: "1px solid #2E2E2E",
          borderRadius: 8,
          opacity: disabled ? 0.6 : 1,
        }}
        onPointerDown={(e) => {
          if (disabled) return;
          drawing.current = true;
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          points.current.push(posFromEvent(e));
          redraw();
        }}
        onPointerMove={(e) => {
          if (!drawing.current || disabled) return;
          points.current.push(posFromEvent(e));
          redraw();
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          points.current.push(null);
          redraw();
          emit();
        }}
        onPointerLeave={() => {
          if (!drawing.current) return;
          drawing.current = false;
          points.current.push(null);
          redraw();
          emit();
        }}
      />
      {!hasInk && (
        <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 6 }}>
          Sign here
        </Text>
      )}
      <Space style={{ marginTop: 4 }} />
    </div>
  );
}
