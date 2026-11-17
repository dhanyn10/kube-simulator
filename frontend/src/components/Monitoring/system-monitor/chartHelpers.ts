import { SimulationMetricPoint } from '@/store/types';
import { TimeRangeFilter } from './types';

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

export interface AggregatedSeriesResult {
  data: number[];
  svgPoints: string;
  areaPath: string;
  currentVal: number;
}

export interface XAxisTick {
  label: string;
  minute: number;
  percent: number;
}

export interface YAxisScaleTick {
  value: number;
  label: string;
  percentFromTop: number;
}

export interface YAxisScale {
  maxVal: number;
  ticks: YAxisScaleTick[];
}

/**
 * Resolves interval minutes for simulation profile calculation.
 * Default is 60 minutes (1 hour), and dynamic up to 5 minutes.
 */
export const parseIntervalMinutes = (interval?: TimeRangeFilter): number => {
  switch (interval) {
    case '5m':
      return 5;
    case '15m':
      return 15;
    case '30m':
      return 30;
    case '1m':
      return 1;
    case '1h':
    default:
      return 60;
  }
};

/**
 * Determines dynamic tick step in minutes based on active interval.
 */
export const getIntervalStepMinutes = (interval?: TimeRangeFilter): number => {
  const mins = parseIntervalMinutes(interval);
  if (mins <= 5) return 60;
  if (mins <= 15) return 120;
  if (mins <= 30) return 180;
  return 240;
};

/**
 * Generates dynamic X-axis time marks and percentage positions across the 24-hour cycle.
 * Formatted from left (-24h) to right (0 / Now), matching Windows Task Manager oscilloscope.
 */
export const generateXAxisTicks = (interval?: TimeRangeFilter): XAxisTick[] => {
  const stepMins = getIntervalStepMinutes(interval);
  const ticks: XAxisTick[] = [];

  for (let m = 1440; m >= 0; m -= stepMins) {
    const percent = Math.round(((1440 - m) / 1440) * 1000) / 10;
    let label = `-${Math.round(m / 60)}h`;
    if (m === 0) {
      label = '0 (Now)';
    } else if (m % 60 !== 0) {
      const hh = Math.floor(m / 60);
      const mm = m % 60;
      label = `-${hh}h${mm}m`;
    }
    ticks.push({ label, minute: m, percent });
  }

  return ticks;
};

/**
 * Calculates a clean, human-friendly ceiling number for graph scaling.
 */
export const getNiceCeiling = (target: number): number => {
  const power = Math.pow(10, Math.floor(Math.log10(target)));
  const fraction = target / power;

  if (fraction <= 1) return 1 * power;
  if (fraction <= 1.5) return 1.5 * power;
  if (fraction <= 2) return 2 * power;
  if (fraction <= 2.5) return 2.5 * power;
  if (fraction <= 5) return 5 * power;
  return 10 * power;
};

/**
 * Calculates a dynamic Y-axis maximum that scales up when peak exceeds current boundaries,
 * and scales down when values drop (similar to Windows Task Manager autoscaling),
 * rounding to clean, human-readable numbers with headroom.
 */
export const calculateDynamicYMax = (
  values: number[],
  minFloor: number = 100,
  headroom: number = 1.15
): number => {
  if (!values || values.length === 0) {
    return minFloor;
  }
  const peak = Math.max(0, ...values);
  if (peak <= 0) {
    return minFloor;
  }
  const target = peak * headroom;
  if (target <= minFloor) {
    return minFloor;
  }
  return Math.round(getNiceCeiling(target));
};

/**
 * Generates dynamic Y-axis tick values and formatted labels (Windows Task Manager style).
 */
export const generateYAxisScale = (
  maxVal: number,
  unit: string = '',
  tickCount: number = 3
): YAxisScale => {
  const safeCount = Math.max(2, tickCount);
  const ticks: YAxisScaleTick[] = [];
  const step = maxVal / (safeCount - 1);

  for (let i = safeCount - 1; i >= 0; i--) {
    const val = Math.round(i * step);
    const percentFromTop = Math.round(((maxVal - val) / Math.max(1, maxVal)) * 100);
    const label = `${val.toLocaleString('en-US')}${unit}`;
    ticks.push({ value: val, label, percentFromTop });
  }

  return { maxVal, ticks };
};

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
 * Constructs an SVG path for area fill under the line, bounded between first point and viewWidth.
 */
export const buildAreaPath = (
  svgPoints: string,
  viewWidth: number = 500,
  viewHeight: number = 140
): string => {
  if (!svgPoints) return `M0,${viewHeight} L${viewWidth},${viewHeight} Z`;
  const firstCoord = svgPoints.split(' ')[0] || `0,${viewHeight}`;
  const firstX = firstCoord.split(',')[0] || '0';
  return `M${firstX},${viewHeight} L${svgPoints} L${viewWidth},${viewHeight} Z`;
};

