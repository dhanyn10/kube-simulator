export interface InternetProfileItem {
  name: string;
  hourly: Record<string, number>;
  daily?: Record<string, number>;
  timestamp?: number;
}

export const HOURS_OF_DAY = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

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
