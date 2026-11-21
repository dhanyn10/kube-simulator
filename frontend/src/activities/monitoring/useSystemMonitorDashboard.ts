import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getBackendGateway } from '@/gateway';
import { isWailsDesktop } from '@/lib/mocks';
import { useFlowStore } from '@/store';
import { SimulationMetricPoint } from '@/store/types';
import {
  TimeRangeFilter,
  DeploymentSummary,
  SystemMonitorClusterTotals,
  SimulationSpeed,
  SystemMonitorColorMode,
} from './systemMonitorTypes';

export const useSystemMonitorDashboard = () => {
  const [metrics, setMetrics] = useState<Record<string, SimulationMetricPoint[]>>({});
  const [deployments, setDeployments] = useState<DeploymentSummary[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<SimulationSpeed>(1);
  const storeColorMode = useFlowStore((state) => state.colorMode);
  const [colorMode, setColorMode] = useState<SystemMonitorColorMode>(() => (useFlowStore.getState().colorMode as SystemMonitorColorMode) || 'dark');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('1h');
  const [canStart, setCanStart] = useState<boolean>(false);
  const [hasHpa, setHasHpa] = useState<boolean>(false);
  const [hpaTarget, setHpaTarget] = useState<number>(80);

  useEffect(() => {
    if (storeColorMode) {
      setColorMode(storeColorMode as SystemMonitorColorMode);
    }
  }, [storeColorMode]);

  // Select a primitive string token ("hasHpa:targetCPU") from store so Zustand's === equality prevents
  // re-rendering the entire dashboard during high-speed simulation ticks when node positions or ticks change.
  const storeHpaToken = useFlowStore((state) => {
    const hpaNode = state.nodes.find((n) => n.type === 'HPA');
    const attached = state.nodes.find((n) => Array.isArray(n.data?.hpas) && n.data.hpas.length > 0);
    const exists = Boolean(hpaNode || attached);
    let target = 80;
    if (hpaNode?.data?.targetCPU) {
      target = Number(hpaNode.data.targetCPU) || 80;
    } else if (attached?.data?.hpas?.[0]?.targetCPU) {
      target = Number(attached.data.hpas[0].targetCPU) || 80;
    }
    return `${exists}:${target}`;
  });

  const [hasHpaStr, targetStr] = storeHpaToken.split(':');
  const storeHasHpa = hasHpaStr === 'true';
  const storeHpaTarget = Number(targetStr) || 80;

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

  const lastProcessedTimestampRef = useRef<number>(0);
  const pendingDataRef = useRef<any>(null);
  const rafIdRef = useRef<number | null>(null);

  const applyData = useCallback((data: any) => {
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
  }, []);

  const handleUpdate = useCallback((data: any) => {
    if (!data) return;
    if (typeof data.timestamp === 'number') {
      if (data.timestamp <= lastProcessedTimestampRef.current) {
        return;
      }
      lastProcessedTimestampRef.current = data.timestamp;
    }

    if (process.env.NODE_ENV === 'test') {
      applyData(data);
      return;
    }

    pendingDataRef.current = data;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (pendingDataRef.current) {
          applyData(pendingDataRef.current);
          pendingDataRef.current = null;
        }
      });
    }
  }, [applyData]);

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
      // Match the main window: a paused simulation is no longer "simulating",
      // but is still active so Resume and Stop remain available.
      setIsSimulating(false);
      setIsPaused(true);
    } else if (action === 'stop') {
      await gw.stopSimulation();
      setIsSimulating(false);
      setIsPaused(false);
    } else if (action === 'speed' && options?.speed) {
      await gw.setSimulationSpeed(options.speed);
      setSimulationSpeed(options.speed as SimulationSpeed);
    }
  }, [simulationSpeed]);

  useEffect(() => {
    const channel = new BroadcastChannel('monitoring-data');
    const gw = getBackendGateway();

    let hasReceivedViaBroadcast = false;

    channel.onmessage = (event) => {
      if (event.data.type === 'METRICS_UPDATE') {
        hasReceivedViaBroadcast = true;
        handleUpdate(event.data);
      } else if (event.data.type === 'THEME_SYNC') {
        setColorMode(event.data.colorMode);
      }
    };

    const unsubMetrics = gw.onEvent('metrics-update', (json: string) => {
      if (hasReceivedViaBroadcast) return;
      try {
        handleUpdate(JSON.parse(json));
      } catch {
        /* ignore parse error */
      }
    });

    const unsubSnap = gw.onEvent('simulation-snapshot-updated', (json: string) => {
      if (hasReceivedViaBroadcast) return;
      try {
        handleUpdate(JSON.parse(json));
      } catch {
        /* ignore parse error */
      }
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
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
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
    let totalTrafficRpm = 0;
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
        totalTrafficRpm += last.trafficRpm || 0;
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
      totalTrafficRpm,
      errorRate,
    };
  }, [deployments, metrics]);

  const effectiveHasHpa = hasHpa || storeHasHpa;
  const effectiveHpaTarget = storeHasHpa ? storeHpaTarget : hpaTarget;

  const toggleTheme = useCallback(() => {
    const newMode: SystemMonitorColorMode = colorMode === 'dark' ? 'light' : 'dark';
    setColorMode(newMode);
    useFlowStore.getState().setColorMode(newMode);
    const channel = new BroadcastChannel('monitoring-data');
    channel.postMessage({ type: 'THEME_SYNC', colorMode: newMode });
    channel.close();
    getBackendGateway().emitEvent('theme-sync', newMode);
    const runtime = (globalThis as any).runtime;
    runtime?.EventsEmit?.('theme-sync', newMode);
  }, [colorMode]);

  const handleCloseWindow = useCallback(() => {
    void getBackendGateway().closeSimulationWindow();
    useFlowStore.getState().setMonitoringOpen(false);
    useFlowStore.getState().setMonitoringDetached(false);
    if (!isWailsDesktop() && process.env.NODE_ENV !== 'test') {
      try {
        globalThis.close?.();
      } catch {
        // Fallback for browser popup
      }
    }
  }, []);

  const handleMaximizeWindow = useCallback(() => {
    void getBackendGateway().maximizeWindow();
  }, []);

  return {
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
    hasHpa: effectiveHasHpa,
    hpaTarget: effectiveHpaTarget,
    handleCloseWindow,
    handleMaximizeWindow,
  };
};
