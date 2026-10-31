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
  return nodes.some(node =>
    (node.type === 'Pod' || node.type === 'Deployment' || node.type === 'ReplicaSet') &&
    isServiceSelectorMatching(serviceNode, node)
  );
};

/**
 * Checks if an Ingress resource points to a valid ClusterIP Service on the canvas.
 */
export const hasValidIngressBackend = (ingressNode: Node, nodes: Node[], edgeMap?: Map<string, Edge[]>): boolean => {
  const outgoing = edgeMap?.get(ingressNode.id) || [];
  for (const edge of outgoing) {
    const target = nodes.find(node => node.id === edge.target);
    if (target?.type === 'Service' && (target?.data?.serviceType || 'ClusterIP') === 'ClusterIP') {
      return true;
    }
  }
  if (Array.isArray(ingressNode.data?.ingressPaths) && ingressNode.data.ingressPaths.length > 0) {
    const hasValidRule = ingressNode.data.ingressPaths.some((rule: any) =>
      nodes.some(node =>
        node.type === 'Service' &&
        (node.data?.serviceType || 'ClusterIP') === 'ClusterIP' &&
        (node.data?.label === rule.serviceName || node.data?.selector === rule.serviceName)
      )
    );
    if (hasValidRule) return true;
  }
  const backendName = ingressNode.data?.backendServiceName || ingressNode.data?.serviceName;
  if (backendName) {
    return nodes.some(node =>
      node.type === 'Service' &&
      (node.data?.serviceType || 'ClusterIP') === 'ClusterIP' &&
      (node.data?.label === backendName || node.data?.selector === backendName)
    );
  }
  return false;
};

const isServiceValidForProcessing = (
  currentNode: Node,
  currentId: string,
  nodes: Node[],
  edgeMap: Map<string, Edge[]>
): boolean => {
  if (currentNode.type !== 'Service') return true;
  const serviceType = currentNode.data?.serviceType || 'ClusterIP';
  if (serviceType === 'NodePort') return true;

  const hasWorkloadTarget = hasValidServiceSelectorTarget(currentNode, nodes);
  const outgoing = edgeMap.get(currentId) || [];
  const hasIngressTarget = outgoing.some(edge => {
    const targetNode = nodes.find(node => node.id === edge.target);
    return targetNode?.type === 'Ingress';
  });

  return hasWorkloadTarget || hasIngressTarget;
};

const enqueueDynamicServiceTargets = (
  currentNode: Node,
  nodes: Node[] | undefined,
  queue: string[]
) => {
  if (currentNode.type !== 'Service' || !nodes) return;
  const selectorTargets = nodes.filter(node =>
    (node.type === 'Pod' || node.type === 'Deployment' || node.type === 'ReplicaSet') &&
    isServiceSelectorMatching(currentNode, node)
  );
  for (const target of selectorTargets) {
    queue.push(String(target.id));
  }
};

const getIngressTargetServiceNames = (currentNode: Node): Set<string> => {
  const names = new Set<string>();
  const backendName = currentNode.data?.backendServiceName || currentNode.data?.serviceName;
  if (typeof backendName === 'string' && backendName) {
    names.add(backendName);
  }
  if (Array.isArray(currentNode.data?.ingressPaths)) {
    for (const rule of currentNode.data.ingressPaths) {
      if (rule?.serviceName) {
        names.add(String(rule.serviceName));
      }
    }
  }
  return names;
};

const enqueueDynamicIngressTargets = (
  currentNode: Node,
  nodes: Node[] | undefined,
  queue: string[]
) => {
  if (currentNode.type !== 'Ingress' || !nodes) return;
  const targetServiceNames = getIngressTargetServiceNames(currentNode);
  if (targetServiceNames.size === 0) return;

  const backendServices = nodes.filter(node =>
    node.type === 'Service' &&
    (node.data?.serviceType || 'ClusterIP') === 'ClusterIP' &&
    targetServiceNames.has(String(node.data?.label || ''))
  );
  for (const service of backendServices) {
    queue.push(String(service.id));
  }
};

const processOutgoingEdges = (
  currentId: string,
  edgeMap: Map<string, Edge[]>,
  activeEdgesSet: Set<string>,
  queue: string[],
  nodes?: Node[]
) => {
  const currentNode = nodes?.find(node => node.id === currentId);

  if (currentNode && nodes) {
    if (!isServiceValidForProcessing(currentNode, currentId, nodes, edgeMap)) {
      return;
    }
    if (currentNode.type === 'Ingress' && !hasValidIngressBackend(currentNode, nodes, edgeMap)) {
      return;
    }
  }

  const outgoing = edgeMap.get(currentId);
  if (outgoing) {
    for (const edge of outgoing) {
      if (activeEdgesSet.has(String(edge.id)) && !edge.data?.validationError) {
        queue.push(String(edge.target));
      }
    }
  }

  if (currentNode) {
    enqueueDynamicServiceTargets(currentNode, nodes, queue);
    enqueueDynamicIngressTargets(currentNode, nodes, queue);
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
  const queue = startNodes.map(node => node.id);
  const activeEdgesSet = activeSimulationEdges instanceof Set
    ? activeSimulationEdges
    : new Set(activeSimulationEdges);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (reachableNodes.has(currentId)) continue;
    reachableNodes.add(currentId);

    processOutgoingEdges(currentId, edgeMap, activeEdgesSet, queue, allNodes);
  }
  return reachableNodes;
};

const checkNodeUnreadyInternal = (node: Node | undefined, nodes: Node[]): boolean => {
  if (!node) return true;
  const isWorkload = node.type === 'Pod' || node.type === 'Deployment' || node.type === 'ReplicaSet';
  if (isWorkload && node.data?.status !== 'ready') return true;

  if (node?.type === 'Service') {
    const serviceType = node?.data?.serviceType || 'ClusterIP';
    const outgoing = nodes.filter(n =>
      (n.type === 'Pod' || n.type === 'Deployment' || n.type === 'ReplicaSet') &&
      isServiceSelectorMatching(node, n)
    );
    const hasIngressTarget = nodes.some(n => n.type === 'Ingress');
    if (outgoing.length === 0 && !hasIngressTarget && serviceType !== 'NodePort') {
      return true;
    }
  }

  if (node?.type === 'Ingress') {
    if (!hasValidIngressBackend(node, nodes)) {
      return true;
    }
  }

  if (node?.type === 'Deployment') {
    const childPods = nodes.filter((n) => (String(n.parentId) === String(node.id) || String(n.data?.parentId) === String(node.id)) && n.type === 'Pod');
    if (childPods.some((pod) => pod.data?.status !== 'ready')) return true;
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

    const downstreamEdges = (ctx.edgeMap?.get(currentId) || []).filter(edge =>
      activeEdgesSet.size === 0 || activeEdgesSet.has(String(edge.id))
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
