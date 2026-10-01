export interface InternetProfileItem {
  name: string;
  hourly: Record<string, number>;
  daily?: Record<string, number>;
  timestamp?: number;
}

export interface ProfileHoverData {
  x: number;
  y: number;
  val: number;
  hourStr: string;
  minuteIndex: number;
  refKey?: string;
}

export interface ChartPadding {
  padLeft?: number;
  padRight?: number;
  padTop?: number;
  padBottom?: number;
}

export interface TimeSeriesPoint {
  time: string | number;
  value: number;
  label?: string;
}

export interface ChartOptions {
  width: number;
  height: number;
  padding?: ChartPadding | number;
  intervalMinutes?: number;
  minVal?: number;
  maxVal?: number;
}

export interface ChartPoint {
  x: number;
  y: number;
  val: number;
  hour: string;
  minuteIdx: number;
  rawTime?: string | number;
}

export interface YAxisTick {
  val: number;
  y: number;
  label: string;
}

export interface ChartLayoutResult {
  points: ChartPoint[];
  values: number[];
  pathD: string;
  areaD: string;
  minVal: number;
  maxVal: number;
  chartWidth: number;
  chartHeight: number;
  yTicks: YAxisTick[];
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
}

export const PROFILE_INTERVAL_OPTIONS = [
  { label: '1 Hour', minutes: 60 },
  { label: '30 Minutes', minutes: 30 },
  { label: '10 Minutes', minutes: 10 },
] as const;

export const MINUTES_PER_HOUR = 60;
export const HOURS_IN_DAY = 24;
export const MINUTES_IN_DAY = HOURS_IN_DAY * MINUTES_PER_HOUR; // 1440
export const PROFILE_HOURLY_INTERVALS = 23;
export const PROFILE_SPAN_MINUTES = PROFILE_HOURLY_INTERVALS * MINUTES_PER_HOUR; // 1380 minutes (00:00 to 23:00)

export const HOURS_OF_DAY = Array.from({ length: HOURS_IN_DAY }, (_, i) => `${String(i).padStart(2, '0')}:00`);

/**
 * Resolves padding options from uniform number or ChartPadding object.
 */
export function resolvePadding(
  padLeftOrPadding?: number | ChartPadding,
  restArgs: number[] = []
): { padLeft: number; padRight: number; padTop: number; padBottom: number } {
  if (typeof padLeftOrPadding === 'object' && padLeftOrPadding !== null) {
    return {
      padLeft: padLeftOrPadding.padLeft ?? 0,
      padRight: padLeftOrPadding.padRight ?? 0,
      padTop: padLeftOrPadding.padTop ?? 0,
      padBottom: padLeftOrPadding.padBottom ?? 0
    };
  }
  return {
    padLeft: typeof padLeftOrPadding === 'number' ? padLeftOrPadding : 0,
    padRight: restArgs[0] ?? 0,
    padTop: restArgs[1] ?? 0,
    padBottom: restArgs[2] ?? 0
  };
}

/**
 * Formats minute index (0..1439) as HH:MM time string.
 */
