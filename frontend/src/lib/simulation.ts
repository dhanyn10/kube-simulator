import { Node, Edge } from '@xyflow/react';
import { K8sNodeData } from '../types';
import { SimulationMetricPoint, FlowState } from '../store/types';
import { parseCPU, parseMemory } from './utils';
import { syncDeployment } from '../store/nodeHelpers';

export interface SimulationContext {
  nodes: Node[];
  edges: Edge[];
  activeSimulationEdges: string[];
  updatedNodes: Node[];
  newMetrics: Record<string, SimulationMetricPoint[]>;
  ticks: number;
  get: () => FlowState;
  set: (state: Partial<FlowState>) => void;
}

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

const checkPvcReadiness = (dep: Node, ctx: SimulationContext) => {
  let hasChanges = false;
  const childPods = dep.type === 'Pod' ? [dep] : ctx.nodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
  const workloadIds = [dep.id, ...childPods.map(p => p.id)];

  const connectedPVCs = ctx.nodes.filter(n =>
    n.type === 'PVC' && ctx.edges.some(e => e.target === n.id && workloadIds.includes(String(e.source)))
  );

  const hasUnboundPVC = connectedPVCs.some(pvc => pvc.data.pvcStatus !== 'Bound');

  if (connectedPVCs.length > 0 && hasUnboundPVC) {
    connectedPVCs.forEach(pvc => {
      if (pvc.data.pvcStatus !== 'Bound' && safeRandom() > 0.7) {
        const pvcIdx = ctx.updatedNodes.findIndex(un => un.id === pvc.id);
        if (pvcIdx !== -1) {
          ctx.updatedNodes[pvcIdx] = { ...ctx.updatedNodes[pvcIdx], data: { ...ctx.updatedNodes[pvcIdx].data, pvcStatus: 'Bound' } };
          hasChanges = true;
        }
      }
    });

    const currentChildPods = dep.type === 'Pod' ? [dep] : ctx.updatedNodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
    currentChildPods.forEach(pod => {
      if (pod.data.status === 'ready') {
        const pIdx = ctx.updatedNodes.findIndex(un => un.id === pod.id);
        if (pIdx !== -1) {
          ctx.updatedNodes[pIdx] = { ...ctx.updatedNodes[pIdx], data: { ...ctx.updatedNodes[pIdx].data, status: 'pending' } };
          hasChanges = true;
        }
      }
    });
    return { hasChanges, isBlocked: true };
  } else if (connectedPVCs.length > 0 && !hasUnboundPVC) {
    const currentChildPods = dep.type === 'Pod' ? [dep] : ctx.updatedNodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
    currentChildPods.forEach(pod => {
      const pData = pod.data as K8sNodeData;
      if (pData.status === 'pending' && (pData.webserver && pData.webserver !== 'none' || pData.runtime && pData.runtime !== 'none')) {
        const pIdx = ctx.updatedNodes.findIndex(un => un.id === pod.id);
        if (pIdx !== -1) {
          ctx.updatedNodes[pIdx] = { ...ctx.updatedNodes[pIdx], data: { ...ctx.updatedNodes[pIdx].data, status: 'ready' } };
          hasChanges = true;
        }
      }
    });
  }

  return { hasChanges, isBlocked: false };
};

const calculateIncomingTraffic = (dep: Node, ctx: SimulationContext) => {
  let hasChanges = false;
  const traffic = ctx.nodes
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
          const idx = ctx.updatedNodes.findIndex(un => un.id === internet.id);
          if (idx !== -1) {
              ctx.updatedNodes[idx] = { ...ctx.updatedNodes[idx], data: { ...ctx.updatedNodes[idx].data, currentTraffic: nextTraffic } };
              hasChanges = true;
          }
      }

      const reachableNodes = calculateReachability([internet], ctx.edges, ctx.activeSimulationEdges);
      const canReach = reachableNodes.has(dep.id) || ctx.nodes.some(n => n.parentId === dep.id && reachableNodes.has(n.id));

      return total + (canReach ? nextTraffic : 0);
    }, 0);

  return { traffic, hasChanges };
};

const calculateResourceMetrics = (dep: Node, incomingTraffic: number, ctx: SimulationContext) => {
  const dData = dep.data as K8sNodeData;
  const replicas = (dData.replicas as number) || 1;
  const cpuLimitMilli = parseCPU(dData.cpuLimit);
  const memLimitMiB = parseMemory(dData.memoryLimit);

  const noise = () => (safeRandom() * 20 - 10);
  let cpuValue = ((incomingTraffic / 1000) * 200 / replicas) + 50 + noise();
  let memValue = ((incomingTraffic / 1000) * 128 / replicas) + 100 + noise();

  const isThrottled = cpuValue >= cpuLimitMilli;
  const isOOM = memValue >= memLimitMiB;

  cpuValue = Math.max(10, Math.min(cpuValue, cpuLimitMilli));
  memValue = Math.max(20, Math.min(memValue, memLimitMiB));

  const cpuPercent = (cpuValue / cpuLimitMilli) * 100;
  const memoryPercent = (memValue / memLimitMiB) * 100;

  const existing = ctx.newMetrics[dep.id] || [];
  ctx.newMetrics[dep.id] = [...existing, {
    cpuPercent, memoryPercent, cpuValue, memoryValue: memValue,
    cpuLimit: cpuLimitMilli, memoryLimit: memLimitMiB, isThrottled, isOOM
  }].slice(-30);

  return { cpuPercent, isOOM };
};

