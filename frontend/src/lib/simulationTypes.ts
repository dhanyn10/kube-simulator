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
  let idx = ctx.nodeIndexMap?.get(id);
  if (idx === undefined) {
    idx = ctx.updatedNodes.findIndex(un => un.id === id);
    if (idx !== -1) ctx.nodeIndexMap?.set(id, idx);
  }

  if (idx !== undefined && idx !== -1) {
    ctx.updatedNodes[idx] = {
      ...ctx.updatedNodes[idx],
      data: { ...ctx.updatedNodes[idx].data, ...newData }
    };
    return true;
  }
  return false;
};
