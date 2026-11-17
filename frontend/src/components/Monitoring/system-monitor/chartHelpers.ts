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
 */
export const generateXAxisTicks = (interval?: TimeRangeFilter): XAxisTick[] => {
  const stepMins = getIntervalStepMinutes(interval);
  const ticks: XAxisTick[] = [];

  for (let m = 0; m <= 1440; m += stepMins) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const label = `${hh}:${mm}`;
    const percent = Math.round((m / 1440) * 1000) / 10;
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

/**
 * Aggregates 24-hour simulation metric points based on the specified interval
 * (default: 1 hour / 60m, dynamic up to 5 minutes).
 */
export const aggregateMetricSeries = (
  points: SimulationMetricPoint[],
  metricKey: keyof SimulationMetricPoint,
  interval: TimeRangeFilter = '1h',
  maxVal: number = 100,
  viewWidth: number = 500,
  viewHeight: number = 140
): AggregatedSeriesResult => {
  if (!points || points.length === 0) {
    return {
      data: [],
      svgPoints: `0,${viewHeight} ${viewWidth},${viewHeight}`,
      currentVal: 0,
    };
  }

  const hasMinuteIndex = points.some((p) => typeof p.minuteIndex === 'number');
  if (!hasMinuteIndex) {
    const rawData = points.map((p) => Number(p[metricKey]) || 0);
    return {
      data: rawData,
      svgPoints: buildSvgPoints(rawData, maxVal, viewWidth, viewHeight),
      currentVal: rawData.at(-1) || 0,
    };
  }

  const intervalMinutes = parseIntervalMinutes(interval);
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
    return {
      data: [],
      svgPoints: `0,${viewHeight} ${viewWidth},${viewHeight}`,
      currentVal: 0,
    };
  }

  const maxBucket = sortedBucketIndices.at(-1)!;
  const aggregatedData: number[] = [];
  const coords: string[] = [];

  let lastAvg = 0;
  for (let b = 0; b <= maxBucket; b++) {
    const vals = bucketMap.get(b);
    let avg = lastAvg;
    if (vals && vals.length > 0) {
      avg = vals.reduce((acc, curr) => acc + curr, 0) / vals.length;
      lastAvg = avg;
    }

    const rounded = Math.round(avg * 10) / 10;
    aggregatedData.push(rounded);

    const x = Math.round(((b * intervalMinutes) / 1440) * viewWidth);
    const safeVal = Math.min(maxVal, Math.max(0, avg));
    const y = Math.round(viewHeight - (safeVal / maxVal) * (viewHeight - 10));
    coords.push(`${x},${y}`);
  }

  if (coords.length === 1) {
    const singleX = Math.round((intervalMinutes / 1440) * viewWidth);
    coords.push(`${Math.min(viewWidth, singleX + 10)},${coords[0].split(',')[1]}`);
  }

  const latestRaw = points.at(-1);
  const currentVal = latestRaw ? (Number(latestRaw[metricKey]) || 0) : 0;

  return {
    data: aggregatedData,
    svgPoints: coords.join(' '),
    currentVal,
  };
};
