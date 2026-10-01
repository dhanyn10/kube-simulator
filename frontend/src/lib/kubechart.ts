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
}

export interface ProfileIntervalOption {
  label: string;
  minutes: number;
}

export const PROFILE_INTERVAL_OPTIONS: ProfileIntervalOption[] = [
  { label: '1 Jam', minutes: 60 },
  { label: '30 Menit', minutes: 30 },
  { label: '10 Menit', minutes: 10 },
  { label: '5 Menit', minutes: 5 },
  { label: '1 Menit', minutes: 1 },
];

export const MINUTES_PER_HOUR = 60;
export const HOURS_IN_DAY = 24;
export const MINUTES_IN_DAY = HOURS_IN_DAY * MINUTES_PER_HOUR; // 1440
export const PROFILE_HOURLY_INTERVALS = 23;
export const PROFILE_SPAN_MINUTES = PROFILE_HOURLY_INTERVALS * MINUTES_PER_HOUR; // 1380 minutes (00:00 to 23:00)

export const HOURS_OF_DAY = Array.from({ length: HOURS_IN_DAY }, (_, i) => `${String(i).padStart(2, '0')}:00`);

/**
 * Checks if a profile has sub-hourly custom keys (e.g. "00:30", "00:05").
 */
export function hasSubHourlyKeys(profile: InternetProfileItem): boolean {
  if (!profile || !profile.hourly) return false;
  const standardKeys = new Set(HOURS_OF_DAY);
  return Object.keys(profile.hourly).some((key) => !standardKeys.has(key));
}

/**
 * Resamples a profile's hourly map to standard points corresponding to targetIntervalMinutes.
 * E.g., for 60m interval, retains only the 24 hourly keys calculated via getInterpolatedProfileTraffic.
 */
export function resampleProfileHourly(
  profile: InternetProfileItem,
  targetIntervalMinutes: number
): Record<string, number> {
  const result: Record<string, number> = {};
  const step = Math.max(1, targetIntervalMinutes);
  for (let min = 0; min <= PROFILE_SPAN_MINUTES; min += step) {
    const key = formatMinuteToHHMM(min);
    result[key] = getInterpolatedProfileTraffic(profile, min);
  }
  return result;
}

/**
 * Calculates linear interpolated traffic for a given minute index (0..1439).
 * Supports both standard hourly profile keys ("00:00", "01:00", ...) and sub-hourly keys ("00:30", "00:10", etc.).
 */
