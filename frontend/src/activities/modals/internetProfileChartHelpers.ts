export interface InternetProfileItem {
  name: string;
  hourly: Record<string, number>;
  daily?: Record<string, number>;
  timestamp?: number;
}

export const HOURS_OF_DAY = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

/**
 * Formats a minute index (0..1439) into HH:MM format (e.g. 14:35).
 */
export function formatMinuteToHHMM(minuteIndex: number): string {
  const safeMinute = ((Math.floor(minuteIndex) % 1440) + 1440) % 1440;
  const hours = Math.floor(safeMinute / 60);
  const mins = safeMinute % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Linearly interpolates traffic value for a specific minute index (0..1439)
 * based on hourly anchor data points in the connection profile.
 */
export function getInterpolatedProfileTraffic(profile: any, minuteIndex: number): number {
  if (!profile) return 0;
  const safeMinute = ((Math.floor(minuteIndex) % 1440) + 1440) % 1440;
  const h1Index = Math.floor(safeMinute / 60);
  const h2Index = (h1Index + 1) % 24;
  const minuteInHour = safeMinute % 60;
  const t = minuteInHour / 60;

  const h1Key = HOURS_OF_DAY[h1Index];
  const h2Key = HOURS_OF_DAY[h2Index];

  const v1 = profile.hourly?.[h1Key] ?? profile.daily?.[h1Key] ?? 0;
  const v2 = profile.hourly?.[h2Key] ?? profile.daily?.[h2Key] ?? 0;

  return Math.round(v1 + (v2 - v1) * t);
}

/**
 * Calculates exact SVG (x, y) coordinates for an active minute index (0..1439)
 * on a profile curve graph.
 */
export function calculateMinutePoint(
  profile: InternetProfileItem,
  minuteIndex: number,
  width: number,
  height: number,
  padLeft: number,
  padRight: number,
  padTop: number,
  padBottom: number
) {
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const safeMinute = ((Math.floor(minuteIndex) % 1440) + 1440) % 1440;
  const values = HOURS_OF_DAY.map((hour) => profile.hourly?.[hour] ?? profile.daily?.[hour] ?? 0);
  const currentMax = Math.max(...values, 1000);
  const maxVal = Math.ceil((currentMax * 1.15) / 500) * 500;
  const minVal = 0;

  const val = getInterpolatedProfileTraffic(profile, safeMinute);
  const x = padLeft + (safeMinute / 1439) * chartWidth;
  const y = padTop + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;
  const timeStr = formatMinuteToHHMM(safeMinute);

  return { x, y, val, timeStr, safeMinute };
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
  padBottom: number
) {
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const values = HOURS_OF_DAY.map((hour) => profile.hourly?.[hour] ?? 0);
  const currentMax = Math.max(...values, 1000);
  const maxVal = Math.ceil((currentMax * 1.15) / 500) * 500;
  const minVal = 0;

  const points = values.map((val, idx) => {
    const x = padLeft + (idx / (HOURS_OF_DAY.length - 1)) * chartWidth;
    const y = padTop + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;
    return { x, y, val, hour: HOURS_OF_DAY[idx] };
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
