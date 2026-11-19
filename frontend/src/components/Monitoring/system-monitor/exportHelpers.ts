import { SimulationMetricPoint } from '@/store/types';
import { DeploymentSummary, SystemMonitorClusterTotals } from './types';

/**
 * Converts simulation metrics and deployment states into a CSV string.
 */
export const generateMetricsCsv = (
  metrics: Record<string, SimulationMetricPoint[]>,
  deployments: DeploymentSummary[]
): string => {
  const header = ['MinuteIndex', 'Time', 'DeploymentId', 'WorkloadLabel', 'CPUPercent', 'MemoryMiB', 'Replicas', 'Throttled', 'OOMRisk'];
  const rows: string[] = [header.join(',')];

  deployments.forEach((dep) => {
    const points = metrics[dep.id] || [];
    points.forEach((p) => {
      const minIdx = typeof p.minuteIndex === 'number' ? ((p.minuteIndex % 1440) + 1440) % 1440 : 0;
      const hh = String(Math.floor(minIdx / 60)).padStart(2, '0');
      const mm = String(minIdx % 60).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      const row = [
        minIdx,
        timeStr,
        `"${dep.id}"`,
        `"${dep.label}"`,
        Math.round(p.cpuPercent || 0),
        Math.round(p.memoryValue || 0),
        p.replicas || dep.replicas || 1,
        Boolean(p.isThrottled),
        Boolean(p.isOOM),
      ];
      rows.push(row.join(','));
    });
  });

  return rows.join('\n');
};

/**
 * Triggers a client-side file download of raw content with specified MIME type.
 */
export const triggerFileDownload = (content: string, filename: string, mimeType: string = 'text/plain') => {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Exports current simulation metrics as a timestamped CSV file.
 */
export const exportMetricsAsCsv = (
  metrics: Record<string, SimulationMetricPoint[]>,
  deployments: DeploymentSummary[]
) => {
  const csv = generateMetricsCsv(metrics, deployments);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  triggerFileDownload(csv, `kube-simulator-metrics-${timestamp}.csv`, 'text/csv');
};

/**
 * Exports current simulation metrics and cluster summary as a JSON file.
 */
export const exportMetricsAsJson = (
  metrics: Record<string, SimulationMetricPoint[]>,
  deployments: DeploymentSummary[],
  clusterTotals?: SystemMonitorClusterTotals
) => {
  const data = {
    exportedAt: new Date().toISOString(),
    clusterTotals,
    deployments,
    metrics,
  };
  const json = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  triggerFileDownload(json, `kube-simulator-metrics-${timestamp}.json`, 'application/json');
};
