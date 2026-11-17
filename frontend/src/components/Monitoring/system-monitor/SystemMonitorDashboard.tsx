import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Cpu, Database, Server, Activity, AlertCircle, Radio } from 'lucide-react';
import { SimulationMetricPoint } from '@/store/types';
import { DeploymentSummary } from './types';
import { useSystemMonitorDashboard } from './useSystemMonitorDashboard';
import { SystemMonitorHeader } from './SystemMonitorHeader';
import { SystemMonitorStatCard } from './SystemMonitorStatCard';
import { SystemMonitorTimeSeriesPanel } from './SystemMonitorTimeSeriesPanel';
import { SystemMonitorReplicasPanel } from './SystemMonitorReplicasPanel';
import { SystemMonitorNetworkPanel } from './SystemMonitorNetworkPanel';

const getUtilizationThreshold = (percent: number): 'normal' | 'warning' | 'critical' => {
  if (percent > 85) {
    return 'critical';
  }
  if (percent > 70) {
    return 'warning';
  }
  return 'normal';
};

const getPodThreshold = (ready: number, total: number): 'normal' | 'warning' => {
  if (total > 0 && ready < total) {
    return 'warning';
  }
  return 'normal';
};

const extractSparkline = (
  deployments: DeploymentSummary[],
  metrics: Record<string, SimulationMetricPoint[]>,
  key: 'cpuPercent' | 'memoryPercent'
): number[] => {
  const firstDeploymentId = deployments[0]?.id;
  if (!firstDeploymentId) {
    return [];
  }
  const points = metrics[firstDeploymentId];
  if (!points) {
    return [];
  }
  return points.map((p) => p[key] || 0);
};

const EmptySimulationState = () => (
  <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-3 border border-dashed border-slate-800 rounded-lg">
    <Activity size={36} strokeWidth={1.5} className="text-blue-500/60" />
    <p className="text-sm font-medium uppercase tracking-widest font-mono">Waiting for simulation data...</p>
  </div>
);

interface SystemMonitorFooterProps {
  isDark: boolean;
  isSimulating: boolean;
  isPaused: boolean;
  simulationSpeed: number;
}

const SystemMonitorFooter = ({
  isDark,
  isSimulating,
  isPaused,
  simulationSpeed,
}: SystemMonitorFooterProps) => (
  <footer
    className={cn(
      'h-9 px-5 flex items-center justify-between border-t text-[10px] font-mono select-none',
      isDark ? 'bg-[#181b1f] border-[#22252b] text-slate-400' : 'bg-white border-slate-200 text-slate-500'
    )}
  >
    <div className="flex items-center gap-6">
      <span className="flex items-center gap-1.5 text-blue-400 font-bold">
        <Radio size={12} className={isSimulating && !isPaused ? 'animate-pulse' : ''} />
        System Monitor Engine (Go Broker Synced)
      </span>
      <span className="hidden sm:inline">Speed: {simulationSpeed}x</span>
      <span className="hidden sm:inline">IPC: Wails v3 + BroadcastChannel</span>
    </div>
    <div>
      <span>Multi-Window System Monitor</span>
    </div>
  </footer>
);

