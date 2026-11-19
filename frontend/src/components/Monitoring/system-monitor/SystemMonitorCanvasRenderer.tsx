import { useRef, useEffect, memo } from 'react';

export interface CanvasSeriesItem {
  id: string;
  color: string;
  data: number[] | Float32Array;
  isArea?: boolean;
  isStepped?: boolean;
  lineWidth?: number;
}

export interface SystemMonitorCanvasRendererProps {
  series: CanvasSeriesItem[];
  maxVal: number;
  capacity?: number;
}

export const hexToRgba = (hex: string, alpha: number): string => {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = `${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`;
  }
  const num = parseInt(c, 16);
  if (Number.isNaN(num)) return `rgba(59, 130, 246, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const drawSingleSeriesArea = (
  ctx: CanvasRenderingContext2D,
  s: CanvasSeriesItem,
  width: number,
  height: number,
  effectiveCapacity: number,
  heightScale: number,
  safeMax: number
) => {
  const data = s.data;
  const count = data.length;
  if (count === 0) return;

  const visibleData = count > effectiveCapacity ? data.slice(-effectiveCapacity) : data;
  const visibleCount = visibleData.length;

  const y0 = Math.round(height - Math.min(safeMax, Math.max(0, visibleData[0])) * heightScale);

  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, y0);

  let lastX = 0;
  for (let i = 0; i < visibleCount; i++) {
    const x = Math.min(width, Math.max(0, Math.round(((i + 1) / effectiveCapacity) * width)));
    const val = visibleData[i];
    const safeVal = Math.min(safeMax, Math.max(0, val));
    const y = Math.round(height - safeVal * heightScale);
    ctx.lineTo(x, y);
    lastX = x;
  }

  ctx.lineTo(lastX, height);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, hexToRgba(s.color, 0.22));
  grad.addColorStop(1, hexToRgba(s.color, 0.02));
  ctx.fillStyle = grad;
  ctx.fill();
};

const drawSingleSeriesStroke = (
  ctx: CanvasRenderingContext2D,
  s: CanvasSeriesItem,
  width: number,
  height: number,
  effectiveCapacity: number,
  heightScale: number,
  safeMax: number
) => {
  const data = s.data;
  const count = data.length;
  if (count === 0) return;

  const visibleData = count > effectiveCapacity ? data.slice(-effectiveCapacity) : data;
  const visibleCount = visibleData.length;

  const y0 = Math.round(height - Math.min(safeMax, Math.max(0, visibleData[0])) * heightScale);

  ctx.beginPath();
  ctx.moveTo(0, y0);

  for (let i = 0; i < visibleCount; i++) {
    const x = Math.min(width, Math.max(0, Math.round(((i + 1) / effectiveCapacity) * width)));
    const val = visibleData[i];
    const safeVal = Math.min(safeMax, Math.max(0, val));
    const y = Math.round(height - safeVal * heightScale);

    if (s.isStepped) {
      const prevVal = Math.min(safeMax, Math.max(0, i === 0 ? visibleData[0] : visibleData[i - 1]));
      const prevY = Math.round(height - prevVal * heightScale);
      ctx.lineTo(x, prevY);
      ctx.lineTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.lineWidth || 1.75;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
};

export const renderCanvasSeries = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seriesList: CanvasSeriesItem[],
  maxVal: number,
  capacity?: number
) => {
  ctx.clearRect(0, 0, width, height);

  const safeMax = Math.max(1, maxVal);
  const heightScale = (height - 10) / safeMax;
  const effectiveCapacity = Math.max(1, capacity || 12);

  for (let i = 0; i < seriesList.length; i++) {
    const s = seriesList[i];
    if (s.data.length === 0) continue;

    if (s.isArea) {
      drawSingleSeriesArea(ctx, s, width, height, effectiveCapacity, heightScale, safeMax);
    }
    drawSingleSeriesStroke(ctx, s, width, height, effectiveCapacity, heightScale, safeMax);
  }
};

export const SystemMonitorCanvasRenderer = memo(({
  series,
  maxVal,
  capacity,
}: SystemMonitorCanvasRendererProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = globalThis.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = Math.round(rect.width) || 500;
    const displayHeight = Math.round(rect.height) || 140;

    const targetWidth = Math.round(displayWidth * dpr);
    const targetHeight = Math.round(displayHeight * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    renderCanvasSeries(ctx, displayWidth, displayHeight, series, maxVal, capacity);
    ctx.restore();
  }, [series, maxVal, capacity]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="system-monitor-canvas"
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
});
