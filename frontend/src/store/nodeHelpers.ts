import { Node } from '@xyflow/react';
import type { FlowState } from '@/store/types';
import { 
  getNodeData, 
  syncPodsInDeployment, 
  resolveGlobalCollisions
} from '@/store/helpers';
import { getPodMinimumSize } from '@/lib/podSizing';
import { syncWorkloadMetadata, getInitialData, createNodeHandlers } from '@/store/handlers/nodeUtils';
import { calculateDeploymentLayoutWithYoga } from './deploymentYogaLayout';

export const attachHandlers = createNodeHandlers;

export const isChildPodOf = (node: Node, containerId: string): boolean => {
  if (node.type !== 'Pod') return false;
  const parentId = node.parentId ?? (node.data as any)?.parentId;
  return parentId !== undefined && String(parentId) === String(containerId);
};

const migrateLegacySecrets = (nodes: any[]) => {
  nodes.forEach((node) => {
    if (node.type === 'Secret' && node.data?.configData && Array.isArray(node.data.configData)) {
      const parentId = node.parentId;
      const targetNode = parentId ? nodes.find(n => n.id === parentId) : null;
      if (targetNode) {
        const legacySecretItem = {
          id: node.id,
          name: node.data.label || node.id,
          type: 'Opaque',
          secretData: node.data.configData,
        };
        const existing = targetNode.data.secrets || [];
        if (!existing.some((s: any) => s.id === legacySecretItem.id)) {
          targetNode.data.secrets = [...existing, legacySecretItem];
        }
      }
    }
  });
};

const layoutWorkloadContainers = (nodes: any[], get: () => FlowState): any[] => {
  let nextNodes = nodes;
  const workloads = nextNodes.filter(n => n.type === 'Deployment' || n.type === 'StatefulSet' || n.type === 'ReplicaSet');
  workloads.forEach(dept => {
    const childPods = nextNodes.filter(n => isChildPodOf(n, dept.id));
    const deptWithReplicas = {
      ...dept,
      data: {
        ...dept.data,
        replicas: childPods.length > 0 ? Math.max(dept.data?.replicas || 0, childPods.length) : (dept.data?.replicas || 0)
      }
    };
    const { updatedDeployment, laidOut } = syncDeployment(deptWithReplicas, nextNodes, 0, get);
    nextNodes = nextNodes.filter(n => !isChildPodOf(n, dept.id));
    nextNodes = [...nextNodes.map(n => n.id === dept.id ? updatedDeployment : n), ...laidOut];
  });
  return nextNodes;
};

export const hydrateNodes = (nodes: any[], get: () => FlowState): any[] => {
  const preparedNodes = nodes.map(n => ({ ...n, data: { ...n.data } }));
  migrateLegacySecrets(preparedNodes);

  const hydrated = preparedNodes.map(node => {
    const handlers = attachHandlers(node.id, get);
    
    const defaultInitialData = getInitialData(node.type, node.id, get);
    const displaySettings = {
      ...defaultInitialData.displaySettings,
      ...node.data.displaySettings
    };
    const yamlSettings = {
      ...defaultInitialData.yamlSettings,
      ...node.data.yamlSettings
    };

    const data = syncWorkloadMetadata(node.type, {
      ...defaultInitialData,
      ...node.data,
      displaySettings,
      yamlSettings
    });

    return {
      ...node,
      data: {
        ...data,
        ...handlers,
        type: node.type,
      }
    };
  });

  const nextNodes = layoutWorkloadContainers(hydrated, get);
  return resolveGlobalCollisions(nextNodes);
};

