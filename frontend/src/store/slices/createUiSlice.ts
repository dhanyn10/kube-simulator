import { StateCreator } from 'zustand';
import { FlowState, SimulationMetricPoint } from '../types';
import { K8sResourceType, K8sNodeData } from '../../types';
import { syncDeployment } from '../nodeHelpers';
import { parseCPU, parseMemory } from '../../lib/utils';


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
      // Reset PVC status when stopping simulation
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

    console.log(`[Simulation] Starting simulation with ${activeEdges.size} active edges.`);
    set({
      isSimulating: true,
      activeSimulationEdges: Array.from(activeEdges),
      simulationMetrics: {}
    });

    // Start Simulation Loop
    console.log('[Simulation] Starting loop...');
    if (simulationInterval) clearInterval(simulationInterval);
    
    let ticks = 0;
    simulationInterval = setInterval(() => {
      ticks++;
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

      // 1. Calculate Load for each workload (Deployment, PodGroup, or Standalone Pod)
      const workloads = nodes.filter(n => 
        n.type === 'Deployment' || 
        n.type === 'PodGroup' || 
        (n.type === 'Pod' && !n.parentId)
      );

      workloads.forEach(dep => {
        const dData = dep.data as K8sNodeData;

        // 0. PVC Readiness Check
        // If a workload is connected to a PVC, it must wait for PVC to be "Bound" (simulated)
        const childPods = dep.type === 'Pod' ? [dep] : nodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
        const podIds = childPods.map(p => p.id);
        const workloadIds = [dep.id, ...podIds];

        const connectedPVCs = nodes.filter(n =>
          n.type === 'PVC' &&
          edges.some(e => e.target === n.id && workloadIds.includes(String(e.source)))
        );

        const hasUnboundPVC = connectedPVCs.some(pvc => pvc.data.pvcStatus !== 'Bound');
        if (connectedPVCs.length > 0 && hasUnboundPVC) {
          // Simulate binding process
          connectedPVCs.forEach(pvc => {
            if (pvc.data.pvcStatus !== 'Bound' && Math.random() > 0.7) {
              const pvcIdx = updatedNodes.findIndex(un => un.id === pvc.id);
              if (pvcIdx !== -1) {
                updatedNodes[pvcIdx] = {
                  ...updatedNodes[pvcIdx],
                  data: { ...updatedNodes[pvcIdx].data, pvcStatus: 'Bound' }
                };
                hasChanges = true;
              }
            }
          });

          // If still has unbound PVCs, pod stays in pending or "mounting" state
          const childPods = dep.type === 'Pod' ? [dep] : updatedNodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
          childPods.forEach(pod => {
            if (pod.data.status === 'ready') {
              const pIdx = updatedNodes.findIndex(un => un.id === pod.id);
              if (pIdx !== -1) {
                updatedNodes[pIdx] = {
                  ...updatedNodes[pIdx],
                  data: { ...updatedNodes[pIdx].data, status: 'pending' }
                };
                hasChanges = true;
              }
            }
          });

          // Skip traffic processing for this workload if PVCs aren't ready
          return;
        } else if (connectedPVCs.length > 0 && !hasUnboundPVC) {
          // PVCs are bound, ensure pods are ready if they have a runtime/webserver
          const childPods = dep.type === 'Pod' ? [dep] : updatedNodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
          childPods.forEach(pod => {
            const pData = pod.data as K8sNodeData;
            if (pData.status === 'pending' && (pData.webserver && pData.webserver !== 'none' || pData.runtime && pData.runtime !== 'none')) {
              const pIdx = updatedNodes.findIndex(un => un.id === pod.id);
              if (pIdx !== -1) {
                updatedNodes[pIdx] = {
                  ...updatedNodes[pIdx],
                  data: { ...updatedNodes[pIdx].data, status: 'ready' }
                };
                hasChanges = true;
              }
            }
          });
        }
        // Trace back to internet nodes through edges
        const incomingTraffic = nodes
          .filter(n => n.type === 'Internet')
          .reduce((total, internet) => {
            // Smoothly move currentTraffic towards target traffic
            const iData = internet.data as K8sNodeData;
            const targetTraffic = iData.traffic ?? 1000;
            const currentTraffic = iData.currentTraffic || 0;
            let nextTraffic = currentTraffic;
            
            if (currentTraffic < targetTraffic) {
               nextTraffic = Math.min(targetTraffic as number, (currentTraffic as number) + 1000); // Ramp up faster
            } else if (currentTraffic > targetTraffic) {
               nextTraffic = Math.max(targetTraffic as number, (currentTraffic as number) - 2000); // Ramp down faster
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
                if (state.activeSimulationEdges.includes(String(e.id)) && String(e.source) === String(currId)) {
                  queue.push(String(e.target));
                }
              });
            }

            const canReach = reachableNodes.has(dep.id) ||
                             nodes.some(n => n.parentId === dep.id && reachableNodes.has(n.id));

            if (ticks % 5 === 0) {
              console.log(`[Simulation] Reachability Check: Internet(${internet.id}) -> Workload(${dep.id}, ${dep.data.label}): ${canReach}. Active Edges: ${state.activeSimulationEdges.length}`);
            }
            return total + (canReach ? nextTraffic : 0);
          }, 0);

        const replicas = (dData.replicas as number) || 1;

        // Define resource limits
        const cpuLimitMilli = parseCPU(dData.cpuLimit);
        const memLimitMiB = parseMemory(dData.memoryLimit);

        // 1. Calculate base load values
        // Traffic: 1000 visits/min roughly consumes 200m CPU and 256Mi RAM per replica
        const baseCpuLoadPerReplica = (incomingTraffic / 1000) * 200;
        const baseMemLoadPerReplica = (incomingTraffic / 1000) * 128;

        const noise = () => (Math.random() * 20 - 10);

        let cpuValue = (baseCpuLoadPerReplica / replicas) + 50 + noise();
        let memValue = (baseMemLoadPerReplica / replicas) + 100 + noise();

        // Caps and statuses
        const isThrottled = cpuValue >= cpuLimitMilli;
        const isOOM = memValue >= memLimitMiB;

        cpuValue = Math.max(10, Math.min(cpuValue, cpuLimitMilli));
        memValue = Math.max(20, Math.min(memValue, memLimitMiB));

        const cpuPercent = (cpuValue / cpuLimitMilli) * 100;
        const memoryPercent = (memValue / memLimitMiB) * 100;

        const existing = newMetrics[dep.id] || [];
        const newPoint: SimulationMetricPoint = {
          cpuPercent,
          memoryPercent,
          cpuValue,
          memoryValue: memValue,
          cpuLimit: cpuLimitMilli,
          memoryLimit: memLimitMiB,
          isThrottled,
          isOOM
        };
        newMetrics[dep.id] = [...existing, newPoint].slice(-30);

        // 1.5 Handle OOM Crashes
        if (isOOM && Math.random() > 0.5) {
          const childPods = dep.type === 'Pod' ? [dep] : updatedNodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
          if (childPods.length > 0) {
            // Pick a random pod to crash
            const podToCrash = childPods[Math.floor(Math.random() * childPods.length)];
            const podIdx = updatedNodes.findIndex(n => n.id === podToCrash.id);

            if (podIdx !== -1 && updatedNodes[podIdx].data.status !== 'crashing') {
              updatedNodes[podIdx] = {
                ...updatedNodes[podIdx],
                data: { ...updatedNodes[podIdx].data, status: 'crashing' }
              };
              hasChanges = true;

              // Schedule recovery
              setTimeout(() => {
                const currentState = get();
                const nodeToRecover = currentState.nodes.find(n => n.id === podToCrash.id);
                if (nodeToRecover && nodeToRecover.data.status === 'crashing') {
                   // Delete it first (simulating termination)
                   currentState.deleteNodes([nodeToRecover]);

                   // Then re-sync deployment after a delay to "respawn" it
                   setTimeout(() => {
                      const latestState = get();
                      const parentDep = latestState.nodes.find(n => n.id === dep.id);
                      if (parentDep) {
                        const { updatedDeployment, laidOut } = syncDeployment(parentDep, latestState.nodes, 0, get);
                        const filteredNodes = latestState.nodes.filter(n => n.id !== dep.id && n.parentId !== dep.id);
                        set({ nodes: [...filteredNodes, updatedDeployment, ...laidOut] });
                      }
                   }, 2000);
                }
              }, 3000);
            }
          }
        }

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
          const cpuRatio = cpuPercent / targetCPU;
          
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
              data: { ...updatedNodes[hpaIndex].data, currentCPU: Math.round(cpuPercent) }
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

      // Broadcast to detached window - always broadcast if simulating so detached windows can sync
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
