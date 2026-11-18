import { useState, useEffect, useMemo, useCallback } from 'react';
import { getBackendGateway } from '@/gateway';
import { useFlowStore } from '@/store';
import { SimulationMetricPoint } from '@/store/types';
import { TimeRangeFilter, DeploymentSummary, SystemMonitorClusterTotals, SimulationSpeed, SystemMonitorColorMode } from './types';

const resolveStoreHpaInfo = (nodes: any[]): { hasHpa: boolean; targetCPU: number } => {
  if (!nodes || nodes.length === 0) return { hasHpa: false, targetCPU: 80 };
  const hpaNode = nodes.find((n) => n.type === 'HPA');
  const attached = nodes.find((n) => Array.isArray(n.data?.hpas) && n.data.hpas.length > 0);
  const exists = Boolean(hpaNode || attached);
  let target = 80;
  if (hpaNode?.data?.targetCPU) {
    target = Number(hpaNode.data.targetCPU) || 80;
  } else if (attached?.data?.hpas?.[0]?.targetCPU) {
    target = Number(attached.data.hpas[0].targetCPU) || 80;
  }
  return { hasHpa: exists, targetCPU: target };
};

export const useSystemMonitorDashboard = () => {
  const [metrics, setMetrics] = useState<Record<string, SimulationMetricPoint[]>>({});
  const [deployments, setDeployments] = useState<DeploymentSummary[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<SimulationSpeed>(1);
  const storeColorMode = useFlowStore((state) => state.colorMode);
  const [colorMode, setColorMode] = useState<SystemMonitorColorMode>(() => (useFlowStore.getState().colorMode as SystemMonitorColorMode) || 'dark');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('1h');
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [canStart, setCanStart] = useState<boolean>(false);
  const [hasHpa, setHasHpa] = useState<boolean>(false);
  const [hpaTarget, setHpaTarget] = useState<number>(80);

  useEffect(() => {
    if (storeColorMode) {
      setColorMode(storeColorMode as SystemMonitorColorMode);
    }
  }, [storeColorMode]);

  const storeNodes = useFlowStore((state) => state.nodes);
  const storeHpaInfo = useMemo(() => resolveStoreHpaInfo(storeNodes), [storeNodes]);

  const simulatedTime = useMemo(() => {
    const firstDeploymentMetrics = Object.values(metrics)[0];
    const lastPoint = firstDeploymentMetrics?.at(-1);
    if (!lastPoint || typeof lastPoint.minuteIndex !== 'number') {
      return '00:00';
    }
    const minute = ((lastPoint.minuteIndex % 1440) + 1440) % 1440;
    const hh = String(Math.floor(minute / 60)).padStart(2, '0');
    const mm = String(minute % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }, [metrics]);

  const handleUpdate = useCallback((data: any) => {
    if (data.metrics) setMetrics(data.metrics);
    if (data.deployments) setDeployments(data.deployments);
    if (typeof data.canStart === 'boolean') {
      setCanStart(data.canStart);
    } else if (Array.isArray(data.deployments)) {
      setCanStart(data.deployments.length > 0);
    }
    if (typeof data.isSimulating === 'boolean') setIsSimulating(data.isSimulating);
    if (typeof data.isPaused === 'boolean') setIsPaused(data.isPaused);
    if (data.speed) setSimulationSpeed(data.speed);
    if (typeof data.hasHpa === 'boolean') {
      setHasHpa(data.hasHpa);
    } else if (Array.isArray(data.deployments)) {
      const depHasHpa = data.deployments.some((d: any) => d.hasHpa || (Array.isArray(d.hpas) && d.hpas.length > 0));
      setHasHpa(depHasHpa);
    }
    if (typeof data.hpaTarget === 'number' && !Number.isNaN(data.hpaTarget)) {
      setHpaTarget(data.hpaTarget);
    }
    setLastUpdated(Date.now());
  }, []);

  const sendControl = useCallback(async (action: string, options?: { speed?: number; multiplier?: number }) => {
    const channel = new BroadcastChannel('monitoring-data');
    channel.postMessage({ type: 'SIMULATION_CONTROL', action, ...options });
    channel.close();

    const gw = getBackendGateway();
    if (action === 'start' || action === 'resume') {
      await gw.startSimulation(options?.speed || simulationSpeed);
      setIsSimulating(true);
      setIsPaused(false);
    } else if (action === 'pause') {
      await gw.pauseSimulation();
      setIsPaused(true);
    } else if (action === 'stop') {
      await gw.stopSimulation();
      setIsSimulating(false);
      setIsPaused(false);
    } else if (action === 'speed' && options?.speed) {
      await gw.setSimulationSpeed(options.speed);
      setSimulationSpeed(options.speed as SimulationSpeed);
    } else if (action === 'traffic_spike') {
      await gw.triggerTrafficSpike(options?.multiplier || 2.0);
    }
  }, [simulationSpeed]);

  useEffect(() => {
    const channel = new BroadcastChannel('monitoring-data');
    const gw = getBackendGateway();

    channel.onmessage = (event) => {
      if (event.data.type === 'METRICS_UPDATE') {
        handleUpdate(event.data);
      } else if (event.data.type === 'THEME_SYNC') {
        setColorMode(event.data.colorMode);
      }
    };

    const unsubMetrics = gw.onEvent('metrics-update', (json: string) => {
      try { handleUpdate(JSON.parse(json)); } catch { /* ignore parse error */ }
    });

    const unsubSnap = gw.onEvent('simulation-snapshot-updated', (json: string) => {
      try { handleUpdate(JSON.parse(json)); } catch { /* ignore parse error */ }
    });

    const unsubTheme = gw.onEvent('theme-sync', (mode: any) => {
      setColorMode(mode);
    });

    // Request immediate state hydration
    channel.postMessage({ type: 'REQUEST_SNAPSHOT' });
    channel.postMessage({ type: 'DETACHED_OPEN' });
    gw.emitEvent('detached-open');
    (globalThis as any).runtime?.EventsEmit?.('detached-open');

    void gw.getSimulationSnapshot().then((raw) => {
      if (raw && raw !== '{}') {
        try { handleUpdate(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });

    return () => {
      channel.postMessage({ type: 'DETACHED_CLOSED' });
      gw.emitEvent('detached-closed');
      (globalThis as any).runtime?.EventsEmit?.('detached-closed');
      channel.close();
      unsubMetrics();
      unsubSnap();
      unsubTheme();
    };
  }, [handleUpdate]);

  // Aggregate cluster metrics computation
  const clusterTotals: SystemMonitorClusterTotals = useMemo(() => {
    let cpuUsed = 0;
    let cpuLimit = 0;
    let memMb = 0;
    let memLimitMb = 0;
    let totalPods = 0;
    let readyPods = 0;
    let totalRps = 0;
    let throttledCount = 0;

    deployments.forEach((dep) => {
      const points = metrics[dep.id] || [];
      const last = points.at(-1);
      const replicas = dep.replicas || 1;
      totalPods += replicas;
      readyPods += replicas;

      if (last) {
        cpuUsed += (last.cpuValue || 0) * replicas;
        cpuLimit += (last.cpuLimit || 1000) * replicas;
        memMb += (last.memoryValue || 0) * replicas;
        memLimitMb += (last.memoryLimit || 1024) * replicas;
        totalRps += Math.round((last.cpuPercent || 0) * 15 * replicas);
        if (last.isThrottled || last.isOOM) {
          throttledCount += replicas;
        }
      }
    });

    const cpuPercent = cpuLimit > 0 ? Math.round((cpuUsed / cpuLimit) * 100) : 0;
    const memoryPercent = memLimitMb > 0 ? Math.round((memMb / memLimitMb) * 100) : 0;
    const errorRate = totalPods > 0 ? Math.round((throttledCount / totalPods) * 100) : 0;

    return {
      cpuPercent,
      cpuUsed,
      cpuLimit,
      memoryMb: memMb,
      memoryLimitMb: memLimitMb,
      memoryPercent,
      totalPods,
      readyPods,
      totalRps,
      errorRate,
    };
  }, [deployments, metrics]);

  const effectiveHasHpa = useMemo(() => {
    if (storeNodes && storeNodes.length > 0) {
      return storeHpaInfo.hasHpa;
    }
    return hasHpa;
  }, [storeNodes, storeHpaInfo.hasHpa, hasHpa]);

  const effectiveHpaTarget = useMemo(() => {
    if (storeNodes && storeNodes.length > 0 && storeHpaInfo.hasHpa) {
      return storeHpaInfo.targetCPU;
    }
    return hpaTarget;
  }, [storeNodes, storeHpaInfo, hpaTarget]);

  return {
    metrics,
    deployments,
    isSimulating,
    isPaused,
    simulationSpeed,
    colorMode,
    timeRange,
    setTimeRange,
    simulatedTime,
    lastUpdated,
    sendControl,
    clusterTotals,
    canStart,
    hasHpa: effectiveHasHpa,
    hpaTarget: effectiveHpaTarget,
  };
};