export function getInterpolatedProfileTraffic(profile: InternetProfileItem | any, minuteIndex: number): number {
  if (!profile) return 1000;
  const safeMinute = ((Math.floor(minuteIndex) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hourlyData = profile.hourly || profile.daily || {};

  const sortedKeys = Object.keys(hourlyData)
    .filter((k) => /^\d{2}:\d{2}$/.test(k))
    .map((k) => {
      const [h, m] = k.split(':').map(Number);
      return { key: k, minute: h * 60 + m, val: hourlyData[k] };
    })
    .sort((a, b) => a.minute - b.minute);

  if (sortedKeys.length === 0) return 1000;
  if (sortedKeys.length === 1) return sortedKeys[0].val;

  const exact = sortedKeys.find((k) => k.minute === safeMinute);
  if (exact !== undefined) return exact.val;

  let prev = sortedKeys[sortedKeys.length - 1];
  let next = sortedKeys[0];

  for (let i = 0; i < sortedKeys.length; i++) {
    if (sortedKeys[i].minute <= safeMinute) {
      prev = sortedKeys[i];
    }
    if (sortedKeys[i].minute >= safeMinute) {
      next = sortedKeys[i];
      break;
    }
  }

  if (prev.minute === next.minute) return prev.val;

  let span = next.minute - prev.minute;
  let offset = safeMinute - prev.minute;
  if (span < 0) {
    span += MINUTES_IN_DAY;
  }
  if (offset < 0) {
    offset += MINUTES_IN_DAY;
  }

  const fraction = offset / span;
  return Math.round(prev.val + fraction * (next.val - prev.val));
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
 * Calculates minute-level interpolated point coordinates on a profile chart path.
 */
export function calculateMinutePoint(
  points: { x: number; y: number; val: number; hour: string }[],
  minuteIndex: number,
  minVal: number,
  maxVal: number,
  chartHeight: number,
  padTop: number,
  profile?: InternetProfileItem,
  panOffsetMin: number = 0,
  visibleSpan: number = PROFILE_SPAN_MINUTES
) {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, val: 0, hour: '00:00' };
  }

  const safeMin = ((Math.floor(minuteIndex) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const rawRatio = (safeMin - panOffsetMin) / visibleSpan;
  const ratio = Math.min(1, Math.max(0, rawRatio));

  const padLeft = points[0].x;
  const lastPoint = points.at(-1) || points[0];
  const chartWidth = lastPoint.x - padLeft;
  const x = padLeft + ratio * chartWidth;

  const val = profile ? getInterpolatedProfileTraffic(profile, safeMin) : (() => {
    const hour1 = Math.min(22, Math.floor(safeMin / MINUTES_PER_HOUR));
    const minuteInHour = safeMin - hour1 * MINUTES_PER_HOUR;
    const fraction = Math.min(1, minuteInHour / MINUTES_PER_HOUR);
    const pt1 = points[hour1] || points[0];
    const pt2 = points[hour1 + 1] || pt1;
    return Math.round(pt1.val + fraction * (pt2.val - pt1.val));
  })();

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
export function calculateProfileChartData(
  profile: InternetProfileItem,
  width: number,
  height: number,
  padLeft: number,
  padRight: number,
  padTop: number,
  padBottom: number,
  panOffsetMin: number = 0,
  visibleSpan: number = PROFILE_SPAN_MINUTES
) {
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const allKeys = Object.keys(profile.hourly || profile.daily || {});
  const hourlyValues = HOURS_OF_DAY.map((hour) => profile.hourly?.[hour] ?? 0);
  const allValues = allKeys.length > 0 ? allKeys.map((k) => profile.hourly?.[k] ?? 0) : hourlyValues;

  const currentMax = Math.max(...allValues, ...hourlyValues, 1000);
  const maxVal = Math.ceil((currentMax * 1.15) / 500) * 500;
  const minVal = 0;

  const points = HOURS_OF_DAY.map((hour, idx) => {
    const minIndex = idx * 60;
    const val = profile.hourly?.[hour] ?? getInterpolatedProfileTraffic(profile, minIndex);
    const ratio = (minIndex - panOffsetMin) / visibleSpan;
    const x = padLeft + ratio * chartWidth;
    const y = padTop + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;
    return { x, y, val, hour };
  });

  // Dynamic X Axis Ticks based on visibleSpan minutes
  let tickStepMin = 180; // Default 3 hours
  if (visibleSpan <= 120) {
    tickStepMin = 10;
  } else if (visibleSpan <= 360) {
    tickStepMin = 30;
  } else if (visibleSpan <= 720) {
    tickStepMin = 60;
  }

  const dynamicTicks: { x: number; label: string }[] = [];
  const startTick = Math.floor(panOffsetMin / tickStepMin) * tickStepMin;
  const endTick = panOffsetMin + visibleSpan;

  for (let min = startTick; min <= endTick + tickStepMin; min += tickStepMin) {
    if (min >= 0 && min <= PROFILE_SPAN_MINUTES) {
      const ratio = (min - panOffsetMin) / visibleSpan;
      const x = padLeft + ratio * chartWidth;
      if (x >= padLeft - 20 && x <= padLeft + chartWidth + 20) {
        dynamicTicks.push({ x, label: formatMinuteToHHMM(min) });
      }
    }
  }

  // Sample smooth path across visible window
  const sampleStep = Math.max(1, Math.floor(visibleSpan / 300));
  const pathPoints: { x: number; y: number }[] = [];

  for (let min = 0; min <= PROFILE_SPAN_MINUTES; min += sampleStep) {
    const ratio = (min - panOffsetMin) / visibleSpan;
    const x = padLeft + ratio * chartWidth;
    const val = getInterpolatedProfileTraffic(profile, min);
    const y = padTop + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;
    pathPoints.push({ x, y });
  }

  const pathD = pathPoints.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const lastPoint = pathPoints.at(-1) || { x: padLeft + chartWidth, y: padTop + chartHeight };
  const areaD = `${pathD} L ${lastPoint.x} ${padTop + chartHeight} L ${pathPoints[0].x} ${padTop + chartHeight} Z`;

  return {
    values: hourlyValues,
    points,
    dynamicTicks,
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
  points: { x: number; y: number; val: number; hour: string }[],
  intervalMinutes: number = 60,
  profile?: InternetProfileItem,
  minVal?: number,
  maxVal?: number,
  chartHeight?: number,
  padTop?: number,
  panOffsetMin: number = 0,
  visibleSpan: number = PROFILE_SPAN_MINUTES
): ProfileHoverData | null {
  if (
    relativeX < 0 ||
    relativeX > rectWidth ||
    relativeY < 0 ||
    relativeY > rectHeight ||
    rectWidth <= 0 ||
    rectHeight <= 0
  ) {
    return null;
  }

  const rawRatio = Math.max(0, Math.min(1, relativeX / rectWidth));
  const rawMinutes = panOffsetMin + rawRatio * visibleSpan;

  // Snap raw minutes to nearest step based on intervalMinutes
  const step = Math.max(1, intervalMinutes);
  const snappedMinutes = Math.min(PROFILE_SPAN_MINUTES, Math.max(0, Math.round(rawMinutes / step) * step));
  const snappedRatio = (snappedMinutes - panOffsetMin) / visibleSpan;

  const cursorSvgX = padLeft + snappedRatio * chartWidth;

  let hoverY = 0;
  let hoverVal = 0;

  if (profile && typeof minVal === 'number' && typeof maxVal === 'number' && typeof chartHeight === 'number' && typeof padTop === 'number') {
    hoverVal = getInterpolatedProfileTraffic(profile, snappedMinutes);
    const range = Math.max(1, maxVal - minVal);
    hoverY = padTop + chartHeight - ((hoverVal - minVal) / range) * chartHeight;
  } else {
    const exactIdx = snappedRatio * PROFILE_HOURLY_INTERVALS;
    const segIdx = Math.min(PROFILE_HOURLY_INTERVALS - 1, Math.floor(exactIdx));
    const segFraction = exactIdx - segIdx;

    const pt1 = points[segIdx] || points[0];
    const pt2 = points[segIdx + 1] || pt1;

    hoverY = pt1 ? pt1.y + segFraction * (pt2.y - pt1.y) : 0;
    hoverVal = pt1 ? Math.round(pt1.val + segFraction * (pt2.val - pt1.val)) : 0;
  }

  const hourStr = formatMinuteToHHMM(snappedMinutes);

  return {
    x: cursorSvgX,
    y: hoverY,
    val: hoverVal,
    hourStr,
    minuteIndex: snappedMinutes
  };
}