export const syncDeployment = (
  deployment: Node, 
  currentNodes: Node[], 
  replicasChange: number, 
  get: () => FlowState,
  podToInclude?: Node,
  forceRandomize = false
) => {
  const data = getNodeData(deployment);
  let pods = currentNodes.filter(n => isChildPodOf(n, deployment.id));
  if (podToInclude) {
    pods = [podToInclude, ...pods.filter(p => p.id !== podToInclude.id)];
  }

  const updatedDeployment = {
    ...deployment,
    data: { ...data, replicas: Math.max(0, Math.min(1000, (data.replicas || 0) + replicasChange)) }
  };

  const syncedPods = syncPodsInDeployment(updatedDeployment, pods, pods[0], forceRandomize);

  if (syncedPods.length > 0) {
    const podTemplate = syncedPods[0].data as any;
    updatedDeployment.data = {
      ...updatedDeployment.data,
      status: podTemplate.status,
      runtime: podTemplate.runtime,
      webserver: podTemplate.webserver,
      image: podTemplate.image,
    };
  }

  const withHandlers = syncedPods.map(p => ({ 
    ...p, 
    parentId: deployment.id,
    data: {
      ...p.data,
      parentId: deployment.id,
      ...attachHandlers(p.id, get)
    }
  }));

  const { width, height, laidOutPods: laidOut } = calculateDeploymentLayoutWithYoga(updatedDeployment, withHandlers);

  const finalDeployment = {
    ...updatedDeployment,
    width,
    height,
    style: { ...updatedDeployment.style, width, height }
  };

  return { updatedDeployment: finalDeployment, laidOut };
};

export const calculateDeploymentDimensions = (deployment: Node, laidOut: Node[]) => {
  const { width, height } = calculateDeploymentLayoutWithYoga(deployment, laidOut);
  return { width, height };
};

const computeChildrenBounds = (children: Node[], container: Node, padding: number) => {
  let minX = 0;
  let minY = 0;
  let maxX = Math.max(container.width || 0, container.measured?.width || 320);
  let maxY = Math.max(container.height || 0, container.measured?.height || 160);

  children.forEach(child => {
    if (child.type === 'Internet') return;

    const childMinSize = getChildMinSize(child);
    const childWidth = Math.max(child.width || 0, child.measured?.width || 0, childMinSize.width);
    const childHeight = Math.max(child.height || 0, child.measured?.height || 0, childMinSize.height);

    if (child.position.x < padding / 2) minX = Math.min(minX, child.position.x - padding);
    if (child.position.y < padding / 2) minY = Math.min(minY, child.position.y - padding);

    maxX = Math.max(maxX, child.position.x + childWidth + padding);
    maxY = Math.max(maxY, child.position.y + childHeight + padding);
  });

  return { minX, minY, maxX, maxY };
};

export const syncContainerSize = (containerId: string | undefined, currentNodes: Node[]): Node[] => {
  if (!containerId) return currentNodes;

  const container = currentNodes.find(n => n.id === containerId);
  if (!container) return currentNodes;

  const children = currentNodes.filter(n => n.parentId === containerId);
  if (children.length === 0) return currentNodes;

  const padding = 40;
  const { minX, minY, maxX, maxY } = computeChildrenBounds(children, container, padding);

  const shiftX = minX < 0 ? Math.abs(minX) : 0;
  const shiftY = minY < 0 ? Math.abs(minY) : 0;
  const newWidth = maxX + shiftX;
  const newHeight = maxY + shiftY;

  const isSizeChanged = Math.abs(newWidth - (container.width || 0)) > 1 ||
                        Math.abs(newHeight - (container.height || 0)) > 1 ||
                        shiftX > 0 || shiftY > 0;

  if (!isSizeChanged) return currentNodes;

  const nextNodes = currentNodes.map(n => {
    if (n.id === containerId) {
      return {
        ...n,
        position: { x: n.position.x - shiftX, y: n.position.y - shiftY },
        width: newWidth, height: newHeight,
        style: { ...n.style, width: newWidth, height: newHeight }
      };
    }
    if (n.parentId === containerId && (shiftX > 0 || shiftY > 0)) {
      return {
        ...n,
        position: { x: n.position.x + shiftX, y: n.position.y + shiftY }
      };
    }
    return n;
  });

  return container.parentId ? syncContainerSize(container.parentId, nextNodes) : nextNodes;
};

const getChildMinSize = (child: Node) => {
    if (child.type === 'Pod') return getPodMinimumSize(child.data);
    if (['Deployment', 'StatefulSet', 'Namespace', 'ReplicaSet'].includes(child.type || '')) {
        return { width: child.width || 320, height: child.height || 160 };
    }
    return { width: 160, height: 80 };
};
