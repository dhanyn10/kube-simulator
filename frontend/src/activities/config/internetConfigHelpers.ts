/**
 * Formats a number with compact units (e.g. 1k, 1.5M).
 *
 * @param num Numeric value to format
 * @returns Formatted compact string
 */
export function formatNumberCompact(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k`;
  return num.toString();
}

/**
 * Calculates dynamic maximum slider range limit based on current traffic.
 *
 * @param currentTraffic Current traffic value
 * @returns Minimum range limit (power of 2 step starting at 1000)
 */
export function calculateMaxTrafficRange(currentTraffic: number): number {
  let limit = 1000;
  while (currentTraffic >= limit) {
    limit *= 2;
  }
  return limit;
}

/**
 * Generates ruler tick marks for the traffic range slider.
 *
 * @param maxRange Maximum range value
 * @returns Array of tick objects containing labels and numerical values
 */
export function generateTrafficRulerTicks(maxRange: number) {
  const step = maxRange / 4;
  return [
    { label: '1', val: 1 },
    { label: formatNumberCompact(Math.round(step * 1)), val: Math.round(step * 1) },
    { label: formatNumberCompact(Math.round(step * 2)), val: Math.round(step * 2) },
    { label: formatNumberCompact(Math.round(step * 3)), val: Math.round(step * 3) },
    { label: formatNumberCompact(maxRange), val: maxRange }
  ];
}

/**
 * Checks whether an Internet node connection is disconnected or in an error state.
 *
 * @param nodeId ID of the Internet node
 * @param edges Array of current flow edges
 * @param nodes Array of current flow nodes
 * @returns True if disconnected or downstream workloads are unready/errored
 */
export function isInternetConnectionRed(
  nodeId: string | number,
  edges: any[],
  nodes: any[]
): boolean {
  const outgoingEdges = edges.filter((e) => String(e.source) === String(nodeId));
  if (outgoingEdges.length === 0) return true;
  const hasEdgeError = outgoingEdges.some((e) => e.data?.validationError);
  if (hasEdgeError) return true;
  const targets = outgoingEdges.map((e) => nodes.find((n) => String(n.id) === String(e.target)));
  return targets.some(
    (t) => !t || ((t.type === 'Pod' || t.type === 'Deployment') && t.data?.status !== 'ready')
  );
}