const handleOomCrashes = (dep: Node, isOOM: boolean, ctx: SimulationContext) => {
  if (!isOOM || safeRandom() <= 0.5) return false;

  const currentChildPods = dep.type === 'Pod' ? [dep] : ctx.updatedNodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
  if (currentChildPods.length === 0) return false;

  const podToCrash = currentChildPods[Math.floor(safeRandom() * currentChildPods.length)];
  const podIdx = ctx.updatedNodes.findIndex(n => n.id === podToCrash.id);

  if (podIdx === -1 || ctx.updatedNodes[podIdx].data.status === 'crashing') return false;

  ctx.updatedNodes[podIdx] = { ...ctx.updatedNodes[podIdx], data: { ...ctx.updatedNodes[podIdx].data, status: 'crashing' } };

  setTimeout(() => {
    const currentState = ctx.get();
    const nodeToRecover = currentState.nodes.find(n => n.id === podToCrash.id);
    if (nodeToRecover && nodeToRecover.data.status === 'crashing') {
       currentState.deleteNodes([nodeToRecover]);
       setTimeout(() => {
          const latestState = ctx.get();
          const parentDep = latestState.nodes.find(n => n.id === dep.id);
          if (parentDep) {
            const { updatedDeployment, laidOut } = syncDeployment(parentDep, latestState.nodes, 0, ctx.get);
            const filteredNodes = latestState.nodes.filter(n => n.id !== dep.id && n.parentId !== dep.id);
            ctx.set({ nodes: [...filteredNodes, updatedDeployment, ...laidOut] });
          }
       }, 2000);
    }
  }, 3000);

  return true;
};

const handleHpaScaling = (dep: Node, cpuPercent: number, ctx: SimulationContext) => {
  const connectedHPA = ctx.nodes.find(n => n.type === 'HPA' && ctx.edges.some(e => e.source === n.id && e.target === dep.id));
  if (!connectedHPA) return false;

  const hpaData = connectedHPA.data as K8sNodeData;
  const replicas = (dep.data as K8sNodeData).replicas || 1;
  const targetCPU = hpaData.targetCPU || 50;
  const cpuRatio = cpuPercent / targetCPU;

  let desiredReplicas = replicas;
  if (Math.abs(1 - cpuRatio) > 0.1) {
    desiredReplicas = Math.max(hpaData.minReplicas || 1, Math.min(hpaData.maxReplicas || 10, Math.ceil(replicas * cpuRatio)));
  }

  if (desiredReplicas < replicas && safeRandom() < 0.7) desiredReplicas = replicas;

  let hasChanges = false;
  if (desiredReplicas !== replicas) {
    const nodeIndex = ctx.updatedNodes.findIndex(n => n.id === dep.id);
    if (nodeIndex !== -1) {
      const { updatedDeployment, laidOut } = syncDeployment(ctx.updatedNodes[nodeIndex], ctx.updatedNodes, desiredReplicas - replicas, ctx.get);
      const filteredNodes = ctx.updatedNodes.filter(n => n.id !== dep.id && n.parentId !== dep.id);
      ctx.updatedNodes.length = 0;
      ctx.updatedNodes.push(...filteredNodes, updatedDeployment, ...laidOut);
      hasChanges = true;
    }
  }

  const hpaIndex = ctx.updatedNodes.findIndex(n => n.id === connectedHPA.id);
  if (hpaIndex !== -1) {
    ctx.updatedNodes[hpaIndex] = { ...ctx.updatedNodes[hpaIndex], data: { ...ctx.updatedNodes[hpaIndex].data, currentCPU: Math.round(cpuPercent) } };
    hasChanges = true;
  }
  return hasChanges;
};

export const processWorkloadSimulation = (dep: Node, ctx: SimulationContext): { hasChanges: boolean } => {
  const pvcResult = checkPvcReadiness(dep, ctx);
  if (pvcResult.isBlocked) return { hasChanges: pvcResult.hasChanges };

  const trafficResult = calculateIncomingTraffic(dep, ctx);
  const metricsResult = calculateResourceMetrics(dep, trafficResult.traffic, ctx);

  const oomChanged = handleOomCrashes(dep, metricsResult.isOOM, ctx);
  const hpaChanged = handleHpaScaling(dep, metricsResult.cpuPercent, ctx);

  return { hasChanges: pvcResult.hasChanges || trafficResult.hasChanges || oomChanged || hpaChanged };
};
