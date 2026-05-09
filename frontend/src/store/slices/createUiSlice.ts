import { StateCreator } from 'zustand';
import { FlowState } from '../types';
import { K8sResourceType } from '../../types';
import { syncDeployment } from '../nodeHelpers';

export interface UiSlice {
  colorMode: 'dark' | 'light';
  draggingSidebarItem: K8sResourceType | null;
  isAutosaveEnabled: boolean;
  isSimulating: boolean;
  activeSimulationEdges: string[];
  simulationMetrics: Record<string, { cpu: number[], memory: number[] }>;
  isMonitoringOpen: boolean;
  isMonitoringDetached: boolean;
  toggleColorMode: () => void;
  setDraggingSidebarItem: (item: K8sResourceType | null) => void;
  toggleAutosave: () => void;
  setSimulation: (active: boolean, internetNodeIds?: string[]) => void;
  setMonitoringOpen: (open: boolean) => void;
  setMonitoringDetached: (detached: boolean) => void;
}

let simulationInterval: any = null;
const metricsChannel = new BroadcastChannel('monitoring-data');

// @ts-ignore
const runtime = window.runtime;

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
  toggleAutosave: () => set((state) => ({ isAutosaveEnabled: !state.isAutosaveEnabled })),
  setMonitoringOpen: (open) => set({ isMonitoringOpen: open }),
  setMonitoringDetached: (detached) => set({ isMonitoringDetached: detached }),
  setSimulation: (active, internetNodeIds) => {
    // Initial sync for detached window if starting simulation
    if (active && get().isMonitoringDetached) {
        const deployments = get().nodes.filter(n => n.type === 'Deployment');
        metricsChannel.postMessage({
          type: 'METRICS_UPDATE',
          metrics: get().simulationMetrics,
          deployments: deployments.map(d => ({ id: d.id, label: d.data.label, replicas: d.data.replicas }))
        });
        metricsChannel.postMessage({ type: 'THEME_SYNC', colorMode: get().colorMode });
    }

    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }

    if (!active) {
      set({ isSimulating: false, activeSimulationEdges: [], simulationMetrics: {} });
      return;
    }

    const { nodes, edges } = get();
    const startNodes = internetNodeIds
      ? nodes.filter(n => internetNodeIds.includes(n.id))
      : nodes.filter(n => n.type === 'Internet');

    if (startNodes.length === 0) return;

    const activeEdges = new Set<string>();
    const visitedNodes = new Set<string>();
    const queue: string[] = startNodes.map(n => n.id);

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      if (visitedNodes.has(currentNodeId)) continue;
      visitedNodes.add(currentNodeId);

      // Find all edges starting from this node, using safe string comparison for IDs
      const outgoingEdges = edges.filter(e => String(e.source) === String(currentNodeId));
      for (const edge of outgoingEdges) {
        activeEdges.add(String(edge.id));
        queue.push(String(edge.target));
      }
    }

    set({
      isSimulating: true,
      activeSimulationEdges: Array.from(activeEdges),
      simulationMetrics: {}
    });

    // Start Simulation Loop
    console.log('[Simulation] Starting loop...');
    simulationInterval = setInterval(() => {
      const state = get();
      if (!state.isSimulating) {
        console.log('[Simulation] Loop stopped.');
        clearInterval(simulationInterval);
        return;
      }

      const { nodes, edges, simulationMetrics } = state;
      const newMetrics = { ...simulationMetrics };
      const updatedNodes = [...nodes];
      let hasChanges = false;

      // 1. Calculate Load for each Deployment
      const deployments = nodes.filter(n => n.type === 'Deployment');

      console.log(`[Simulation] Processing ${deployments.length} deployments...`);
      deployments.forEach(dep => {
        // Trace back to internet nodes through edges
        const incomingTraffic = nodes
          .filter(n => n.type === 'Internet')
          .reduce((total, internet) => {
            // Check if internet can reach this deployment using BFS/active path
            const reachableNodes = new Set<string>();
            const queue = [internet.id];
            while (queue.length > 0) {
              const currId = queue.shift()!;
              if (reachableNodes.has(currId)) continue;
              reachableNodes.add(currId);

              // Only traverse active simulation edges
              edges.forEach(e => {
                if (state.activeSimulationEdges.includes(e.id) && e.source === currId) {
                  queue.push(e.target);
                }
              });
            }

            const canReach = reachableNodes.has(dep.id) ||
                             nodes.some(n => n.parentId === dep.id && reachableNodes.has(n.id));

            // If they are not connected by an edge but it's the only deployment,
            // let's assume it gets some baseline noise data for visibility if no other internet source is active
            // but for now let's stick to true path tracing.

            console.log(`[Simulation] Reachability: Internet(${internet.data.label}) -> Deployment(${dep.data.label}): ${canReach}`);
            return total + (canReach ? (internet.data.traffic || 0) : 0);
          }, 0);

        const replicas = dep.data.replicas || 1;
        // Always give a tiny bit of baseline load if simulation is active, to see the lines moving
        const baseLoad = (incomingTraffic / 1000) + 0.5;

        // Calculate CPU and Memory with some noise
        const noise = () => (Math.random() * 10 - 5);
        const cpuUsage = Math.min(100, Math.max(5, (baseLoad / replicas) * 50 + noise()));
        const memUsage = Math.min(100, Math.max(10, (baseLoad / replicas) * 30 + 20 + noise()));

        const existing = newMetrics[dep.id] || { cpu: [], memory: [] };
        newMetrics[dep.id] = {
          cpu: [...existing.cpu, cpuUsage].slice(-30),
          memory: [...existing.memory, memUsage].slice(-30),
        };

        // 2. HPA Scaling Logic
        const connectedHPA = nodes.find(n =>
          n.type === 'HPA' &&
          edges.some(e => e.source === n.id && e.target === dep.id)
        );

        if (connectedHPA) {
          const hpaData = connectedHPA.data;
          const targetCPU = hpaData.targetCPU || 50;
          const targetMem = hpaData.targetMemory || 50;
          const minReplicas = hpaData.minReplicas || 1;
          const maxReplicas = hpaData.maxReplicas || 10;

          let desiredReplicas = replicas;

          if (cpuUsage > targetCPU * 1.1 || memUsage > targetMem * 1.1) {
            desiredReplicas = Math.min(maxReplicas, replicas + 1);
          } else if ((cpuUsage < targetCPU * 0.7 && memUsage < targetMem * 0.7) && replicas > minReplicas) {
            // Scaling down more conservatively
            if (Math.random() > 0.7) { // 30% chance to scale down per tick to avoid thrashing
                desiredReplicas = Math.max(minReplicas, replicas - 1);
            }
          }

          if (desiredReplicas !== replicas) {
            const nodeIndex = updatedNodes.findIndex(n => n.id === dep.id);
            if (nodeIndex !== -1) {
              const { updatedDeployment, laidOut } = syncDeployment(updatedNodes[nodeIndex], updatedNodes, desiredReplicas - replicas, get);

              // Remove old pods and update deployment
              const filteredNodes = updatedNodes.filter(n => n.id !== dep.id && n.parentId !== dep.id);
              updatedNodes.length = 0;
              updatedNodes.push(...filteredNodes, updatedDeployment, ...laidOut);
              hasChanges = true;
            }
          }
        }
      });

      set({
        simulationMetrics: newMetrics,
        ...(hasChanges ? { nodes: updatedNodes } : {})
      });

      // Broadcast to detached window
      if (get().isMonitoringDetached) {
        const payload = {
          metrics: newMetrics,
          deployments: deployments.map(d => ({ id: d.id, label: d.data.label, replicas: d.data.replicas }))
        };
        metricsChannel.postMessage({ type: 'METRICS_UPDATE', ...payload });
        if (runtime) runtime.EventsEmit('metrics-update', JSON.stringify(payload));
      }
    }, 2000);
  },
});
