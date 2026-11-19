import { SimulationMetricPoint } from '@/store/types';
import { DeploymentSummary, TimeRangeFilter } from './types';

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

export interface Point2D {
  x: number;
  y: number;
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
    case '1m':
      return 1;
    case '5m':
      return 5;
    case '10m':
      return 10;
    case '15m':
      return 15;
    case '30m':
      return 30;
    case '1h':
    default:
      return 60;
  }
};

/**
 * Returns the unit name for the active X-axis interval ('Minutes' or 'Hours').
 */
export const getXAxisUnit = (interval?: TimeRangeFilter): string => {
  return interval === '1h' ? 'Hours' : 'Minutes';
};

/**
 * Returns the number of visible interval divisions (capacity) across the chart viewport.
 * 24 divisions for 1h (24 hours full cycle), 12 divisions for sub-hour views (e.g. 12 * 5m = 60m).
 */
export const getIntervalCapacity = (interval?: TimeRangeFilter): number => {
  if (interval === '1h') return 24;
  return 12;
};

/**
 * Determines dynamic step in minutes based on active interval.
 */
export const getIntervalStepMinutes = (interval?: TimeRangeFilter): number => {
  return parseIntervalMinutes(interval);
};

/**
 * Generates dynamic X-axis time marks and percentage positions following the chosen timing interval.
 * Like Google Maps zoom: e.g. for 5m interval, ticks progress 0, 5, 10, 15, 20... with 'Minutes' label.
 */
export const generateXAxisTicks = (interval?: TimeRangeFilter): XAxisTick[] => {
  const capacity = getIntervalCapacity(interval);
  const step = interval === '1h' ? 1 : parseIntervalMinutes(interval);
  const ticks: XAxisTick[] = [];

  for (let i = 0; i <= capacity; i++) {
    const val = i * step;
    const percent = Math.round((i / capacity) * 1000) / 10;
    ticks.push({
      label: String(val),
      minute: val,
      percent,
    });
  }

  return ticks;
};

/**
 * Formats hover scrubber time label based on active interval scale and hover percentage.
 */
export const getScrubberTimeLabel = (percent: number, interval?: TimeRangeFilter): string => {
  const capacity = getIntervalCapacity(interval);
  const step = interval === '1h' ? 1 : parseIntervalMinutes(interval);
  const total = capacity * step;
  const currentVal = Math.round((Math.max(0, Math.min(100, percent)) / 100) * total);
  if (interval === '1h') {
    return `${currentVal}h`;
  }
  return `${currentVal} min`;
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
  const len = values?.length ?? 0;
  if (len === 0) {
    return minFloor;
  }
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const v = values[i];
    if (v > peak) peak = v;
  }
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
 * Computes min, max, avg, and current values for a numeric series in a single O(N) pass.
 */
export const calculateSeriesStats = (
  id: string,
  label: string,
  color: string,
  data: number[],
  lastPoint?: { isThrottled?: boolean; isOOM?: boolean }
): SeriesStats => {
  const len = data.length;
  if (len === 0) {
    return { id, label, color, current: 0, min: 0, max: 0, avg: 0 };
  }
  let min = data[0];
  let max = data[0];
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const current = Math.round(data[len - 1] || 0);
  const avg = Math.round(sum / len);

  return {
    id,
    label,
    color,
    current,
    min: Math.round(min),
    max: Math.round(max),
    avg,
    isThrottled: lastPoint?.isThrottled,
    isOOM: lastPoint?.isOOM,
  };
};

/**
 * Maps an array of numeric data values to 2D screen coordinates streaming from right to left.
 */
export const dataToCoords = (
  data: number[],
  maxVal: number = 100,
  viewWidth: number = 500,
  viewHeight: number = 140,
  capacity?: number
): Point2D[] => {
  if (data.length === 0) return [];
  const count = data.length;
  const effectiveCapacity = capacity ? Math.max(count, capacity) : Math.max(30, count);
  const stepX = viewWidth / Math.max(1, effectiveCapacity - 1);

  const coords = data.map((val, i) => {
    const x = Math.max(0, Math.round(viewWidth - (count - 1 - i) * stepX));
    const safeVal = Math.min(maxVal, Math.max(0, val));
    const y = Math.round(viewHeight - (safeVal / maxVal) * (viewHeight - 10));
    return { x, y };
  });

  if (coords.length === 1) {
    coords.unshift({ x: Math.max(0, viewWidth - Math.round(stepX)), y: coords[0].y });
  }

  return coords;
};

