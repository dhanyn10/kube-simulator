import { FlowSlice } from '@/store/slices/createFlowSlice';
import { DeploymentSlice } from '@/store/slices/createDeploymentSlice';
import { UiSlice } from '@/store/slices/createUiSlice';
import { LogSlice } from '@/store/slices/createLogSlice';
import { NodeSlice } from '@/store/slices/createNodeSlice';

export type LogLevel = 'error' | 'warn' | 'fatal' | 'info';
export type LogScope = 'Simulation' | 'KubeConsole' | 'Store' | 'UI' | 'Backend' | 'System' | (string & {});

export interface LogEntry {
  id: string;
  level: LogLevel;
  scope?: LogScope;
  message: string;
  timestamp: number;
}

export interface SimulationMetricPoint {
  cpuPercent: number;
  memoryPercent: number;
  cpuValue: number;
  memoryValue: number;
  cpuLimit: number;
  memoryLimit: number;
  isThrottled: boolean;
  isOOM: boolean;
}

export interface BaseFlowState {
  clipboard: { nodes: any[]; edges: any[] } | null;
  draggedNodeId: string | null;
  lastActionId: string;
  lastActionName: string;
  currentProject: { id: number; name: string } | null;
  lastSavedSnapshot: string | null;
}

export interface FlowState
  extends BaseFlowState,
    FlowSlice,
    DeploymentSlice,
    UiSlice,
    LogSlice,
    NodeSlice {}
