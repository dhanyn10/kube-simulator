import { SimulationMetricPoint } from '@/store/types';
import {
  TimeRangeFilter,
  DeploymentSummary
} from '@/activities/monitoring/systemMonitorTypes';

export * from '@/activities/monitoring/systemMonitorTypes';

export interface BaseSystemMonitorPanelProps {
  deployments: DeploymentSummary[];
  metrics: Record<string, SimulationMetricPoint[]>;
  colorMode?: 'dark' | 'light';
  interval?: TimeRangeFilter;
  isSimulating?: boolean;
}
