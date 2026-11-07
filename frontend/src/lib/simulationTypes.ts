import { Node, Edge } from '@xyflow/react';
import { SimulationMetricPoint } from '@/types';
import {
  SimulationLogEntry,
  ISimulationEventSink,
  K8sClusterGraph,
} from '@/domain/k8s';
import { logger } from './logger';

export * from '@/domain/k8s';

export interface SimulationContext {
  nodes: Node[];
  edges: Edge[];
  activeSimulationEdges: string[];
  updatedNodes: Node[];
  newMetrics: Record<string, SimulationMetricPoint[]>;
  ticks: number;
  get?: () => any;
  set?: (state: any) => void;
  logs?: SimulationLogEntry[];
  onLog?: (level: string, message: string, category: string) => void;
  eventSink?: ISimulationEventSink;
  clusterGraph?: K8sClusterGraph;
  syncDeployment?: (
    deployment: Node,
    currentNodes: Node[],
    replicasChange: number,
    get?: () => any,
    podToInclude?: Node,
    forceRandomize?: boolean
  ) => { updatedDeployment: Node; laidOut: Node[] };
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
 * Automatically synchronizes with domain clusterGraph if attached.
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
    if (ctx.clusterGraph) {
      ctx.clusterGraph.updateNodeData(id, newData);
    }
    return true;
  }
  return false;
};

/**
 * Emits a simulation log entry in a pure and decoupled way.
 * Appends to ctx.logs when provided, calls onLog/eventSink when available,
 * and falls back safely to ctx.get()?.addLog for backward compatibility.
 */
export const emitSimulationLog = (
  ctx: {
    logs?: SimulationLogEntry[];
    onLog?: (level: string, message: string, category: string) => void;
    eventSink?: ISimulationEventSink;
    get?: () => any;
  },
  level: string,
  message: string,
  category = 'Simulation',
  logErrorScope?: string
): void => {
  if (ctx.logs) {
    ctx.logs.push({ level, message, category, timestamp: Date.now() });
  }

  try {
    if (typeof ctx.onLog === 'function') {
      ctx.onLog(level, message, category);
    } else if (ctx.eventSink?.addLog) {
      ctx.eventSink.addLog(level, message, category);
    } else if (typeof ctx.get === 'function') {
      ctx.get()?.addLog?.(level, message, category);
    }
  } catch (error) {
    if (logErrorScope) {
      logger.error(logErrorScope, error);
    }
  }
};
