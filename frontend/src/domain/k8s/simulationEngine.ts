import { Node, Edge } from '@xyflow/react';
import {
  ClusterResourceNode,
  DomainSimulationTickOptions,
  DomainSimulationStepResult,
  SimulationLogEntry,
} from './types';
import { K8sClusterGraph } from './K8sClusterGraph';
import {
  SimulationContext,
  processWorkloadSimulation,
  updateInternetTraffic,
  calculateReachability,
} from '@/lib/simulation';

/**
 * Builds edge lookup maps from domain cluster connections.
 */
const buildDomainEdgeMaps = (edges: Edge[]) => {
  const edgeMap = new Map<string, Edge[]>();
  const targetEdgeMap = new Map<string, Edge[]>();

  edges.forEach((edge) => {
    if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, []);
    edgeMap.get(edge.source)!.push(edge);

    if (!targetEdgeMap.has(edge.target)) targetEdgeMap.set(edge.target, []);
    targetEdgeMap.get(edge.target)!.push(edge);
  });

  return { edgeMap, targetEdgeMap };
};

/**
 * Classifies domain nodes into workloads, internet nodes, and lookup maps.
 */
const classifyDomainNodes = (nodes: Node[]) => {
  const workloads: Node[] = [];
  const internetNodes: Node[] = [];
  const nodeMap = new Map<string, Node>();
  const childPodMap = new Map<string, Node[]>();
  const nodeIndexMap = new Map<string, number>();

  nodes.forEach((node, index) => {
    nodeMap.set(node.id, node);
    nodeIndexMap.set(node.id, index);

    if (node.type === 'Internet') {
      internetNodes.push(node);
    } else if (
      node.type === 'Deployment' ||
      node.type === 'StatefulSet' ||
      node.type === 'ReplicaSet' ||
      (node.type === 'Pod' && !node.parentId)
    ) {
      workloads.push(node);
    }

    if (node.parentId) {
      if (!childPodMap.has(node.parentId)) childPodMap.set(node.parentId, []);
      childPodMap.get(node.parentId)!.push(node);
    }
  });

  return { workloads, internetNodes, nodeMap, childPodMap, nodeIndexMap };
};

/**
 * Pure Domain Simulation Engine.
 * Evaluates cluster simulation ticks on a pure K8sClusterGraph without coupling
 * to UI stores, global states, or visual canvas coordinates.
 */
export const runDomainSimulationStep = (
  graph: K8sClusterGraph,
  options: DomainSimulationTickOptions
): DomainSimulationStepResult => {
  const logs: SimulationLogEntry[] = [];
  const domainNodes = graph.getAllNodes();
  const domainEdges = graph.getAllEdges();

  // Convert to lightweight Node/Edge references for the existing pure simulation algorithm
  const rfNodes: Node[] = domainNodes.map((dn) => ({
    id: dn.id,
    type: dn.type,
    data: { ...dn.data },
    position: { x: 0, y: 0 },
    parentId: dn.parentId,
  }));

  const rfEdges: Edge[] = domainEdges.map((de) => ({
    id: de.id,
    source: de.source,
    target: de.target,
    sourceHandle: de.sourceHandle || undefined,
    targetHandle: de.targetHandle || undefined,
    data: de.data,
  }));

  const updatedNodes = [...rfNodes];
  const newMetrics = { ...options.metrics };
  const activeEdges = options.activeSimulationEdges || [];

  const { edgeMap, targetEdgeMap } = buildDomainEdgeMaps(rfEdges);
  const { workloads, internetNodes, nodeMap, childPodMap, nodeIndexMap } = classifyDomainNodes(rfNodes);

  const ctx: SimulationContext = {
    nodes: rfNodes,
    edges: rfEdges,
    activeSimulationEdges: activeEdges,
    updatedNodes,
    newMetrics,
    ticks: options.ticks,
    logs,
    onLog: (level, message, category) => {
      logs.push({ level, message, category, timestamp: Date.now() });
      options.onLog?.(level, message, category);
    },
    clusterGraph: graph,
    nodeMap,
    edgeMap,
    targetEdgeMap,
    childPodMap,
    internetNodes,
    nodeIndexMap,
    internetReachableMap: new Map(),
  };

  let hasChanges = false;

  // 1. Process internet traffic
  for (const node of internetNodes) {
    const res = updateInternetTraffic(node, ctx);
    if (res.hasChanges) hasChanges = true;
  }

  // 2. Pre-calculate reachability for internet nodes
  const activeEdgesSet = new Set(activeEdges);
  for (const node of internetNodes) {
    const reachable = calculateReachability([node], edgeMap, activeEdgesSet, rfNodes);
    ctx.internetReachableMap?.set(node.id, reachable);
  }

  // 3. Process workloads
  workloads.forEach((dep) => {
    const res = processWorkloadSimulation(dep, ctx);
    if (res.hasChanges) hasChanges = true;
  });

  // Map updated nodes back to domain nodes
  const updatedDomainNodes: ClusterResourceNode[] = updatedNodes.map((n) => {
    const clusterNode: ClusterResourceNode = {
      id: n.id,
      type: n.type as any,
      data: { ...n.data },
      parentId: n.parentId,
    };
    graph.updateNodeData(n.id, n.data);
    return clusterNode;
  });

  return {
    hasChanges,
    updatedNodes: updatedDomainNodes,
    activeSimulationEdges: activeEdges,
    metrics: newMetrics,
    logs,
  };
};
