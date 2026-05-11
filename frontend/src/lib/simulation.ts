import { Node, Edge } from '@xyflow/react';
import { K8sNodeData } from '../types';
import { SimulationMetricPoint } from '../store/types';
import { parseCPU, parseMemory } from './utils';
import { syncDeployment } from '../store/nodeHelpers';
import { FlowState } from '../store/types';

export const safeRandom = () => {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] / (0xffffffff + 1);
};

export const calculateReachability = (startNodes: Node[], edges: Edge[], activeSimulationEdges: string[]) => {
  const reachableNodes = new Set<string>();
  const queue = startNodes.map(n => n.id);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (reachableNodes.has(currId)) continue;
    reachableNodes.add(currId);

    edges.forEach(e => {
      if (activeSimulationEdges.includes(String(e.id)) && String(e.source) === String(currId)) {
        queue.push(String(e.target));
      }
    });
  }
  return reachableNodes;
};

export const processWorkloadSimulation = (
  dep: Node,
  nodes: Node[],
  edges: Edge[],
  activeSimulationEdges: string[],
  updatedNodes: Node[],
  newMetrics: Record<string, SimulationMetricPoint[]>,
  ticks: number,
  get: () => FlowState,
  set: (state: Partial<FlowState>) => void
): { hasChanges: boolean } => {
  let hasChanges = false;
  const dData = dep.data as K8sNodeData;

  // 1. PVC Readiness Check
  const childPods = dep.type === 'Pod' ? [dep] : nodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
  const podIds = childPods.map(p => p.id);
  const workloadIds = [dep.id, ...podIds];

  const connectedPVCs = nodes.filter(n =>
    n.type === 'PVC' &&
    edges.some(e => e.target === n.id && workloadIds.includes(String(e.source)))
  );

  const hasUnboundPVC = connectedPVCs.some(pvc => pvc.data.pvcStatus !== 'Bound');
  if (connectedPVCs.length > 0 && hasUnboundPVC) {
    connectedPVCs.forEach(pvc => {
      if (pvc.data.pvcStatus !== 'Bound' && safeRandom() > 0.7) {
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

    const currentChildPods = dep.type === 'Pod' ? [dep] : updatedNodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
    currentChildPods.forEach(pod => {
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
    return { hasChanges };
  } else if (connectedPVCs.length > 0 && !hasUnboundPVC) {
    const currentChildPods = dep.type === 'Pod' ? [dep] : updatedNodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
    currentChildPods.forEach(pod => {
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

  // 2. Traffic Calculation
  const incomingTraffic = nodes
    .filter(n => n.type === 'Internet')
    .reduce((total, internet) => {
      const iData = internet.data as K8sNodeData;
      const targetTraffic = iData.traffic ?? 1000;
      const currentTraffic = iData.currentTraffic || 0;
      let nextTraffic = currentTraffic;

      if (currentTraffic < targetTraffic) {
         nextTraffic = Math.min(targetTraffic as number, (currentTraffic as number) + 1000);
      } else if (currentTraffic > targetTraffic) {
         nextTraffic = Math.max(targetTraffic as number, (currentTraffic as number) - 2000);
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

      const reachableNodes = calculateReachability([internet], edges, activeSimulationEdges);
      const canReach = reachableNodes.has(dep.id) ||
                       nodes.some(n => n.parentId === dep.id && reachableNodes.has(n.id));

      return total + (canReach ? nextTraffic : 0);
    }, 0);

  // 3. Resource Metrics
  const replicas = (dData.replicas as number) || 1;
  const cpuLimitMilli = parseCPU(dData.cpuLimit);
  const memLimitMiB = parseMemory(dData.memoryLimit);

  const baseCpuLoadPerReplica = (incomingTraffic / 1000) * 200;
  const baseMemLoadPerReplica = (incomingTraffic / 1000) * 128;
  const noise = () => (safeRandom() * 20 - 10);

  let cpuValue = (baseCpuLoadPerReplica / replicas) + 50 + noise();
  let memValue = (baseMemLoadPerReplica / replicas) + 100 + noise();

  const isThrottled = cpuValue >= cpuLimitMilli;
  const isOOM = memValue >= memLimitMiB;

  cpuValue = Math.max(10, Math.min(cpuValue, cpuLimitMilli));
  memValue = Math.max(20, Math.min(memValue, memLimitMiB));

  const cpuPercent = (cpuValue / cpuLimitMilli) * 100;
  const memoryPercent = (memValue / memLimitMiB) * 100;

  const existing = newMetrics[dep.id] || [];
  newMetrics[dep.id] = [...existing, {
    cpuPercent,
    memoryPercent,
    cpuValue,
    memoryValue: memValue,
    cpuLimit: cpuLimitMilli,
    memoryLimit: memLimitMiB,
    isThrottled,
    isOOM
  }].slice(-30);

  // 4. OOM Crash Simulation
  if (isOOM && safeRandom() > 0.5) {
    const currentChildPods = dep.type === 'Pod' ? [dep] : updatedNodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
    if (currentChildPods.length > 0) {
      const podToCrash = currentChildPods[Math.floor(safeRandom() * currentChildPods.length)];
      const podIdx = updatedNodes.findIndex(n => n.id === podToCrash.id);

      if (podIdx !== -1 && updatedNodes[podIdx].data.status !== 'crashing') {
        updatedNodes[podIdx] = {
          ...updatedNodes[podIdx],
          data: { ...updatedNodes[podIdx].data, status: 'crashing' }
        };
        hasChanges = true;

        setTimeout(() => {
          const currentState = get();
          const nodeToRecover = currentState.nodes.find(n => n.id === podToCrash.id);
          if (nodeToRecover && nodeToRecover.data.status === 'crashing') {
             currentState.deleteNodes([nodeToRecover]);
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

  // 5. HPA Scaling
  const connectedHPA = nodes.find(n =>
    n.type === 'HPA' &&
    edges.some(e => e.source === n.id && e.target === dep.id)
  );

  if (connectedHPA) {
    const hpaData = connectedHPA.data as K8sNodeData;
    const targetCPU = hpaData.targetCPU || 50;
    const minReplicas = hpaData.minReplicas || 1;
    const maxReplicas = hpaData.maxReplicas || 10;

    const cpuRatio = cpuPercent / targetCPU;
    let desiredReplicas = replicas;

    if (Math.abs(1 - cpuRatio) > 0.1) {
      desiredReplicas = Math.ceil(replicas * cpuRatio);
    }
    desiredReplicas = Math.max(minReplicas, Math.min(maxReplicas, desiredReplicas));

    if (desiredReplicas < replicas && safeRandom() < 0.7) {
       desiredReplicas = replicas;
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

    const hpaIndex = updatedNodes.findIndex(n => n.id === connectedHPA.id);
    if (hpaIndex !== -1) {
      updatedNodes[hpaIndex] = {
        ...updatedNodes[hpaIndex],
        data: { ...updatedNodes[hpaIndex].data, currentCPU: Math.round(cpuPercent) }
      };
      hasChanges = true;
    }
  }

  return { hasChanges };
};
