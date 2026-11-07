import { K8sResourceType, K8sNodeData, SimulationMetricPoint } from '@/types';

/**
 * Pure domain representation of a Kubernetes resource node in the cluster graph,
 * completely decoupled from React Flow UI / canvas positioning properties.
 */
export interface ClusterResourceNode {
  id: string;
  type: K8sResourceType;
  data: K8sNodeData;
  parentId?: string;
}

/**
 * Pure domain representation of a connection (edge) between two Kubernetes resources.
 */
export interface ClusterConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: Record<string, any>;
}

/**
 * Structured log event generated during simulation execution.
 */
export interface SimulationLogEntry {
  level: string;
  message: string;
  category: string;
  timestamp?: number;
}

/**
 * Generic event sink interface allowing simulation libraries to emit logs without coupling to stores.
 */
export interface ISimulationEventSink {
  addLog?: (level: string, message: string, category?: string) => void;
}

/**
 * Domain simulation tick options.
 */
export interface DomainSimulationTickOptions {
  ticks: number;
  activeSimulationEdges?: string[];
  metrics?: Record<string, SimulationMetricPoint[]>;
  onLog?: (level: string, message: string, category: string) => void;
}

/**
 * Pure result returned after running a simulation step on the cluster graph.
 */
export interface DomainSimulationStepResult {
  hasChanges: boolean;
  updatedNodes: ClusterResourceNode[];
  activeSimulationEdges: string[];
  metrics: Record<string, SimulationMetricPoint[]>;
  logs: SimulationLogEntry[];
}
