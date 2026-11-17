export const CHART_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#a855f7', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
];

export interface SeriesStats {
  id: string;
  label: string;
  color: string;
  current: number;
  min: number;
  max: number;
  avg: number;
  isThrottled?: boolean;
  isOOM?: boolean;
}

/**
 * Computes min, max, avg, and current values for a numeric series.
 */
export const calculateSeriesStats = (
  id: string,
  label: string,
  color: string,
  data: number[],
  lastPoint?: { isThrottled?: boolean; isOOM?: boolean }
): SeriesStats => {
  if (data.length === 0) {
    return { id, label, color, current: 0, min: 0, max: 0, avg: 0 };
  }
  const current = Math.round(data.at(-1) || 0);
  const min = Math.round(Math.min(...data));
  const max = Math.round(Math.max(...data));
  const sum = data.reduce((acc, v) => acc + v, 0);
  const avg = Math.round(sum / data.length);

  return {
    id,
    label,
    color,
    current,
    min,
    max,
    avg,
    isThrottled: lastPoint?.isThrottled,
    isOOM: lastPoint?.isOOM,
  };
};

/**
 * Generates an SVG polyline points string from data points.
 */
export const buildSvgPoints = (
  data: number[],
  maxVal: number = 100,
  viewWidth: number = 400,
  viewHeight: number = 140
): string => {
  if (data.length <= 1) return `0,${viewHeight} ${viewWidth},${viewHeight}`;
  const count = data.length;

  return data
    .map((val, i) => {
      const x = Math.round((i / (count - 1)) * viewWidth);
      const safeVal = Math.min(maxVal, Math.max(0, val));
      const y = Math.round(viewHeight - (safeVal / maxVal) * (viewHeight - 10));
      return `${x},${y}`;
    })
    .join(' ');
};