export const SystemMonitorDashboard = () => {
  const {
    metrics,
    deployments,
    isSimulating,
    isPaused,
    simulationSpeed,
    colorMode,
    timeRange,
    setTimeRange,
    simulatedTime,
    sendControl,
    clusterTotals,
  } = useSystemMonitorDashboard();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorMode === 'dark');
  }, [colorMode]);

  const isDark = colorMode === 'dark';
  const cpuSparkline = extractSparkline(deployments, metrics, 'cpuPercent');
  const memSparkline = extractSparkline(deployments, metrics, 'memoryPercent');

  const cpuThreshold = getUtilizationThreshold(clusterTotals.cpuPercent);
  const memThreshold = getUtilizationThreshold(clusterTotals.memoryPercent);
  const podThreshold = getPodThreshold(clusterTotals.readyPods, clusterTotals.totalPods);
  const errorThreshold = clusterTotals.errorRate > 0 ? 'critical' : 'normal';

  return (
    <div
      className={cn(
        'h-screen w-screen flex flex-col font-sans transition-colors overflow-hidden select-none',
        isDark ? 'bg-[#111217] text-slate-200' : 'bg-slate-50 text-slate-800'
      )}
    >
      {/* System Monitor Navigation & Control Toolbar */}
      <SystemMonitorHeader
        isSimulating={isSimulating}
        isPaused={isPaused}
        simulationSpeed={simulationSpeed}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        sendControl={sendControl}
        colorMode={colorMode}
        simulatedTime={simulatedTime}
      />

      {/* Main Dashboard Body */}
      <main className="flex-1 p-5 space-y-5 max-w-[1600px] w-full mx-auto overflow-y-auto">
        {/* KPI SingleStat Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <SystemMonitorStatCard
            title="Cluster CPU"
            value={clusterTotals.cpuPercent}
            unit="%"
            subtitle={`${clusterTotals.cpuUsed}m / ${clusterTotals.cpuLimit || 1000}m`}
            icon={<Cpu size={15} />}
            sparklineData={cpuSparkline}
            threshold={cpuThreshold}
            colorMode={colorMode}
          />

          <SystemMonitorStatCard
            title="Cluster Memory"
            value={clusterTotals.memoryPercent}
            unit="%"
            subtitle={`${clusterTotals.memoryMb} MiB / ${clusterTotals.memoryLimitMb || 1024} MiB`}
            icon={<Database size={15} />}
            sparklineData={memSparkline}
            threshold={memThreshold}
            colorMode={colorMode}
          />

          <SystemMonitorStatCard
            title="Workload Pods"
            value={`${clusterTotals.readyPods} / ${clusterTotals.totalPods}`}
            unit="pods"
            subtitle="Ready / Desired"
            icon={<Server size={15} />}
            threshold={podThreshold}
            colorMode={colorMode}
          />

          <SystemMonitorStatCard
            title="Throughput"
            value={clusterTotals.totalRps.toLocaleString()}
            unit="req/s"
            subtitle="Ingress Traffic"
            icon={<Activity size={15} />}
            threshold="normal"
            colorMode={colorMode}
          />

          <SystemMonitorStatCard
            title="Error Rate"
            value={`${clusterTotals.errorRate}.00`}
            unit="%"
            subtitle="5xx / Throttled"
            icon={<AlertCircle size={15} />}
            threshold={errorThreshold}
            colorMode={colorMode}
          />
        </div>

        {/* Time-Series Charts Grid */}
        {deployments.length === 0 ? (
          <EmptySimulationState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SystemMonitorTimeSeriesPanel
              title="CPU Utilization (%)"
              description="Processor load per deployment"
              deployments={deployments}
              metrics={metrics}
              metricKey="cpuPercent"
              unit="%"
              maxVal={100}
              showThresholds={true}
              colorMode={colorMode}
              interval={timeRange}
            />

            <SystemMonitorTimeSeriesPanel
              title="Memory Allocation (MiB)"
              description="Working set per deployment"
              deployments={deployments}
              metrics={metrics}
              metricKey="memoryValue"
              unit=" MiB"
              maxVal={1500}
              showThresholds={false}
              colorMode={colorMode}
              interval={timeRange}
            />

            <SystemMonitorNetworkPanel
              deployments={deployments}
              metrics={metrics}
              colorMode={colorMode}
              interval={timeRange}
            />

            <SystemMonitorReplicasPanel
              deployments={deployments}
              metrics={metrics}
              colorMode={colorMode}
              interval={timeRange}
            />
          </div>
        )}
      </main>

      {/* System Monitor Status Footer */}
      <SystemMonitorFooter
        isDark={isDark}
        isSimulating={isSimulating}
        isPaused={isPaused}
        simulationSpeed={simulationSpeed}
      />
    </div>
  );
};
