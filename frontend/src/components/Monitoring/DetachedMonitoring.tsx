import { SystemMonitorDashboard } from './system-monitor';

/**
 * Standalone detached simulation monitoring dashboard acting as a dedicated cluster system monitor.
 * Synchronizes metrics, simulation speed, and two-way controls with the main application window and Go backend.
 */
export const DetachedMonitoring = () => {
  return <SystemMonitorDashboard />;
};