/**
 * Generates an SVG polyline points string from data points streaming from right to left
 * (Windows Task Manager oscilloscope behavior).
 */
export const buildSvgPoints = (
  data: number[],
  maxVal: number = 100,
  viewWidth: number = 500,
  viewHeight: number = 140,
  capacity?: number
): string => {
  if (data.length === 0) return `0,${viewHeight} ${viewWidth},${viewHeight}`;
  const count = data.length;
  const effectiveCapacity = capacity ? Math.max(count, capacity) : Math.max(30, count);
  const stepX = viewWidth / Math.max(1, effectiveCapacity - 1);

  const coords = data.map((val, i) => {
    // Windows Task Manager oscilloscope: right-to-left
    // Newest point (i = count - 1) is at viewWidth
    const x = Math.max(0, Math.round(viewWidth - (count - 1 - i) * stepX));
    const safeVal = Math.min(maxVal, Math.max(0, val));
    const y = Math.round(viewHeight - (safeVal / maxVal) * (viewHeight - 10));
    return `${x},${y}`;
  });

  if (coords.length === 1) {
    coords.unshift(`${Math.max(0, viewWidth - Math.round(stepX))},${coords[0].split(',')[1]}`);
  }

  return coords.join(' ');
};

/**
 * Aggregates 24-hour simulation metric points based on the specified interval,
 * streaming from right to left like Windows Task Manager oscilloscope.
 */
export const aggregateMetricSeries = (
  points: SimulationMetricPoint[],
  metricKey: keyof SimulationMetricPoint,
  interval: TimeRangeFilter = '1h',
  maxVal: number = 100,
  viewWidth: number = 500,
  viewHeight: number = 140
): AggregatedSeriesResult => {
  const defaultEmpty = {
    data: [],
    svgPoints: `0,${viewHeight} ${viewWidth},${viewHeight}`,
    areaPath: `M0,${viewHeight} L${viewWidth},${viewHeight} Z`,
    currentVal: 0,
  };

  if (!points || points.length === 0) {
    return defaultEmpty;
  }

  const intervalMinutes = parseIntervalMinutes(interval);
  const totalBuckets = Math.round(1440 / intervalMinutes);
  const hasMinuteIndex = points.some((p) => typeof p.minuteIndex === 'number');

  if (!hasMinuteIndex) {
    const rawData = points.map((p) => Number(p[metricKey]) || 0);
    const svgPoints = buildSvgPoints(rawData, maxVal, viewWidth, viewHeight, totalBuckets);
    const areaPath = buildAreaPath(svgPoints, viewWidth, viewHeight);
    return {
      data: rawData,
      svgPoints,
      areaPath,
      currentVal: rawData.at(-1) || 0,
    };
  }

  const bucketMap = new Map<number, number[]>();
  points.forEach((p) => {
    const minIdx = ((p.minuteIndex ?? 0) % 1440 + 1440) % 1440;
    const bIdx = Math.floor(minIdx / intervalMinutes);
    const val = Number(p[metricKey]) || 0;
    const existing = bucketMap.get(bIdx) || [];
    existing.push(val);
    bucketMap.set(bIdx, existing);
  });

  const sortedBucketIndices = Array.from(bucketMap.keys()).sort((a, b) => a - b);
  if (sortedBucketIndices.length === 0) {
    return defaultEmpty;
  }

  const maxBucket = sortedBucketIndices.at(-1)!;
  const aggregatedData: number[] = [];

  let lastAvg = 0;
  for (let b = 0; b <= maxBucket; b++) {
    const vals = bucketMap.get(b);
    let avg = lastAvg;
    if (vals && vals.length > 0) {
      avg = vals.reduce((acc, curr) => acc + curr, 0) / vals.length;
      lastAvg = avg;
    }
    aggregatedData.push(Math.round(avg * 10) / 10);
  }

  // Windows Task Manager oscilloscope: stream from right to left
  const stepX = viewWidth / Math.max(1, totalBuckets - 1);
  const count = aggregatedData.length;
  const coords: string[] = [];

  for (let i = 0; i < count; i++) {
    const avg = aggregatedData[i];
    const x = Math.max(0, Math.round(viewWidth - (count - 1 - i) * stepX));
    const safeVal = Math.min(maxVal, Math.max(0, avg));
    const y = Math.round(viewHeight - (safeVal / maxVal) * (viewHeight - 10));
    coords.push(`${x},${y}`);
  }

  if (coords.length === 1) {
    coords.unshift(`${Math.max(0, viewWidth - Math.round(stepX))},${coords[0].split(',')[1]}`);
  }

  const latestRaw = points.at(-1);
  const currentVal = latestRaw ? (Number(latestRaw[metricKey]) || 0) : 0;
  const svgPoints = coords.join(' ');
  const areaPath = buildAreaPath(svgPoints, viewWidth, viewHeight);

  return {
    data: aggregatedData,
    svgPoints,
    areaPath,
    currentVal,
  };
};
