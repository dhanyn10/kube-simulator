import { Edge, Node } from '@xyflow/react';
import { isInternetConnectionUnhealthy } from '@/lib/simulationReachability';

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

const buildEdgeMap = (edges: any[]): Map<string, Edge[]> => {
  const edgeMap = new Map<string, Edge[]>();
  for (const edge of edges) {
    const source = String(edge.source);
    const outgoing = edgeMap.get(source) || [];
    outgoing.push(edge as Edge);
    edgeMap.set(source, outgoing);
  }
  return edgeMap;
};

/**
 * Checks whether an Internet node connection is disconnected or in an error state.
 * Uses the same multi-hop health rules as the simulation engine.
 *
 * @param nodeId ID of the Internet node
 * @param edges Array of current flow edges
 * @param nodes Array of current flow nodes
 * @param activeSimulationEdges Edge IDs currently carrying simulated traffic
 * @returns True if disconnected or downstream workloads are unready/errored
 */
export function isInternetConnectionRed(
  nodeId: string | number,
  edges: any[],
  nodes: any[],
  activeSimulationEdges?: string[]
): boolean {
  const graphNodes = nodes as Node[];
  const internet = graphNodes.find((node) => String(node.id) === String(nodeId)) || ({
    id: String(nodeId),
    type: 'Internet',
    position: { x: 0, y: 0 },
    data: {},
  } as Node);
  return isInternetConnectionUnhealthy(
    internet,
    { nodes: graphNodes, edgeMap: buildEdgeMap(edges) },
    activeSimulationEdges
  );
}