/**
 * Constructs an SVG path for area fill under the line, bounded between first point and viewWidth.
 * High performance zero-split implementation.
 */
export const buildAreaPath = (
  svgPoints: string,
  viewWidth: number = 500,
  viewHeight: number = 140
): string => {
  if (!svgPoints) return `M0,${viewHeight} L${viewWidth},${viewHeight} Z`;
  const commaIdx = svgPoints.indexOf(',');
  const firstX = commaIdx > 0 ? svgPoints.slice(0, commaIdx) : '0';
  return `M${firstX},${viewHeight} L${svgPoints} L${viewWidth},${viewHeight} Z`;
};

/**
 * Generates an SVG polyline points string from data points streaming from right to left
 * (Windows Task Manager oscilloscope behavior) directly in a single pass without intermediate objects.
 */
export const buildSvgPoints = (
  data: number[],
  maxVal: number = 100,
  viewWidth: number = 500,
  viewHeight: number = 140,
  capacity?: number
): string => {
  const count = data.length;
  if (count === 0) return `0,${viewHeight} ${viewWidth},${viewHeight}`;

  const effectiveCapacity = capacity ? Math.max(count, capacity) : Math.max(30, count);
  const stepX = viewWidth / Math.max(1, effectiveCapacity - 1);
  const heightFactor = (viewHeight - 10) / Math.max(1, maxVal);

  if (count === 1) {
    const safeVal = Math.min(maxVal, Math.max(0, data[0]));
    const y = Math.round(viewHeight - safeVal * heightFactor);
    const x0 = Math.max(0, viewWidth - Math.round(stepX));
    return `${x0},${y} ${viewWidth},${y}`;
  }

  let result = '';
  for (let i = 0; i < count; i++) {
    const x = Math.max(0, Math.round(viewWidth - (count - 1 - i) * stepX));
    const val = data[i];
    const safeVal = Math.min(maxVal, Math.max(0, val));
    const y = Math.round(viewHeight - safeVal * heightFactor);
    if (i > 0) result += ' ';
    result += x + ',' + y;
  }
  return result;
};

/**
 * Aggregates simulation metric points based on specified interval,
 * committing fixed points and streaming like Windows Task Manager oscilloscope.
 * Fully cycle-aware: Day 2 never overwrites or re-averages Day 1.
 */
