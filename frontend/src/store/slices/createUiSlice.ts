import { StateCreator } from 'zustand';
import { FlowState } from '../types';
import { K8sResourceType, K8sNodeData } from '../../types';
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
        const workloads = get().nodes.filter(n => n.type === 'Deployment' || n.type === 'PodGroup');
        metricsChannel.postMessage({
          type: 'METRICS_UPDATE',
          metrics: get().simulationMetrics,
          deployments: workloads.map(d => ({ id: d.id, label: d.data.label, replicas: d.data.replicas }))
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

      // 1. Calculate Load for each workload (Deployment or PodGroup)
      const workloads = nodes.filter(n => n.type === 'Deployment' || n.type === 'PodGroup');

      workloads.forEach(dep => {
        const dData = dep.data as K8sNodeData;
        // Trace back to internet nodes through edges
        const incomingTraffic = nodes
          .filter(n => n.type === 'Internet')
          .reduce((total, internet) => {
            // Smoothly move currentTraffic towards target traffic
            const iData = internet.data as K8sNodeData;
            const targetTraffic = iData.traffic || 0;
            const currentTraffic = iData.currentTraffic || 0;
            let nextTraffic = currentTraffic;
            
            if (currentTraffic < targetTraffic) {
               nextTraffic = Math.min(targetTraffic as number, (currentTraffic as number) + 500); // Ramp up
            } else if (currentTraffic > targetTraffic) {
               nextTraffic = Math.max(targetTraffic as number, (currentTraffic as number) - 1000); // Ramp down
            }

            if (nextTraffic !== currentTraffic) {
                const idx = updatedNodes.findIndex(un => un.id === internet.id);
                if (idx !== -1) {
                    updatedNodes[idx] = { 
                      ...updatedNodes[idx], 
                      data: { ...updatedNodes[idx].data, currentTraffic: nextTraffic } 
                    };
                    hasChanges = true;
                }
            }

            // Check if internet can reach this workload using BFS/active path
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

            console.log(`[Simulation] Reachability: Internet(${internet.data.label}) -> Deployment(${dep.data.label}): ${canReach}`);
            return total + (canReach ? nextTraffic : 0);
          }, 0);

        const replicas = (dData.replicas as number) || 1;
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
          const hpaData = connectedHPA.data as K8sNodeData;
          const targetCPU = hpaData.targetCPU || 50;
          const minReplicas = hpaData.minReplicas || 1;
          const maxReplicas = hpaData.maxReplicas || 10;

          // Standard K8s HPA Formula: desiredReplicas = ceil[currentReplicas * ( currentMetricValue / desiredMetricValue )]
          const cpuRatio = cpuUsage / targetCPU;
          
          let desiredReplicas = replicas;
          
          // Only scale if outside tolerance (0.1 is standard K8s tolerance)
          if (Math.abs(1 - cpuRatio) > 0.1) {
            desiredReplicas = Math.ceil(replicas * cpuRatio);
          }

          // Bound by min/max
          desiredReplicas = Math.max(minReplicas, Math.min(maxReplicas, desiredReplicas));

          // Simple stabilization: only scale down if load has been low for a bit (simulation: 30% chance per tick)
          if (desiredReplicas < replicas && Math.random() < 0.7) {
             desiredReplicas = replicas; // Skip this scale down tick
          }

          if (desiredReplicas !== replicas) {
            const nodeIndex = updatedNodes.findIndex(n => n.id === dep.id);
            if (nodeIndex !== -1) {
              const { updatedDeployment, laidOut } = syncDeployment(updatedNodes[nodeIndex], updatedNodes, desiredReplicas - replicas, get);
              const filteredNodes = updatedNodes.filter(n => n.id !== dep.id && n.parentId !== dep.id);
              updatedNodes.length = 0;
              updatedNodes.push(...filteredNodes, updatedDeployment, ...laidOut);
              hasChanges = true;
            }
          }
          
          // Update HPA node data with current metrics for UI display
          const hpaIndex = updatedNodes.findIndex(n => n.id === connectedHPA.id);
          if (hpaIndex !== -1) {
            updatedNodes[hpaIndex] = {
              ...updatedNodes[hpaIndex],
              data: { ...updatedNodes[hpaIndex].data, currentCPU: Math.round(cpuUsage) }
            };
            hasChanges = true;
          }
        }
      });

      set({
        simulationMetrics: newMetrics,
        ...(hasChanges ? { nodes: updatedNodes } : {})
      });

      // 3. Emergency Stop if all pods are red (pending)
      const activeWorkloads = workloads.filter(w => {
         const hasTraffic = (newMetrics[w.id]?.cpu?.reduce((a, b) => a + b, 0) || 0) > 0;
         return hasTraffic;
      });

      if (activeWorkloads.length > 0) {
        const allPods = updatedNodes.filter(n => n.type === 'Pod' && n.parentId && activeWorkloads.some(w => w.id === n.parentId));
        const readyPods = allPods.filter(p => (p.data as K8sNodeData).status === 'ready');
        
        if (allPods.length > 0 && readyPods.length === 0) {
          console.error('[Simulation] CRITICAL: All pods are in pending state. Emergency shutdown.');
          
          // Stop simulation
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

          // Broadcast to detached window to close
          metricsChannel.postMessage({ type: 'DETACHED_CLOSED' });
          if (runtime) runtime.EventsEmit('detached-closed');
          
          return; // Exit the loop
        }
      }

      // Broadcast to detached window
      if (get().isMonitoringDetached) {
        const currentWorkloads = updatedNodes.filter(n => n.type === 'Deployment' || n.type === 'PodGroup');
        const payload = {
          metrics: newMetrics,
          deployments: currentWorkloads.map(d => ({ id: d.id, label: d.data.label, replicas: d.data.replicas }))
        };
        metricsChannel.postMessage({ type: 'METRICS_UPDATE', ...payload });
        if (runtime) runtime.EventsEmit('metrics-update', JSON.stringify(payload));
      }
    }, 1000);
  },
});
