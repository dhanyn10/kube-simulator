import { Node, Edge } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { SimulationContext } from './simulationTypes';

const processOutgoingEdges = (
  currId: string,
  edgeMap: Map<string, Edge[]>,
  activeEdgesSet: Set<string>,
  queue: string[]
) => {
  const outgoing = edgeMap.get(currId);
  if (!outgoing) return;

  for (const e of outgoing) {
    if (activeEdgesSet.has(String(e.id)) && !e.data?.validationError) {
      queue.push(String(e.target));
    }
  }
};

/**
 * Traverses active non-error edges starting from entry nodes to determine reachable target node IDs.
 */
export const calculateReachability = (
  startNodes: Node[],
  edgeMap: Map<string, Edge[]>,
  activeSimulationEdges: string[] | Set<string>
): Set<string> => {
  const reachableNodes = new Set<string>();
  const queue = startNodes.map(n => n.id);
  const activeEdgesSet = activeSimulationEdges instanceof Set
    ? activeSimulationEdges
    : new Set(activeSimulationEdges);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (reachableNodes.has(currId)) continue;
    reachableNodes.add(currId);

    processOutgoingEdges(currId, edgeMap, activeEdgesSet, queue);
  }
  return reachableNodes;
};

const checkNodeUnreadyInternal = (node: Node | undefined, nodes: Node[]): boolean => {
  if (!node) return true;
  const isWorkload = node.type === 'Pod' || node.type === 'Deployment' || node.type === 'ReplicaSet';
  if (isWorkload && node.data?.status !== 'ready') return true;

  if (node.type === 'Deployment') {
    const childPods = nodes.filter((n) => (String(n.parentId) === String(node.id) || String(n.data?.parentId) === String(node.id)) && n.type === 'Pod');
    if (childPods.some((p) => p.data?.status !== 'ready')) return true;
  }
  return false;
};

/**
 * Traverses downstream paths starting from target ID to detect unready nodes or edge validation errors.
 */
const hasUnreadyDownstreamPath = (
  startTargetId: string,
  ctx: SimulationContext,
  activeEdgesSet: Set<string>
): boolean => {
  const visited = new Set<string>();
  const queue = [startTargetId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = ctx.nodeMap?.get(currentId) || ctx.nodes.find(n => String(n.id) === currentId);
    if (checkNodeUnreadyInternal(node, ctx.nodes)) {
      return true;
    }

    const downstreamEdges = (ctx.edgeMap?.get(currentId) || []).filter(e =>
      activeEdgesSet.size === 0 || activeEdgesSet.has(String(e.id))
    );

    for (const downEdge of downstreamEdges) {
      if (downEdge.data?.validationError) return true;
      queue.push(String(downEdge.target));
    }
  }

  return false;
};

/**
 * Checks if outgoing edges from internet node or downstream workload paths have validation errors or unready nodes.
 */
export const isInternetConnectionRed = (internet: Node, ctx: SimulationContext): boolean => {
  const outgoing = ctx.edgeMap?.get(internet.id) || [];
  if (outgoing.length === 0) return true;

  const activeEdgesSet = new Set(ctx.activeSimulationEdges);

  for (const edge of outgoing) {
    if (edge.data?.validationError) return true;
    if (hasUnreadyDownstreamPath(String(edge.target), ctx, activeEdgesSet)) {
      return true;
    }
  }

  return false;
};