export const aggregateMetricSeries = (
  points: SimulationMetricPoint[],
  metricKey: keyof SimulationMetricPoint,
  interval: TimeRangeFilter = '1h',
  maxVal: number = 100,
  viewWidth: number = 500,
  viewHeight: number = 140
): AggregatedSeriesResult => {
  const defaultEmpty: AggregatedSeriesResult = {
    data: [],
    svgPoints: `0,${viewHeight} ${viewWidth},${viewHeight}`,
    areaPath: `M0,${viewHeight} L${viewWidth},${viewHeight} Z`,
    currentVal: 0,
  };

  if (!points || points.length === 0) {
    return defaultEmpty;
  }

  const intervalMinutes = parseIntervalMinutes(interval);
  const dayBuckets = Math.max(1, Math.round(1440 / intervalMinutes));
  const capacity = getIntervalCapacity(interval);
  const hasMinuteIndex = points.some((p) => typeof p.minuteIndex === 'number');

  if (!hasMinuteIndex) {
    const rawData = points.map((p) => Number(p[metricKey]) || 0);
    const svgPoints = buildSvgPoints(rawData, maxVal, viewWidth, viewHeight, capacity);
    const areaPath = buildAreaPath(svgPoints, viewWidth, viewHeight);
    return {
      data: rawData,
      svgPoints,
      areaPath,
      currentVal: rawData.at(-1) || 0,
    };
  }

  let cycle = 0;
  let lastRawMinute = -1;
  const bucketSums = new Map<number, number>();
  const bucketCounts = new Map<number, number>();

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const rawMin = p.minuteIndex ?? 0;
    if (lastRawMinute >= 0 && rawMin < lastRawMinute) {
      cycle++;
    }
    lastRawMinute = rawMin;

    const minIdx = ((rawMin % 1440) + 1440) % 1440;
    const bIdx = cycle * dayBuckets + Math.floor(minIdx / intervalMinutes);
    const val = Number(p[metricKey]) || 0;

    bucketSums.set(bIdx, (bucketSums.get(bIdx) || 0) + val);
    bucketCounts.set(bIdx, (bucketCounts.get(bIdx) || 0) + 1);
  }

  const allBucketIndices = Array.from(bucketSums.keys()).sort((a, b) => a - b);
  if (allBucketIndices.length === 0) {
    return defaultEmpty;
  }

  const firstB = allBucketIndices[0];
  const maxB = allBucketIndices.at(-1)!;
  const fullData: number[] = [];

  let lastAvg = 0;
  for (let b = firstB; b <= maxB; b++) {
    const sum = bucketSums.get(b);
    const count = bucketCounts.get(b);
    if (count && count > 0 && sum !== undefined) {
      lastAvg = sum / count;
    }
    fullData.push(Math.round(lastAvg * 10) / 10);
  }

  const aggregatedData = fullData.slice(-capacity);

  // Windows Task Manager oscilloscope: stream linear polyline from right to left
  const svgPoints = buildSvgPoints(aggregatedData, maxVal, viewWidth, viewHeight, capacity);
  const areaPath = buildAreaPath(svgPoints, viewWidth, viewHeight);

  const latestRaw = points.at(-1);
  const currentVal = latestRaw ? (Number(latestRaw[metricKey]) || 0) : 0;

  return {
    data: aggregatedData,
    svgPoints,
    areaPath,
    currentVal,
  };
};

export interface NetworkMetricsResult {
  rpsData: number[];
  currentRps: number;
  currentLatency: number;
}

const aggregateUnindexedNetworkMetrics = (
  deployments: DeploymentSummary[],
  metrics: Record<string, SimulationMetricPoint[]>
) => {
  const rpsArr: number[] = [];
  const latArr: number[] = [];
  deployments.forEach((dep) => {
    const points = metrics[dep.id] || [];
    const replicas = dep.replicas || 1;
    points.forEach((p, idx) => {
      const rps = Math.round((p.cpuPercent || 0) * 15 * replicas);
      const lat = Math.round(5 + (p.cpuPercent || 0) * 0.4);
      rpsArr[idx] = (rpsArr[idx] || 0) + rps;
      latArr[idx] = Math.max(latArr[idx] || 0, lat);
    });
  });
  return { rpsArr, latArr };
};

const aggregateBucketNetworkMetrics = (
  deployments: DeploymentSummary[],
  metrics: Record<string, SimulationMetricPoint[]>,
  intervalMinutes: number,
  interval?: TimeRangeFilter
) => {
  const dayBuckets = Math.max(1, Math.round(1440 / intervalMinutes));
  const capacity = getIntervalCapacity(interval);
  const bucketRpsSum = new Map<number, number>();
  const bucketRpsCount = new Map<number, number>();
  const bucketLat = new Map<number, number>();

  for (let d = 0; d < deployments.length; d++) {
    const dep = deployments[d];
    const points = metrics[dep.id] || [];
    const replicas = dep.replicas || 1;
    let cycle = 0;
    let lastRawMin = -1;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const rawMin = p.minuteIndex ?? 0;
      if (lastRawMin >= 0 && rawMin < lastRawMin) {
        cycle++;
      }
      lastRawMin = rawMin;

      const minIdx = ((rawMin % 1440) + 1440) % 1440;
      const bIdx = cycle * dayBuckets + Math.floor(minIdx / intervalMinutes);
      const rps = Math.round((p.cpuPercent || 0) * 15 * replicas);
      const lat = Math.round(5 + (p.cpuPercent || 0) * 0.4);

      bucketRpsSum.set(bIdx, (bucketRpsSum.get(bIdx) || 0) + rps);
      bucketRpsCount.set(bIdx, (bucketRpsCount.get(bIdx) || 0) + 1);

      const existingLat = bucketLat.get(bIdx) || 0;
      if (lat > existingLat) {
        bucketLat.set(bIdx, lat);
      }
    }
  }

  const allIndices = Array.from(bucketRpsSum.keys()).sort((a, b) => a - b);
  if (allIndices.length === 0) {
    return { rpsArr: [], latArr: [] };
  }

  const firstB = allIndices[0];
  const maxB = allIndices.at(-1)!;

  const fullRps: number[] = [];
  const fullLat: number[] = [];
  let lastRps = 0;
  let lastLat = 0;

  for (let b = firstB; b <= maxB; b++) {
    const sum = bucketRpsSum.get(b);
    const cnt = bucketRpsCount.get(b);
    if (cnt && cnt > 0 && sum !== undefined) {
      lastRps = Math.round(sum / cnt);
    }
    const lat = bucketLat.get(b);
    if (lat !== undefined) {
      lastLat = lat;
    }
    fullRps.push(lastRps);
    fullLat.push(lastLat);
  }

  return {
    rpsArr: fullRps.slice(-capacity),
    latArr: fullLat.slice(-capacity),
  };
};

