export type TimeRangeFilter = '1h' | '30m' | '15m' | '5m' | '1m' | 'all';
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
