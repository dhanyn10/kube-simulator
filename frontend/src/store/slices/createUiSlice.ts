import { StateCreator } from 'zustand';
import { FlowState, SimulationMetricPoint } from '../types';
import { K8sResourceType, K8sNodeData } from '../../types';
import { processWorkloadSimulation, calculateReachability } from '../../lib/simulation';

export interface UiSlice {
  colorMode: 'dark' | 'light';
  draggingSidebarItem: K8sResourceType | null;
  isAutosaveEnabled: boolean;
  isSimulating: boolean;
  activeSimulationEdges: string[];
  simulationMetrics: Record<string, SimulationMetricPoint[]>;
  isMonitoringOpen: boolean;
  isMonitoringDetached: boolean;
  toggleColorMode: () => void;
  setDraggingSidebarItem: (item: K8sResourceType | null) => void;
  toggleAutosave: () => void;
  setSimulation: (active: boolean, internetNodeIds?: string[]) => void;
  setMonitoringOpen: (open: boolean) => void;
  setMonitoringDetached: (detached: boolean) => void;
}

let simulationInterval: ReturnType<typeof setInterval> | null = null;
const metricsChannel = new BroadcastChannel('monitoring-data');

const runtime = typeof window !== 'undefined' ? window.runtime : undefined;

export const createUiSlice: StateCreator<FlowState, [], [], UiSlice> = (set, get) => ({
  colorMode: 'dark',
  draggingSidebarItem: null,
  isAutosaveEnabled: false,
  isSimulating: false,
  activeSimulationEdges: [],
  simulationMetrics: {},
  isMonitoringOpen: false,
  isMonitoringDetached: false,
  toggleColorMode: () => {
    const newMode = get().colorMode === 'dark' ? 'light' : 'dark';
    set({ colorMode: newMode });
    metricsChannel.postMessage({ type: 'THEME_SYNC', colorMode: newMode });
    if (runtime) runtime.EventsEmit('theme-sync', newMode);
  },
  setDraggingSidebarItem: (item) => set({ draggingSidebarItem: item }),
  toggleAutosave: () => set((state: FlowState) => ({ isAutosaveEnabled: !state.isAutosaveEnabled })),
  setMonitoringOpen: (open) => set({ isMonitoringOpen: open }),
  setMonitoringDetached: (detached) => set({ isMonitoringDetached: detached }),
  setSimulation: (active, internetNodeIds) => {
    if (active) {
        const workloads = get().nodes.filter(n => n.type === 'Deployment' || n.type === 'PodGroup' || (n.type === 'Pod' && !n.parentId));
        metricsChannel.postMessage({
          type: 'METRICS_UPDATE',
          metrics: get().simulationMetrics,
          deployments: workloads.map(d => ({ 
            id: d.id, 
            label: d.data.label, 
            replicas: d.data.replicas || 1 
          }))
        });
        metricsChannel.postMessage({ type: 'THEME_SYNC', colorMode: get().colorMode });
    }

    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }

    if (!active) {
      const resetNodes = get().nodes.map(n => {
        if (n.type === 'PVC') {
          return { ...n, data: { ...n.data, pvcStatus: 'Pending' } };
        }
        return n;
      });
      set({
        isSimulating: false,
        activeSimulationEdges: [],
        simulationMetrics: {},
        nodes: resetNodes
      });
      return;
    }

    const { nodes, edges } = get();
    const startNodes = internetNodeIds
      ? nodes.filter(n => internetNodeIds.includes(n.id))
      : nodes.filter(n => n.type === 'Internet');

    if (startNodes.length === 0) return;

    // Determine active edges for the simulation based on what's reachable from internet nodes
    const reachableNodes = calculateReachability(startNodes, edges, edges.map(e => String(e.id)));
    const activeEdges = edges.filter(e => reachableNodes.has(String(e.source))).map(e => String(e.id));

    console.log(`[Simulation] Starting simulation with ${activeEdges.length} active edges.`);
    set({
      isSimulating: true,
      activeSimulationEdges: activeEdges,
      simulationMetrics: {}
    });

    console.log('[Simulation] Starting loop...');
    
    let ticks = 0;
    simulationInterval = setInterval(() => {
      ticks++;
      const state = get();
      if (!state.isSimulating) {
        if (simulationInterval) {
          clearInterval(simulationInterval);
          simulationInterval = null;
        }
        return;
      }

      const { nodes: currentNodes, edges: currentEdges, simulationMetrics: currentMetrics } = state;
      const newMetrics = { ...currentMetrics };
      const updatedNodes = [...currentNodes];
      let hasOverallChanges = false;

      const workloads = currentNodes.filter(n =>
        n.type === 'Deployment' || 
        n.type === 'PodGroup' || 
        (n.type === 'Pod' && !n.parentId)
      );

      workloads.forEach(dep => {
        const { hasChanges } = processWorkloadSimulation(
          dep, currentNodes, currentEdges, state.activeSimulationEdges, updatedNodes, newMetrics, ticks, get, set
        );
        if (hasChanges) hasOverallChanges = true;
      });

      set({
        simulationMetrics: newMetrics,
        ...(hasOverallChanges ? { nodes: updatedNodes } : {})
      });

      // Emergency Stop Logic: Shutdown if traffic exists but no pods are ready after some time
      const activeWorkloads = workloads.filter(w => {
         const points = newMetrics[w.id] || [];
         const hasTraffic = points.length > 0 && points[points.length - 1].cpuValue > 0;
         return hasTraffic;
      });

      if (ticks > 3 && activeWorkloads.length > 0) {
        const allPods = updatedNodes.filter(n => 
          n.type === 'Pod' && (
            (n.parentId && activeWorkloads.some(w => w.id === n.parentId)) || 
            (!n.parentId && activeWorkloads.some(w => w.id === n.id))
          )
        );
        const readyPods = allPods.filter(p => (p.data as K8sNodeData).status === 'ready');
        
        if (allPods.length > 0 && readyPods.length === 0) {
          console.error('[Simulation] CRITICAL: All pods are in pending state. Emergency shutdown.');
          if (simulationInterval) {
            clearInterval(simulationInterval);
            simulationInterval = null;
          }
          set({ 
            isSimulating: false, 
            activeSimulationEdges: [], 
            simulationMetrics: {},
            isMonitoringOpen: false,
            isMonitoringDetached: false
          });
          metricsChannel.postMessage({ type: 'DETACHED_CLOSED' });
          if (runtime) runtime.EventsEmit('detached-closed');
          return;
        }
      }

      const currentWorkloads = updatedNodes.filter(n => 
        n.type === 'Deployment' || 
        n.type === 'PodGroup' || 
        (n.type === 'Pod' && !n.parentId)
      );
      const payload = {
        metrics: newMetrics,
        deployments: currentWorkloads.map(d => ({ 
          id: d.id, 
          label: d.data.label, 
          replicas: d.data.replicas || 1 
        }))
      };
      metricsChannel.postMessage({ type: 'METRICS_UPDATE', ...payload });
      if (runtime) runtime.EventsEmit('metrics-update', JSON.stringify(payload));
    }, 1000);
  },
});