export const calculateNetworkMetrics = (
  deployments: DeploymentSummary[],
  metrics: Record<string, SimulationMetricPoint[]>,
  interval?: TimeRangeFilter
): NetworkMetricsResult => {
  const intervalMinutes = parseIntervalMinutes(interval);
  const allPoints = Object.values(metrics).flat();
  const hasMinuteIndex = allPoints.some((p) => typeof p.minuteIndex === 'number');

  const { rpsArr, latArr } = hasMinuteIndex
    ? aggregateBucketNetworkMetrics(deployments, metrics, intervalMinutes, interval)
    : aggregateUnindexedNetworkMetrics(deployments, metrics);

  return {
    rpsData: rpsArr,
    currentRps: rpsArr.at(-1) || 0,
    currentLatency: latArr.at(-1) || 0,
  };
};

export interface ReplicaSeriesItem {
  id: string;
  label: string;
  color: string;
  current: number;
  data: number[];
  svgPoints: string;
}

export const extractReplicaCounts = (
  deployments: DeploymentSummary[],
  metrics: Record<string, SimulationMetricPoint[]>
): number[] => {
  const counts: number[] = [];
  deployments.forEach((dep) => {
    counts.push(dep.replicas || 1);
    const points = metrics[dep.id] || [];
    points.forEach((p) => {
      if (typeof p.replicas === 'number') counts.push(p.replicas);
    });
  });
  return counts;
};

export const calculateReplicaSeries = (
  deployments: DeploymentSummary[],
  metrics: Record<string, SimulationMetricPoint[]>,
  interval: TimeRangeFilter | undefined,
  dynamicMaxReplicas: number
): ReplicaSeriesItem[] => {
  return deployments.map((dep, idx) => {
    const color = CHART_PALETTE[idx % CHART_PALETTE.length];
    const points = metrics[dep.id] || [];
    const hasMinuteIndex = points.some((p) => typeof p.minuteIndex === 'number');

    if (!hasMinuteIndex) {
      const data = points.map(() => dep.replicas || 1);
      const current = dep.replicas || 1;
      const capacity = getIntervalCapacity(interval);
      const svgPoints = buildSvgPoints(data, dynamicMaxReplicas, 500, 100, capacity);
      return {
        id: dep.id,
        label: dep.label,
        color,
        current,
        data,
        svgPoints,
      };
    }

    const aggregated = aggregateMetricSeries(points, 'replicas', interval, dynamicMaxReplicas, 500, 100);
    const current = Math.round(aggregated.currentVal) || dep.replicas || 1;
    return {
      id: dep.id,
      label: dep.label,
      color,
      current,
      data: aggregated.data,
      svgPoints: aggregated.svgPoints,
    };
  });
};

export interface ThresholdReferenceLine {
  value: number;
  label: string;
  badge: string;
  color: 'amber' | 'rose' | 'red';
  percentFromTop: number;
}

/**
 * Calculates percentage from top of chart canvas for threshold positioning,
 * aligned with dataToCoords SVG coordinate mapping (10px top headroom in 140px height).
 */
