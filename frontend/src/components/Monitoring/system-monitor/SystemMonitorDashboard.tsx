import { useEffect, useState, useMemo, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { Cpu, Database, Server, Activity, AlertCircle, AlertTriangle, Radio } from 'lucide-react';
import { SimulationMetricPoint } from '@/store/types';
import { useSystemMonitorDashboard } from '@/activities/monitoring';
import { DeploymentSummary } from './types';
import { SystemMonitorHeader } from './SystemMonitorHeader';
import { SystemMonitorStatCard } from './SystemMonitorStatCard';
import { SystemMonitorTimeSeriesPanel } from './SystemMonitorTimeSeriesPanel';
import { SystemMonitorReplicasPanel } from './SystemMonitorReplicasPanel';
import { SystemMonitorNetworkPanel } from './SystemMonitorNetworkPanel';
import { SystemMonitorContextMenu } from './SystemMonitorContextMenu';

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
  if (!points || points.length === 0) {
    return [];
  }
  const slice = points.length > 30 ? points.slice(-30) : points;
  return slice.map((p) => p[key] || 0);
};

const EmptySimulationState = ({ isDark }: { isDark: boolean }) => (
  <div className={cn(
    "h-64 flex flex-col items-center justify-center gap-3 border border-dashed rounded-lg",
    isDark ? "border-slate-800 text-slate-500" : "border-slate-300 text-slate-600"
  )}>
    <Activity size={36} strokeWidth={1.5} className={isDark ? "text-blue-500/60" : "text-blue-600/70"} />
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
      'h-9 px-3 sm:px-5 flex items-center justify-between gap-3 border-t text-[10px] font-mono select-none',
      isDark ? 'bg-[#181b1f] border-[#22252b] text-slate-400' : 'bg-white border-slate-200 text-slate-500'
    )}
  >
    <div className="flex items-center gap-3 sm:gap-6 min-w-0">
      <span className={cn("flex items-center gap-1.5 font-bold truncate", isDark ? "text-blue-400" : "text-blue-600")}>
        <Radio size={12} className={isSimulating && !isPaused ? 'animate-pulse shrink-0' : 'shrink-0'} />
        System Monitor Engine (Go Broker Synced)
      </span>
      <span className="hidden sm:inline">Speed: {simulationSpeed}x</span>
      <span className="hidden sm:inline">IPC: Wails v3 + BroadcastChannel</span>
    </div>
    <div className="hidden md:block shrink-0">
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
    toggleTheme,
    timeRange,
    setTimeRange,
    simulatedTime,
    sendControl,
    clusterTotals,
    canStart,
    hasHpa,
    hpaTarget,
    handleCloseWindow,
    handleMaximizeWindow,
  } = useSystemMonitorDashboard();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const isDarkMode = colorMode === 'dark';
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.documentElement.classList.toggle('light', !isDarkMode);
    document.body.classList.toggle('dark', isDarkMode);
    document.body.classList.toggle('light', !isDarkMode);
  }, [colorMode]);

  const isDark = colorMode === 'dark';
  const cpuSparkline = useMemo(() => extractSparkline(deployments, metrics, 'cpuPercent'), [deployments, metrics]);
  const memSparkline = useMemo(() => extractSparkline(deployments, metrics, 'memoryPercent'), [deployments, metrics]);

  const cpuThreshold = getUtilizationThreshold(clusterTotals.cpuPercent);
  const memThreshold = getUtilizationThreshold(clusterTotals.memoryPercent);
  const podThreshold = getPodThreshold(clusterTotals.readyPods, clusterTotals.totalPods);
  const errorThreshold = clusterTotals.errorRate > 0 ? 'critical' : 'normal';
  const isOverloaded = deployments.some(dep => {
    const last = metrics[dep.id]?.at(-1);
    return Boolean(last?.isThrottled || last?.isOOM);
  });

  return (
    <div
      onContextMenu={handleContextMenu}
      className={cn(
        'h-screen w-screen flex flex-col font-sans transition-colors overflow-hidden select-none',
        isOverloaded && 'ring-1 ring-inset ring-red-500',
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
        canStart={canStart}
        onClose={handleCloseWindow}
        onMaximize={handleMaximizeWindow}
      />

      {isOverloaded && (
        <div
          role="alert"
          className={cn(
            'flex items-center gap-2 px-4 py-1.5 border-b text-[11px] font-mono font-bold uppercase tracking-wide',
            isDark
              ? 'bg-red-950/80 border-red-800 text-red-300'
              : 'bg-red-50 border-red-300 text-red-700'
          )}
        >
          <AlertTriangle size={13} className="shrink-0 animate-pulse" />
          Resource overload detected - simulation paused, charts kept open in red
        </div>
      )}

      {/* Main Dashboard Body: scrollbar lives inside the window with a right gutter so the
          frameless window's right edge stays free for native resize */}
      <div className="flex-1 min-h-0 flex pr-1.5">
        <div
          data-testid="system-monitor-scroll-area"
          className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden custom-scrollbar"
        >
      <main className="p-3 sm:p-5 space-y-3 sm:space-y-5 max-w-[1600px] w-full mx-auto">
        {/* KPI SingleStat Row */}
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
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
            value={clusterTotals.totalTrafficRpm.toLocaleString()}
            unit="req/min"
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
          <EmptySimulationState isDark={isDark} />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-5">
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
              isSimulating={isSimulating && !isPaused}
              hasHpa={hasHpa}
              hpaTarget={hpaTarget}
            />

            <SystemMonitorTimeSeriesPanel
              title="Memory Allocation (MiB)"
              description="Working set per deployment"
              deployments={deployments}
              metrics={metrics}
              metricKey="memoryValue"
              unit=" MiB"
              maxVal={256}
              showThresholds={true}
              colorMode={colorMode}
              interval={timeRange}
              isSimulating={isSimulating && !isPaused}
            />

            <SystemMonitorNetworkPanel
              deployments={deployments}
              metrics={metrics}
              colorMode={colorMode}
              interval={timeRange}
              isSimulating={isSimulating && !isPaused}
            />

            <SystemMonitorReplicasPanel
              deployments={deployments}
              metrics={metrics}
              colorMode={colorMode}
              interval={timeRange}
              isSimulating={isSimulating && !isPaused}
            />
          </div>
        )}
      </main>
        </div>
      </div>

      {/* System Monitor Status Footer */}
      <SystemMonitorFooter
        isDark={isDark}
        isSimulating={isSimulating}
        isPaused={isPaused}
        simulationSpeed={simulationSpeed}
      />

      {/* System Monitor Right-Click Context Menu */}
      {contextMenu && (
        <SystemMonitorContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onCloseWindow={handleCloseWindow}
          onCloseMenu={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
