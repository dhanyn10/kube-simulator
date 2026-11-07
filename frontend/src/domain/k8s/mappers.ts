import { Node, Edge } from '@xyflow/react';
import { K8sResourceType } from '@/types';
import { ClusterResourceNode, ClusterConnection } from './types';
import { K8sClusterGraph } from './K8sClusterGraph';

/**
 * Converts a React Flow UI Node into a pure domain ClusterResourceNode.
 * Strips away UI rendering properties like position, dragging, selected, styles, etc.
 */
export const toClusterNode = (node: Node): ClusterResourceNode => ({
  id: node.id,
  type: (node.type || 'Pod') as K8sResourceType,
  data: { ...node.data },
  parentId: node.parentId,
});

/**
 * Converts a React Flow UI Edge into a pure domain ClusterConnection.
 */
export const toClusterConnection = (edge: Edge): ClusterConnection => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  sourceHandle: edge.sourceHandle ?? null,
  targetHandle: edge.targetHandle ?? null,
  data: edge.data ? { ...edge.data } : undefined,
});

/**
 * Builds a pure K8sClusterGraph domain object from visual React Flow nodes and edges.
 */
export const toClusterGraph = (nodes: Node[], edges: Edge[]): K8sClusterGraph => {
  const clusterNodes = nodes.map(toClusterNode);
  const clusterConnections = edges.map(toClusterConnection);
  return new K8sClusterGraph(clusterNodes, clusterConnections);
};

/**
 * Synchronizes domain changes back to React Flow UI nodes.
 * Preserves visual canvas properties (x/y coordinates, dimensions, handles, selection, styles).
 */
export const syncNodesFromClusterGraph = (
  reactFlowNodes: Node[],
  clusterGraph: K8sClusterGraph
): Node[] => {
  return reactFlowNodes.map((rfNode) => {
    const domainNode = clusterGraph.getNode(rfNode.id);
    if (!domainNode) return rfNode;

    return {
      ...rfNode,
      data: {
        ...rfNode.data,
        ...domainNode.data,
      },
    };
  });
};