export const calculatePercentFromTop = (value: number, dynamicMax: number): number => {
  if (dynamicMax <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, value / dynamicMax));
  return Math.round((1 - ratio * (130 / 140)) * 1000) / 10;
};

const getCpuThresholdLines = (
  dynamicMax: number,
  hasHpa: boolean = false,
  hpaTarget: number = 80
): ThresholdReferenceLine[] => {
  const lines: ThresholdReferenceLine[] = [];
  if (hasHpa && hpaTarget <= dynamicMax) {
    lines.push({
      value: hpaTarget,
      label: `${hpaTarget}% HPA`,
      badge: `${hpaTarget}% HPA Target`,
      color: 'amber',
      percentFromTop: calculatePercentFromTop(hpaTarget, dynamicMax),
    });
  }
  if (90 <= dynamicMax) {
    lines.push({
      value: 90,
      label: '90% Throttle',
      badge: '90% Throttle Risk',
      color: 'rose',
      percentFromTop: calculatePercentFromTop(90, dynamicMax),
    });
  }
  if (dynamicMax > 100) {
    lines.push({
      value: 100,
      label: '100% Limit',
      badge: '100% Quota Limit',
      color: 'red',
      percentFromTop: calculatePercentFromTop(100, dynamicMax),
    });
  }
  return lines;
};

export const resolveMemoryLimit = (
  deployments: DeploymentSummary[] = [],
  metrics: Record<string, SimulationMetricPoint[]> = {},
  fallbackLimit: number = 256
): number => {
  let highestLimit = 0;
  for (const dep of deployments) {
    const lastPoint = metrics[dep.id]?.at(-1);
    if (lastPoint?.memoryLimit && lastPoint.memoryLimit > highestLimit) {
      highestLimit = lastPoint.memoryLimit;
    }
  }
  return highestLimit > 0 ? highestLimit : fallbackLimit;
};

const getMemoryThresholdLines = (
  dynamicMax: number,
  deployments: DeploymentSummary[] = [],
  metrics: Record<string, SimulationMetricPoint[]> = {},
  maxVal: number = 256
): ThresholdReferenceLine[] => {
  const memLimit = resolveMemoryLimit(deployments, metrics, maxVal);
  const softLimit = Math.round(memLimit * 0.85);
  const lines: ThresholdReferenceLine[] = [];

  if (softLimit <= dynamicMax && softLimit > 0) {
    lines.push({
      value: softLimit,
      label: '85% OOM Risk',
      badge: `85% OOM Risk (${softLimit} MiB)`,
      color: 'amber',
      percentFromTop: calculatePercentFromTop(softLimit, dynamicMax),
    });
  }
  if (memLimit <= dynamicMax && memLimit > 0) {
    lines.push({
      value: memLimit,
      label: `Limit: ${memLimit} MiB`,
      badge: `Limit: ${memLimit} MiB`,
      color: 'rose',
      percentFromTop: calculatePercentFromTop(memLimit, dynamicMax),
    });
  }
  return lines;
};

/**
 * Generates Kubernetes-native threshold reference lines (HPA, Throttle risk, Quota limit, OOM risk).
 */
export const getThresholdReferenceLines = (
  metricKey: string,
  dynamicMax: number,
  deployments: DeploymentSummary[] = [],
  metrics: Record<string, SimulationMetricPoint[]> = {},
  maxVal: number = 100,
  hasHpa: boolean = false,
  hpaTarget: number = 80
): ThresholdReferenceLine[] => {
  if (metricKey === 'cpuPercent') {
    const isHpaPresent =
      hasHpa || deployments.some((d) => d.hasHpa || (Array.isArray(d.hpas) && d.hpas.length > 0));
    let resolvedHpaTarget = hpaTarget;
    if (resolvedHpaTarget === 80) {
      for (const d of deployments) {
        if (Array.isArray(d.hpas) && d.hpas.length > 0 && d.hpas[0]?.targetCPU) {
          resolvedHpaTarget = Number(d.hpas[0].targetCPU) || 80;
          break;
        }
      }
    }
    return getCpuThresholdLines(dynamicMax, isHpaPresent, resolvedHpaTarget);
  }
  if (metricKey === 'memoryValue') {
    return getMemoryThresholdLines(dynamicMax, deployments, metrics, maxVal);
  }
  return [];
};
