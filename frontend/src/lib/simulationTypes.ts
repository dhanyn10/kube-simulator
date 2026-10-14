import { Node, Edge } from '@xyflow/react';
import { SimulationMetricPoint, FlowState } from '@/store/types';

export interface SimulationContext {
  nodes: Node[];
  edges: Edge[];
  activeSimulationEdges: string[];
  updatedNodes: Node[];
  newMetrics: Record<string, SimulationMetricPoint[]>;
  ticks: number;
  get: () => FlowState;
  set: (state: Partial<FlowState>) => void;
  edgeMap?: Map<string, Edge[]>;
  targetEdgeMap?: Map<string, Edge[]>;
  nodeMap?: Map<string, Node>;
  childPodMap?: Map<string, Node[]>;
  internetNodes?: Node[];
  internetReachableMap?: Map<string, Set<string>>;
  nodeIndexMap?: Map<string, number>;
}

/**
 * Updates data properties of a node in the active simulation context.
 */
export const updateNodeData = (ctx: SimulationContext, id: string, newData: any) => {
  let nodeIndex = ctx.nodeIndexMap?.get(id);
  if (nodeIndex === undefined) {
    nodeIndex = ctx.updatedNodes.findIndex(updatedNode => updatedNode.id === id);
    if (nodeIndex !== -1) ctx.nodeIndexMap?.set(id, nodeIndex);
  }

  if (nodeIndex !== undefined && nodeIndex !== -1) {
    ctx.updatedNodes[nodeIndex] = {
      ...ctx.updatedNodes[nodeIndex],
      data: { ...ctx.updatedNodes[nodeIndex].data, ...newData }
    };
    return true;
  }
  return false;
};
