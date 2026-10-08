import { Node, Edge } from '@xyflow/react';
import { SimulationContext } from './simulationTypes';

/**
 * Helper to check if a Service's selector matches a target workload's label.
 */
export const isServiceSelectorMatching = (serviceNode: Node, workloadNode: Node): boolean => {
  const selector = serviceNode.data?.selector;
  if (!selector || typeof selector !== 'string' || selector.trim() === '') {
    return false;
  }
  const targetLabel = workloadNode.data?.label || workloadNode.data?.baseName;
  const matchLabels = workloadNode.data?.labels?.app;
  return targetLabel === selector || matchLabels === selector;
};

/**
 * Checks if a Service has at least one matching workload (Pod or Deployment) on the canvas.
 */
export const hasValidServiceSelectorTarget = (serviceNode: Node, nodes: Node[]): boolean => {
  const selector = serviceNode.data?.selector;
  if (!selector || typeof selector !== 'string' || selector.trim() === '') {
    return false;
  }
  return nodes.some(n =>
    (n.type === 'Pod' || n.type === 'Deployment' || n.type === 'ReplicaSet') &&
    isServiceSelectorMatching(serviceNode, n)
  );
};

/**
 * Checks if an Ingress resource points to a valid ClusterIP Service on the canvas.
 */
export const hasValidIngressBackend = (ingressNode: Node, nodes: Node[], edgeMap?: Map<string, Edge[]>): boolean => {
  const outgoing = edgeMap?.get(ingressNode.id) || [];
  for (const e of outgoing) {
    const target = nodes.find(n => n.id === e.target);
    if (target && target.type === 'Service' && (target.data?.serviceType || 'ClusterIP') === 'ClusterIP') {
      return true;
    }
  }
  const backendName = ingressNode.data?.backendServiceName || ingressNode.data?.serviceName;
  if (backendName) {
    return nodes.some(n =>
      n.type === 'Service' &&
      (n.data?.serviceType || 'ClusterIP') === 'ClusterIP' &&
      (n.data?.label === backendName || n.data?.selector === backendName)
    );
  }
  return false;
};

const isServiceValidForProcessing = (
  currNode: Node,
  currId: string,
  nodes: Node[] | undefined,
  edgeMap: Map<string, Edge[]>
): boolean => {
  if (currNode.type !== 'Service') return true;
  const sType = currNode.data?.serviceType || 'ClusterIP';
  if (sType === 'NodePort') return true;

  const hasWorkloadTarget = hasValidServiceSelectorTarget(currNode, nodes || []);
  const outgoing = edgeMap.get(currId) || [];
  const hasIngressTarget = outgoing.some(e => {
    const t = nodes?.find(n => n.id === e.target);
    return t && t.type === 'Ingress';
  });

  return hasWorkloadTarget || hasIngressTarget;
};

const enqueueDynamicServiceTargets = (
  currNode: Node,
  nodes: Node[] | undefined,
  queue: string[]
) => {
  if (currNode.type !== 'Service' || !nodes) return;
  const selectorTargets = nodes.filter(n =>
    (n.type === 'Pod' || n.type === 'Deployment' || n.type === 'ReplicaSet') &&
    isServiceSelectorMatching(currNode, n)
  );
  for (const target of selectorTargets) {
    queue.push(String(target.id));
  }
};

const enqueueDynamicIngressTargets = (
  currNode: Node,
  nodes: Node[] | undefined,
  queue: string[]
) => {
  if (currNode.type !== 'Ingress' || !nodes) return;
  const backendName = currNode.data?.backendServiceName || currNode.data?.serviceName;
  if (!backendName) return;

  const backendServices = nodes.filter(n =>
    n.type === 'Service' &&
    (n.data?.serviceType || 'ClusterIP') === 'ClusterIP' &&
    n.data?.label === backendName
  );
  for (const svc of backendServices) {
    queue.push(String(svc.id));
  }
};

const processOutgoingEdges = (
  currId: string,
  edgeMap: Map<string, Edge[]>,
  activeEdgesSet: Set<string>,
  queue: string[],
  nodes?: Node[]
) => {
  const currNode = nodes?.find(n => n.id === currId);

  if (currNode) {
    if (!isServiceValidForProcessing(currNode, currId, nodes, edgeMap)) {
      return;
    }
    if (currNode.type === 'Ingress' && !hasValidIngressBackend(currNode, nodes || [], edgeMap)) {
      return;
    }
  }

  const outgoing = edgeMap.get(currId);
  if (outgoing) {
    for (const e of outgoing) {
      if (activeEdgesSet.has(String(e.id)) && !e.data?.validationError) {
        queue.push(String(e.target));
      }
    }
  }

  if (currNode) {
    enqueueDynamicServiceTargets(currNode, nodes, queue);
    enqueueDynamicIngressTargets(currNode, nodes, queue);
  }
};

/**
 * Traverses active non-error edges starting from entry nodes to determine reachable target node IDs.
 */
export const calculateReachability = (
  startNodes: Node[],
  edgeMap: Map<string, Edge[]>,
  activeSimulationEdges: string[] | Set<string>,
  allNodes?: Node[]
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

    processOutgoingEdges(currId, edgeMap, activeEdgesSet, queue, allNodes);
  }
  return reachableNodes;
};

const checkNodeUnreadyInternal = (node: Node | undefined, nodes: Node[]): boolean => {
  if (!node) return true;
  const isWorkload = node.type === 'Pod' || node.type === 'Deployment' || node.type === 'ReplicaSet';
  if (isWorkload && node.data?.status !== 'ready') return true;

  if (node.type === 'Service') {
    const sType = node.data?.serviceType || 'ClusterIP';
    const outgoing = nodes.filter(n =>
      (n.type === 'Pod' || n.type === 'Deployment' || n.type === 'ReplicaSet') &&
      isServiceSelectorMatching(node, n)
    );
    const hasIngressTarget = nodes.some(n => n.type === 'Ingress');
    if (outgoing.length === 0 && !hasIngressTarget && sType !== 'NodePort') {
      return true;
    }
  }

  if (node.type === 'Ingress') {
    if (!hasValidIngressBackend(node, nodes)) {
      return true;
    }
  }

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
