import { GrafanaDashboard } from './grafana';

/**
 * Standalone detached simulation monitoring dashboard acting as an authentic Grafana cluster view.
 * Synchronizes metrics, simulation speed, and two-way controls with the main application window and Go backend.
 */
export const DetachedMonitoring = () => {
  return <GrafanaDashboard />;
};
