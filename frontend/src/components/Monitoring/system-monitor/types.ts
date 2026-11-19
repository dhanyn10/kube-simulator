import { SimulationMetricPoint } from '@/store/types';

export type TimeRangeFilter = '1h' | '30m' | '15m' | '10m' | '5m' | '1m' | 'all';
export type SimulationSpeed = 1 | 5 | 10;
export type SystemMonitorColorMode = 'dark' | 'light';

export interface DeploymentSummary {
  id: string;
  label: string;
  replicas: number;
  type?: string;
  hasHpa?: boolean;
  hpas?: Array<{ targetCPU?: number }>;
}

export interface BaseSystemMonitorPanelProps {
  deployments: DeploymentSummary[];
  metrics: Record<string, SimulationMetricPoint[]>;
  colorMode?: 'dark' | 'light';
  interval?: TimeRangeFilter;
  isSimulating?: boolean;
}

export interface SystemMonitorClusterTotals {
  cpuPercent: number;
  cpuUsed: number;
  cpuLimit: number;
  memoryMb: number;
  memoryLimitMb: number;
  memoryPercent: number;
  totalPods: number;
  readyPods: number;
  totalRps: number;
  errorRate: number;
}

export type ClusterTotals = SystemMonitorClusterTotals;
