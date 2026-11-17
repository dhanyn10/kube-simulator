export type TimeRangeFilter = '1m' | '5m' | '15m' | 'all';

export interface DeploymentSummary {
  id: string;
  label: string;
  replicas: number;
  type?: string;
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
