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
 * Formats minute index (0..1439) as HH:MM time string.
 */
export function formatMinuteToHHMM(minuteIndex: number): string {
  const safeMin = ((Math.floor(minuteIndex) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hh = String(Math.floor(safeMin / 60)).padStart(2, '0');
  const mm = String(safeMin % 60).padStart(2, '0');
  return `${hh}:${mm}`;
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

/**
 * Calculates point coordinates and SVG path data for traffic profile charts.
 *
 * @param profile Internet profile item containing hourly values
 * @param width SVG width
 * @param height SVG height
 * @param padLeft Left padding
 * @param padRight Right padding
 * @param padTop Top padding
 * @param padBottom Bottom padding
 * @returns Chart point objects, SVG paths, and min/max value bounds
 */
/**
 * Generates reference time points across 00:00 to 23:00 for a given minute interval.
 */
export function generateProfileIntervalPoints(
  profile: InternetProfileItem,
  intervalMinutes: number,
  width: number,
  height: number,
  padLeft: number,
  padRight: number,
  padTop: number,
  padBottom: number
) {
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const totalSteps = Math.floor(PROFILE_SPAN_MINUTES / intervalMinutes);
  const allValues: number[] = [];

  const points = Array.from({ length: totalSteps + 1 }, (_, i) => {
    const minuteIdx = Math.min(PROFILE_SPAN_MINUTES, i * intervalMinutes);
    const timeStr = formatMinuteToHHMM(minuteIdx);

    let val = 0;
    if (profile.hourly?.[timeStr] !== undefined) {
      val = profile.hourly[timeStr];
    } else {
      // Interpolate from nearest profile hourly anchor points
      const h1 = Math.min(22, Math.floor(minuteIdx / 60));
      const mInH = minuteIdx - h1 * 60;
      const frac = mInH / 60;
      const k1 = formatMinuteToHHMM(h1 * 60);
      const k2 = formatMinuteToHHMM((h1 + 1) * 60);
      const v1 = profile.hourly?.[k1] ?? 0;
      const v2 = profile.hourly?.[k2] ?? v1;
      val = Math.round(v1 + frac * (v2 - v1));
    }
    allValues.push(val);
    return { minuteIdx, timeStr, val };
  });

  const hourlyVals = HOURS_OF_DAY.map((h) => profile.hourly?.[h] ?? 0);
  const currentMax = Math.max(...allValues, ...hourlyVals, 1000);
  const maxVal = Math.ceil((currentMax * 1.15) / 500) * 500;
  const minVal = 0;

  const mappedPoints = points.map((pt) => {
    const x = padLeft + (pt.minuteIdx / PROFILE_SPAN_MINUTES) * chartWidth;
    const y = padTop + chartHeight - ((pt.val - minVal) / Math.max(1, maxVal - minVal)) * chartHeight;
    return {
      x,
      y,
      val: pt.val,
      hour: pt.timeStr,
      minuteIdx: pt.minuteIdx
    };
  });

  return {
    intervalPoints: mappedPoints,
    minVal,
    maxVal,
    chartWidth,
    chartHeight
  };
}

export function calculateProfileChartData(
  profile: InternetProfileItem,
  width: number,
  height: number,
  padLeft: number,
  padRight: number,
  padTop: number,
  padBottom: number,
  intervalMinutes: number = 60
) {
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const safeInterval = Math.max(1, Math.min(60, intervalMinutes));
  const totalSteps = Math.floor(PROFILE_SPAN_MINUTES / safeInterval);

  const rawPoints = Array.from({ length: totalSteps + 1 }, (_, i) => {
    const minuteIdx = Math.min(PROFILE_SPAN_MINUTES, i * safeInterval);
    const timeStr = formatMinuteToHHMM(minuteIdx);

    let val = 0;
    if (profile.hourly?.[timeStr] !== undefined) {
      val = profile.hourly[timeStr];
    } else {
      // Interpolate value from nearest hourly keys if exact minute key is omitted
      const h1 = Math.min(22, Math.floor(minuteIdx / 60));
      const mInH = minuteIdx - h1 * 60;
      const frac = mInH / 60;
      const k1 = formatMinuteToHHMM(h1 * 60);
      const k2 = formatMinuteToHHMM((h1 + 1) * 60);
      const v1 = profile.hourly?.[k1] ?? 0;
      const v2 = profile.hourly?.[k2] ?? v1;
      val = Math.round(v1 + frac * (v2 - v1));
    }

    return { minuteIdx, hour: timeStr, val };
  });

  const values = rawPoints.map((p) => p.val);
  const hourlyVals = HOURS_OF_DAY.map((h) => profile.hourly?.[h] ?? 0);
  const currentMax = Math.max(...values, ...hourlyVals, 1000);
  const maxVal = Math.ceil((currentMax * 1.15) / 500) * 500;
  const minVal = 0;

  const points = rawPoints.map((pt) => {
    const x = padLeft + (pt.minuteIdx / PROFILE_SPAN_MINUTES) * chartWidth;
    const range = Math.max(1, maxVal - minVal);
    const y = padTop + chartHeight - ((pt.val - minVal) / range) * chartHeight;
    return {
      x,
      y,
      val: pt.val,
      hour: pt.hour,
      minuteIdx: pt.minuteIdx
    };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const lastPoint = points.at(-1) || points[0];
  const areaD = `${pathD} L ${lastPoint.x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`;

  return {
    values,
    points,
    pathD,
    areaD,
    minVal,
    maxVal,
    chartWidth,
    chartHeight
  };
}

/**
 * Calculates hour index from a mouse/pointer event X coordinate over the chart width.
 *
 * @param mouseX Relative mouse X position inside the SVG element
 * @param rectWidth Rendered SVG bounding box width
 * @param width Chart internal coordinate width
 * @param padLeft Left padding
 * @param padRight Right padding
 * @param chartWidth Calculated inner chart width
 * @returns Clamped hour index (0 to 23)
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
 *
 * @param mouseX Relative mouse X position inside the SVG element
 * @param rectWidth Rendered SVG bounding box width
 * @param width Chart internal coordinate width
 * @param padLeft Left padding
 * @param padRight Right padding
 * @param chartWidth Calculated inner chart width
 * @returns Clamped minute index (0 to 1439)
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
 *
 * @param clientY Relative mouse/pointer Y position inside the SVG element
 * @param rectHeight Rendered SVG bounding box height
 * @param height Chart internal coordinate height
 * @param padTop Top padding
 * @param chartHeight Calculated inner chart height
 * @param minVal Minimum bound value
 * @param maxVal Maximum bound value
 * @returns Clamped integer traffic value
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

  // Find closest point in points array
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
