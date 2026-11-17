import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Cpu, Database, Server, Activity, AlertCircle, Radio } from 'lucide-react';
import { useSystemMonitorDashboard } from './useSystemMonitorDashboard';
import { SystemMonitorHeader } from './SystemMonitorHeader';
import { SystemMonitorStatCard } from './SystemMonitorStatCard';
import { SystemMonitorTimeSeriesPanel } from './SystemMonitorTimeSeriesPanel';
import { SystemMonitorReplicasPanel } from './SystemMonitorReplicasPanel';
import { SystemMonitorNetworkPanel } from './SystemMonitorNetworkPanel';

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
    sendControl,
    clusterTotals,
  } = useSystemMonitorDashboard();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorMode === 'dark');
  }, [colorMode]);

  const isDark = colorMode === 'dark';

  // Sample CPU history for sparkline
  const cpuSparkline = deployments.length > 0 && deployments[0].id && metrics[deployments[0].id]
    ? metrics[deployments[0].id].map((p) => p.cpuPercent || 0)
    : [];

  const memSparkline = deployments.length > 0 && deployments[0].id && metrics[deployments[0].id]
    ? metrics[deployments[0].id].map((p) => p.memoryPercent || 0)
    : [];

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
            threshold={clusterTotals.cpuPercent > 85 ? 'critical' : clusterTotals.cpuPercent > 70 ? 'warning' : 'normal'}
            colorMode={colorMode}
          />

          <SystemMonitorStatCard
            title="Cluster Memory"
            value={clusterTotals.memoryPercent}
            unit="%"
            subtitle={`${clusterTotals.memoryMb} MiB / ${clusterTotals.memoryLimitMb || 1024} MiB`}
            icon={<Database size={15} />}
            sparklineData={memSparkline}
            threshold={clusterTotals.memoryPercent > 85 ? 'critical' : clusterTotals.memoryPercent > 70 ? 'warning' : 'normal'}
            colorMode={colorMode}
          />

          <SystemMonitorStatCard
            title="Workload Pods"
            value={`${clusterTotals.readyPods} / ${clusterTotals.totalPods}`}
            unit="pods"
            subtitle="Ready / Desired"
            icon={<Server size={15} />}
            threshold={clusterTotals.totalPods > 0 && clusterTotals.readyPods < clusterTotals.totalPods ? 'warning' : 'normal'}
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
            threshold={clusterTotals.errorRate > 0 ? 'critical' : 'normal'}
            colorMode={colorMode}
          />
        </div>

        {/* Time-Series Charts Grid */}
        {deployments.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-3 border border-dashed border-slate-800 rounded-lg">
            <Activity size={36} strokeWidth={1.5} className="text-blue-500/60" />
            <p className="text-sm font-medium uppercase tracking-widest font-mono">Waiting for simulation data...</p>
          </div>
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
            />

            <SystemMonitorNetworkPanel
              deployments={deployments}
              metrics={metrics}
              colorMode={colorMode}
            />

            <SystemMonitorReplicasPanel
              deployments={deployments}
              metrics={metrics}
              colorMode={colorMode}
            />
          </div>
        )}
      </main>

      {/* System Monitor Status Footer */}
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
    </div>
  );
};
