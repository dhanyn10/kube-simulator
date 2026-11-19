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

interface CanvasPoint {
  x: number;
  y: number;
  prevY: number;
}

const computeVisibleSeriesPoints = (
  data: number[] | Float32Array,
  width: number,
  height: number,
  effectiveCapacity: number,
  heightScale: number,
  safeMax: number
): CanvasPoint[] => {
  const count = data.length;
  if (count === 0) return [];

  const visibleData = count > effectiveCapacity ? data.slice(-effectiveCapacity) : data;
  const points: CanvasPoint[] = [];

  for (let i = 0; i < visibleData.length; i++) {
    const x = Math.min(width, Math.max(0, Math.round(((i + 1) / effectiveCapacity) * width)));
    const safeVal = Math.min(safeMax, Math.max(0, visibleData[i]));
    const prevRaw = i === 0 ? visibleData[0] : visibleData[i - 1];
    const safePrev = Math.min(safeMax, Math.max(0, prevRaw));
    points.push({
      x,
      y: Math.round(height - safeVal * heightScale),
      prevY: Math.round(height - safePrev * heightScale),
    });
  }

  return points;
};

const fillSeriesArea = (
  ctx: CanvasRenderingContext2D,
  color: string,
  points: CanvasPoint[],
  height: number
) => {
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, points[0].y);

  for (const pt of points) {
    ctx.lineTo(pt.x, pt.y);
  }

  ctx.lineTo(points.at(-1)!.x, height);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, hexToRgba(color, 0.22));
  grad.addColorStop(1, hexToRgba(color, 0.02));
  ctx.fillStyle = grad;
  ctx.fill();
};

const strokeSeriesLine = (
  ctx: CanvasRenderingContext2D,
  s: CanvasSeriesItem,
  points: CanvasPoint[]
) => {
  ctx.beginPath();
  ctx.moveTo(0, points[0].y);

  for (const pt of points) {
    if (s.isStepped) {
      ctx.lineTo(pt.x, pt.prevY);
    }
    ctx.lineTo(pt.x, pt.y);
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

  for (const s of seriesList) {
    const points = computeVisibleSeriesPoints(s.data, width, height, effectiveCapacity, heightScale, safeMax);
    if (points.length === 0) continue;

    if (s.isArea) {
      fillSeriesArea(ctx, s.color, points, height);
    }
    strokeSeriesLine(ctx, s, points);
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
