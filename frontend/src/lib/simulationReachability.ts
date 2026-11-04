import { Node, Edge } from '@xyflow/react';
import { SimulationContext } from './simulationTypes';
import { getAssignedWorker } from './workerNodeHelpers';
import { resolveNodeNamespace } from './namespaceUtils';

/**
 * Helper to check if a Service's selector matches a target workload's label.
 * Enforces intra-namespace matching for non-LoadBalancer services.
 */
export const isServiceSelectorMatching = (
  serviceNode: Node,
  workloadNode: Node,
  nodes?: Node[]
): boolean => {
  const selector = serviceNode.data?.selector;
  if (!selector || typeof selector !== 'string' || selector.trim() === '') {
    return false;
  }
  const serviceType = serviceNode.data?.serviceType || 'ClusterIP';
  if (serviceType !== 'LoadBalancer') {
    const serviceNamespace = resolveNodeNamespace(serviceNode, nodes || [serviceNode]);
    const workloadNamespace = resolveNodeNamespace(workloadNode, nodes || [workloadNode]);
    if (serviceNamespace !== workloadNamespace) {
      return false;
    }
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
  return nodes.some(candidateNode =>
    (candidateNode.type === 'Pod' || candidateNode.type === 'Deployment' || candidateNode.type === 'ReplicaSet' || candidateNode.type === 'StatefulSet') &&
    isServiceSelectorMatching(serviceNode, candidateNode, nodes)
  );
};

const matchesIngressRule = (
  serviceNode: Node,
  ruleServiceName: string,
  ingressNamespace: string,
  nodes: Node[]
): boolean => {
  return (
    serviceNode.type === 'Service' &&
    (serviceNode.data?.serviceType || 'ClusterIP') === 'ClusterIP' &&
    (serviceNode.data?.label === ruleServiceName || serviceNode.data?.selector === ruleServiceName) &&
    resolveNodeNamespace(serviceNode, nodes) === ingressNamespace
  );
};

/**
 * Checks if an Ingress resource points to a valid ClusterIP Service on the canvas within the same namespace.
 */
export const hasValidIngressBackend = (ingressNode: Node, nodes: Node[], edgeMap?: Map<string, Edge[]>): boolean => {
  const ingressNamespace = resolveNodeNamespace(ingressNode, nodes);

  const outgoingEdges = edgeMap?.get(ingressNode.id) || [];
  for (const edge of outgoingEdges) {
    if (edge.data?.validationError) continue;
    const targetService = nodes.find(candidateNode => candidateNode.id === edge.target);
    if (
      targetService?.type === 'Service' &&
      (targetService?.data?.serviceType || 'ClusterIP') === 'ClusterIP' &&
      resolveNodeNamespace(targetService, nodes) === ingressNamespace
    ) {
      return true;
    }
  }
  if (Array.isArray(ingressNode.data?.ingressPaths) && ingressNode.data.ingressPaths.length > 0) {
    const hasValidRule = ingressNode.data.ingressPaths.some((rule: any) =>
      nodes.some(candidateNode => matchesIngressRule(candidateNode, rule.serviceName, ingressNamespace, nodes))
    );
    if (hasValidRule) return true;
  }
  const backendName = ingressNode.data?.backendServiceName || ingressNode.data?.serviceName;
  if (backendName) {
    return nodes.some(candidateNode => matchesIngressRule(candidateNode, backendName, ingressNamespace, nodes));
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
  const outgoingEdges = edgeMap.get(currentId) || [];
  const hasIngressTarget = outgoingEdges.some(edge => {
    const targetNode = nodes.find(candidateNode => candidateNode.id === edge.target);
    return targetNode?.type === 'Ingress';
  });

  return hasWorkloadTarget || hasIngressTarget;
};

const isTargetOnEntryNode = (
  node: Node,
  nodes: Node[],
  entryNode: string
): boolean => {
  if (node.type === 'Pod') {
    return getAssignedWorker(node.data, node.id) === entryNode;
  }
  const childPods = nodes.filter(
    childPod =>
      childPod.type === 'Pod' &&
      (String(childPod.parentId) === String(node.id) || String(childPod.data?.parentId) === String(node.id))
  );
  if (childPods.length > 0) {
    return childPods.some(childPod => getAssignedWorker(childPod.data, childPod.id) === entryNode);
  }
  return getAssignedWorker(node.data, node.id) === entryNode;
};

const isLocalPolicyBlocked = (
  currentNode: Node,
  target: Node,
  nodes: Node[]
): boolean => {
  const serviceType = currentNode.data?.serviceType || 'ClusterIP';
  if (serviceType !== 'NodePort' && serviceType !== 'LoadBalancer') return false;
  if (currentNode.data?.externalTrafficPolicy !== 'Local') return false;

  const entryNode = currentNode.data?.entryNode || 'worker-1';
  return !isTargetOnEntryNode(target, nodes, entryNode);
};

const enqueueDynamicServiceTargets = (
  currentNode: Node,
  nodes: Node[] | undefined,
  queue: string[]
) => {
  if (currentNode.type !== 'Service' || !nodes) return;
  const selectorTargets = nodes.filter(candidateNode =>
    (candidateNode.type === 'Pod' || candidateNode.type === 'Deployment' || candidateNode.type === 'ReplicaSet' || candidateNode.type === 'StatefulSet') &&
    isServiceSelectorMatching(currentNode, candidateNode, nodes) &&
    !isLocalPolicyBlocked(currentNode, candidateNode, nodes)
  );
  for (const target of selectorTargets) {
    queue.push(String(target.id));
  }
};

const getIngressTargetServiceNames = (currentNode: Node): Set<string> => {
  const targetNames = new Set<string>();
  const backendName = currentNode.data?.backendServiceName || currentNode.data?.serviceName;
  if (typeof backendName === 'string' && backendName) {
    targetNames.add(backendName);
  }
  if (Array.isArray(currentNode.data?.ingressPaths)) {
    for (const rule of currentNode.data.ingressPaths) {
      if (rule?.serviceName) {
        targetNames.add(String(rule.serviceName));
      }
    }
  }
  return targetNames;
};

const enqueueDynamicIngressTargets = (
  currentNode: Node,
  nodes: Node[] | undefined,
  queue: string[]
) => {
  if (currentNode.type !== 'Ingress' || !nodes) return;
  const targetServiceNames = getIngressTargetServiceNames(currentNode);
  if (targetServiceNames.size === 0) return;

  const ingressNamespace = resolveNodeNamespace(currentNode, nodes);

  const backendServices = nodes.filter(candidateService =>
    candidateService.type === 'Service' &&
    (candidateService.data?.serviceType || 'ClusterIP') === 'ClusterIP' &&
    targetServiceNames.has(String(candidateService.data?.label || '')) &&
    resolveNodeNamespace(candidateService, nodes) === ingressNamespace
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
  const currentNode = nodes?.find(candidateNode => candidateNode.id === currentId);

  if (currentNode && nodes) {
    if (!isServiceValidForProcessing(currentNode, currentId, nodes, edgeMap)) {
      return;
    }
    if (currentNode.type === 'Ingress' && !hasValidIngressBackend(currentNode, nodes, edgeMap)) {
      return;
    }
  }

  const outgoingEdges = edgeMap.get(currentId);
  if (outgoingEdges) {
    for (const edge of outgoingEdges) {
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
  const queue = startNodes.map(startNode => startNode.id);
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
  const isWorkload = node.type === 'Pod' || node.type === 'Deployment' || node.type === 'ReplicaSet' || node.type === 'StatefulSet';
  if (isWorkload && node.data?.status !== 'ready') return true;

  if (node?.type === 'Service') {
    const serviceType = node?.data?.serviceType || 'ClusterIP';
    const matchingWorkloads = nodes.filter(candidateWorkload =>
      (candidateWorkload.type === 'Pod' || candidateWorkload.type === 'Deployment' || candidateWorkload.type === 'ReplicaSet' || candidateWorkload.type === 'StatefulSet') &&
      isServiceSelectorMatching(node, candidateWorkload, nodes)
    );
    const hasIngressTarget = nodes.some(candidateNode => candidateNode.type === 'Ingress');
    if (matchingWorkloads.length === 0 && !hasIngressTarget && serviceType !== 'NodePort') {
      return true;
    }
  }

  if (node?.type === 'Ingress') {
    if (!hasValidIngressBackend(node, nodes)) {
      return true;
    }
  }

  if (node?.type === 'Deployment' || node?.type === 'StatefulSet') {
    const childPods = nodes.filter((candidatePod) => (String(candidatePod.parentId) === String(node.id) || String(candidatePod.data?.parentId) === String(node.id)) && candidatePod.type === 'Pod');
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

    const targetNode = ctx.nodeMap?.get(currentId) || ctx.nodes.find(candidateNode => String(candidateNode.id) === currentId);
    if (checkNodeUnreadyInternal(targetNode, ctx.nodes)) {
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
  const outgoingEdges = ctx.edgeMap?.get(internet.id) || [];
  if (outgoingEdges.length === 0) return true;

  const activeEdgesSet = new Set(ctx.activeSimulationEdges);

  for (const edge of outgoingEdges) {
    if (edge.data?.validationError) return true;
    if (hasUnreadyDownstreamPath(String(edge.target), ctx, activeEdgesSet)) {
      return true;
    }
  }

  return false;
};