export function formatMinuteToHHMM(minuteIndex: number): string {
  const safeMin = ((Math.floor(minuteIndex) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hh = String(Math.floor(safeMin / 60)).padStart(2, '0');
  const mm = String(safeMin % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Evaluates whether a profile's hourly map contains sub-hourly custom keys (e.g. '00:10', '00:30').
 */
export function hasSubHourlyKeys(hourly: Record<string, number> = {}): boolean {
  return Object.keys(hourly).some((k) => {
    const parts = k.split(':');
    return parts.length === 2 && Number(parts[1]) !== 0;
  });
}

/**
 * Calculates minute-level interpolated point coordinates on a profile chart path.
 */
export function calculateMinutePoint(
  points: { x: number; y: number; val: number; hour: string }[],
  minuteIndex: number,
  minVal: number,
  maxVal: number,
  chartHeight: number,
  padTop: number
) {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, val: 0, hour: '00:00' };
  }

  const safeMin = ((Math.floor(minuteIndex) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hour1 = Math.min(22, Math.floor(safeMin / MINUTES_PER_HOUR));
  const minuteInHour = safeMin - hour1 * MINUTES_PER_HOUR;
  const fraction = Math.min(1, minuteInHour / MINUTES_PER_HOUR);

  const pt1 = points[hour1] || points[0];
  const pt2 = points[hour1 + 1] || pt1;

  const x = pt1.x + fraction * (pt2.x - pt1.x);
  const val = Math.round(pt1.val + fraction * (pt2.val - pt1.val));

  const range = Math.max(1, maxVal - minVal);
  const y = padTop + chartHeight - ((val - minVal) / range) * chartHeight;

  return {
    x,
    y,
    val,
    hour: formatMinuteToHHMM(safeMin)
  };
}

function getInterpolatedValueForMinute(
  timeStr: string,
  minuteIdx: number,
  hourly: Record<string, number>,
  existingMinuteKeys: Array<{ minute: number; val: number }>
): number {
  if (hourly[timeStr] !== undefined) {
    return hourly[timeStr];
  }
  if (existingMinuteKeys.length === 0) {
    return 0;
  }

  let prev = existingMinuteKeys[0];
  let next = existingMinuteKeys.at(-1);

  for (const item of existingMinuteKeys) {
    if (item.minute <= minuteIdx && (prev === undefined || item.minute >= prev.minute)) {
      prev = item;
    }
    if (item.minute >= minuteIdx && (next === undefined || item.minute <= next.minute)) {
      next = item;
    }
  }

  if (!prev && !next) {
    return 0;
  }
  if (!prev) {
    return next!.val;
  }
  if (!next) {
    return prev.val;
  }
  if (prev.minute === next.minute || prev.minute >= minuteIdx) {
    return prev.val;
  }
  if (next.minute <= minuteIdx) {
    return next.val;
  }

  const frac = (minuteIdx - prev.minute) / (next.minute - prev.minute);
  return Math.round(prev.val + frac * (next.val - prev.val));
}

/**
 * Resamples and flattens a profile's hourly map down to strictly 24 hourly anchor points ('00:00' through '23:00').
 */
export function resampleProfileHourly(profile: InternetProfileItem): InternetProfileItem {
  const hourly = profile.hourly || {};
  const existingMinuteKeys = Object.keys(hourly)
    .map((k) => {
      const [h, m] = k.split(':').map(Number);
      return { key: k, minute: (h || 0) * 60 + (m || 0), val: hourly[k] };
    })
    .sort((a, b) => a.minute - b.minute);

  const newHourly: Record<string, number> = {};
  for (let i = 0; i < HOURS_IN_DAY; i++) {
    const minuteIdx = i * 60;
    const timeStr = formatMinuteToHHMM(minuteIdx);
    newHourly[timeStr] = getInterpolatedValueForMinute(timeStr, minuteIdx, hourly, existingMinuteKeys);
  }

  return {
    ...profile,
    hourly: newHourly
  };
}

/**
 * Converts an InternetProfileItem or raw hourly map into a generic TimeSeriesPoint array.
 */
export function convertProfileToTimeSeries(
  profile: InternetProfileItem,
  intervalMinutes: number = 60
): TimeSeriesPoint[] {
  const safeInterval = Math.max(1, Math.min(60, intervalMinutes));
  const totalSteps = Math.floor(PROFILE_SPAN_MINUTES / safeInterval);
  const hourly = profile.hourly || {};

  const existingMinuteKeys = Object.keys(hourly)
    .map((k) => {
      const [h, m] = k.split(':').map(Number);
      return { key: k, minute: (h || 0) * 60 + (m || 0), val: hourly[k] };
    })
    .sort((a, b) => a.minute - b.minute);

  return Array.from({ length: totalSteps + 1 }, (_, i) => {
    const minuteIdx = Math.min(PROFILE_SPAN_MINUTES, i * safeInterval);
    const timeStr = formatMinuteToHHMM(minuteIdx);
    const value = getInterpolatedValueForMinute(timeStr, minuteIdx, hourly, existingMinuteKeys);
    return {
      time: timeStr,
      value,
      label: timeStr
    };
  });
}

/**
 * Calculates Y-axis tick values and Y positions for a given value range and chart dimensions.
 */
export function computeYAxisTicks(
  minVal: number,
  maxVal: number,
  padTop: number,
  chartHeight: number,
  tickRatios: number[] = [0, 0.25, 0.5, 0.75, 1]
): YAxisTick[] {
  return tickRatios.map((ratio) => {
    const val = Math.round(minVal + (maxVal - minVal) * (1 - ratio));
    const y = padTop + chartHeight * ratio;
    const label = val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val);
    return { val, y, label };
  });
}

/**
 * Universal Core Engine: Computes complete chart layout, SVG paths, and points from generic input or profile item.
 */
export function computeChartLayout(
  input: TimeSeriesPoint[] | InternetProfileItem,
  options: ChartOptions
): ChartLayoutResult {
  const { padLeft, padRight, padTop, padBottom } = resolvePadding(options.padding);
  const chartWidth = options.width - padLeft - padRight;
  const chartHeight = options.height - padTop - padBottom;
  const intervalMinutes = options.intervalMinutes ?? 60;

  let timeSeries: TimeSeriesPoint[];
  let hourlyVals: number[] = [];
  let is24HourProfile = false;

  if (Array.isArray(input)) {
    timeSeries = input;
    is24HourProfile = timeSeries.length > 0 && timeSeries.every((pt) => typeof pt.time === 'string' && /^\d{2}:\d{2}$/.test(pt.time));
  } else {
    timeSeries = convertProfileToTimeSeries(input, intervalMinutes);
    hourlyVals = HOURS_OF_DAY.map((h) => input.hourly?.[h] ?? input.daily?.[h] ?? 0);
    is24HourProfile = true;
  }

  const values = timeSeries.map((p) => p.value);
  const minVal = options.minVal ?? 0;

  let maxVal = options.maxVal;
  if (maxVal === undefined) {
    const currentMax = Math.max(...values, ...hourlyVals, 1000);
    maxVal = Math.ceil((currentMax * 1.15) / 500) * 500;
  }

  const totalPoints = Math.max(1, timeSeries.length - 1);

  const points: ChartPoint[] = timeSeries.map((pt, idx) => {
    let minuteIdx = 0;
    let hourStr = '00:00';

    if (typeof pt.time === 'string' && pt.time.includes(':')) {
      const [h, m] = pt.time.split(':').map(Number);
      minuteIdx = (h || 0) * 60 + (m || 0);
      hourStr = pt.time;
    } else if (typeof pt.time === 'number') {
      minuteIdx = pt.time;
      hourStr = formatMinuteToHHMM(minuteIdx);
    } else if (pt.label) {
      hourStr = pt.label;
      minuteIdx = idx;
    } else {
      minuteIdx = idx;
      hourStr = String(idx);
    }

    const ratio = is24HourProfile
      ? minuteIdx / PROFILE_SPAN_MINUTES
      : idx / totalPoints;

    const x = padLeft + ratio * chartWidth;
    const range = Math.max(1, maxVal - minVal);
    const y = padTop + chartHeight - ((pt.value - minVal) / range) * chartHeight;

    return {
      x,
      y,
      val: pt.value,
      hour: hourStr,
      minuteIdx,
      rawTime: pt.time
    };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const lastPoint = points.at(-1) || points[0];
  const areaD = `${pathD} L ${lastPoint.x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`;

  const yTicks = computeYAxisTicks(minVal, maxVal, padTop, chartHeight);

  return {
    points,
    values,
    pathD,
    areaD,
    minVal,
    maxVal,
    chartWidth,
    chartHeight,
    yTicks,
    padLeft,
    padRight,
    padTop,
    padBottom
  };
}

/**
 * Generates reference time points across 00:00 to 23:00 for a given minute interval.
 */
export function generateProfileIntervalPoints(
  profile: InternetProfileItem,
  intervalMinutes: number,
  width: number,
  height: number,
  padding?: ChartPadding
): {
  intervalPoints: Array<{ x: number; y: number; val: number; hour: string; minuteIdx: number }>;
  minVal: number;
  maxVal: number;
  chartWidth: number;
  chartHeight: number;
};
export function generateProfileIntervalPoints(
  profile: InternetProfileItem,
  intervalMinutes: number,
  width: number,
  height: number,
  padLeftOrPadding?: ChartPadding | number,
  ...restPads: number[]
) {
  const pads = resolvePadding(padLeftOrPadding, restPads);
  const layout = computeChartLayout(profile, {
    width,
    height,
    padding: pads,
    intervalMinutes
  });

  return {
    intervalPoints: layout.points,
    minVal: layout.minVal,
    maxVal: layout.maxVal,
    chartWidth: layout.chartWidth,
    chartHeight: layout.chartHeight
  };
}

export function calculateProfileChartData(
  profile: InternetProfileItem,
  width: number,
  height: number,
  padding?: ChartPadding,
  intervalMinutes?: number
): {
  values: number[];
  points: Array<{ x: number; y: number; val: number; hour: string; minuteIdx: number }>;
  pathD: string;
  areaD: string;
  minVal: number;
  maxVal: number;
  chartWidth: number;
  chartHeight: number;
};
export function calculateProfileChartData(
  profile: InternetProfileItem,
  width: number,
  height: number,
  padLeft: number,
  padRight: number,
  padTop: number,
  padBottom: number
): {
  values: number[];
  points: Array<{ x: number; y: number; val: number; hour: string; minuteIdx: number }>;
  pathD: string;
  areaD: string;
  minVal: number;
  maxVal: number;
  chartWidth: number;
  chartHeight: number;
};
export function calculateProfileChartData(
  profile: InternetProfileItem,
  width: number,
  height: number,
  padLeftOrPadding?: ChartPadding | number,
  ...restArgs: number[]
) {
  const pads = resolvePadding(padLeftOrPadding, restArgs);
  const intervalMinutes = typeof padLeftOrPadding === 'object' && padLeftOrPadding !== null
    ? (restArgs[0] ?? 60)
    : (restArgs[3] ?? 60);

  const layout = computeChartLayout(profile, {
    width,
    height,
    padding: pads,
    intervalMinutes
  });

  return {
    values: layout.values,
    points: layout.points,
    pathD: layout.pathD,
    areaD: layout.areaD,
    minVal: layout.minVal,
    maxVal: layout.maxVal,
    chartWidth: layout.chartWidth,
    chartHeight: layout.chartHeight
  };
}

/**
 * Calculates dynamic label step stride so time labels on the X-axis adapt cleanly
 * based on chart pixel width and interval density without crowding or colliding.
 */
export function calculateDynamicLabelStep(
  chartWidth: number,
  totalPoints: number,
  minSpacingPx: number = 50
): number {
  if (totalPoints <= 1 || chartWidth <= 0) return 1;
  const pixelsPerPoint = chartWidth / (totalPoints - 1);
  return Math.max(1, Math.ceil(minSpacingPx / pixelsPerPoint));
}

/**
 * Calculates hour index from a mouse/pointer event X coordinate over the chart width.
 */
export function calculateHourIndexFromX(
  mouseX: number,
  rectWidth: number,
  width: number,
  padLeft: number,
  padRight: number,
  chartWidth: number
): number {
  const relativeX = (mouseX / rectWidth) * width;
  const clampedX = Math.max(padLeft, Math.min(width - padRight, relativeX));
  const ratio = (clampedX - padLeft) / chartWidth;
  return Math.min(23, Math.max(0, Math.round(ratio * (HOURS_OF_DAY.length - 1))));
}

/**
 * Calculates minute index (0..1439) from a mouse/pointer event X coordinate over the chart width.
 */
export function calculateMinuteIndexFromX(
  mouseX: number,
  rectWidth: number,
  width: number,
  padLeft: number,
  padRight: number,
  chartWidth: number
): number {
  const relativeX = (mouseX / rectWidth) * width;
  const clampedX = Math.max(padLeft, Math.min(width - padRight, relativeX));
  const ratio = (clampedX - padLeft) / chartWidth;
  return Math.min(PROFILE_SPAN_MINUTES, Math.max(0, Math.round(ratio * PROFILE_SPAN_MINUTES)));
}

/**
 * Calculates new Y value when dragging a chart point on the interactive profile chart.
 */
export function calculateYValueFromPointer(
  clientY: number,
  rectHeight: number,
  height: number,
  padTop: number,
  chartHeight: number,
  minVal: number,
  maxVal: number
): number {
  const svgY = (clientY / rectHeight) * height;
  const clampedY = Math.max(padTop, Math.min(padTop + chartHeight, svgY));
  const ratio = (padTop + chartHeight - clampedY) / chartHeight;
  const calculatedVal = Math.round(minVal + ratio * (maxVal - minVal));
  return Math.max(10, Math.min(maxVal, calculatedVal));
}

/**
 * Calculates exact hover point data (100% aligned with cursor X position) for traffic profile charts.
 * Returns null if the pointer is outside the valid graph bounds.
 */
export function calculateProfileHoverData(
  relativeX: number,
  relativeY: number,
  rectWidth: number,
  rectHeight: number,
  padLeft: number,
  chartWidth: number,
  points: { x: number; y: number; val: number; hour: string }[]
): ProfileHoverData | null {
  if (
    relativeX < 0 ||
    relativeX > rectWidth ||
    relativeY < 0 ||
    relativeY > rectHeight ||
    rectWidth <= 0 ||
    rectHeight <= 0 ||
    !points ||
    points.length === 0
  ) {
    return null;
  }

  const ratio = Math.max(0, Math.min(1, relativeX / rectWidth));
  const cursorSvgX = padLeft + ratio * chartWidth;

  let closestIndex = 0;
  let minDiff = Infinity;

  for (let i = 0; i < points.length; i++) {
    const diff = Math.abs(points[i].x - cursorSvgX);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }

  const targetPoint = points[closestIndex];
  const totalMinutes = Math.min(PROFILE_SPAN_MINUTES, Math.max(0, Math.round(ratio * PROFILE_SPAN_MINUTES)));

  return {
    x: targetPoint.x,
    y: targetPoint.y,
    val: targetPoint.val,
    hourStr: targetPoint.hour,
    minuteIndex: totalMinutes
  };
}
