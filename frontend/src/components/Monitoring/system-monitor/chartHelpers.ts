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

  const bucketSums = new Float64Array(totalBuckets + 1);
  const bucketCounts = new Uint16Array(totalBuckets + 1);
  let maxBucket = -1;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const minIdx = (((p.minuteIndex ?? 0) % 1440) + 1440) % 1440;
    const bIdx = Math.floor(minIdx / intervalMinutes);
    if (bIdx >= 0 && bIdx <= totalBuckets) {
      bucketSums[bIdx] += Number(p[metricKey]) || 0;
      bucketCounts[bIdx]++;
      if (bIdx > maxBucket) {
        maxBucket = bIdx;
      }
    }
  }

  if (maxBucket < 0) {
    return defaultEmpty;
  }

  const aggregatedData: number[] = new Array(maxBucket + 1);
  let lastAvg = 0;
  for (let b = 0; b <= maxBucket; b++) {
    const count = bucketCounts[b];
    if (count > 0) {
      lastAvg = bucketSums[b] / count;
    }
    aggregatedData[b] = Math.round(lastAvg * 10) / 10;
  }

  // Windows Task Manager oscilloscope: stream linear polyline from right to left
  const svgPoints = buildSvgPoints(aggregatedData, maxVal, viewWidth, viewHeight, totalBuckets);
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
  intervalMinutes: number
) => {
  const totalBuckets = Math.round(1440 / intervalMinutes);
  const bucketRps = new Float64Array(totalBuckets + 1);
  const bucketLat = new Float64Array(totalBuckets + 1);
  let maxB = -1;

  for (let d = 0; d < deployments.length; d++) {
    const dep = deployments[d];
    const points = metrics[dep.id] || [];
    const replicas = dep.replicas || 1;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const minIdx = (((p.minuteIndex ?? 0) % 1440) + 1440) % 1440;
      const bIdx = Math.floor(minIdx / intervalMinutes);
      if (bIdx >= 0 && bIdx <= totalBuckets) {
        const rps = Math.round((p.cpuPercent || 0) * 15 * replicas);
        const lat = Math.round(5 + (p.cpuPercent || 0) * 0.4);
        bucketRps[bIdx] += rps;
        if (lat > bucketLat[bIdx]) {
          bucketLat[bIdx] = lat;
        }
        if (bIdx > maxB) {
          maxB = bIdx;
        }
      }
    }
  }

  const rpsArr: number[] = [];
  const latArr: number[] = [];
  if (maxB >= 0) {
    for (let b = 0; b <= maxB; b++) {
      rpsArr.push(bucketRps[b]);
      latArr.push(bucketLat[b]);
    }
  }
  return { rpsArr, latArr };
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
    ? aggregateBucketNetworkMetrics(deployments, metrics, intervalMinutes)
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
      const capacity = Math.round(1440 / parseIntervalMinutes(interval));
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
