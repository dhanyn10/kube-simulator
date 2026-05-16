import { syncWorkloadMetadata } from './nodeUtils';

/**
 * Checks if a node is a peer pod of the selected node.
 */
export const isPeerPod = (node: any, selectedNode: any, selectedNodeLabel: string) => {
  if (node.type !== 'Pod' || node.id === selectedNode.id) return false;

  if (selectedNode.parentId && node.parentId === selectedNode.parentId) {
    return node.data.label === selectedNodeLabel;
  }

  if (!selectedNode.parentId && !node.parentId) {
    return node.data.label === selectedNodeLabel;
  }

  return false;
};

/**
 * Calculates additional updates based on visibility toggles.
 * If enabling a feature that is currently empty, set default values.
 */
export const getVisibilityUpdates = (field: string, nextVisibility: boolean, data: any) => {
  const updates: any = {};
  if (nextVisibility) {
    if (field === 'resources' && !data.cpuLimit && !data.memoryLimit) {
      Object.assign(updates, {
        cpuRequest: '100m',
        cpuLimit: '250m',
        memoryRequest: '128Mi',
        memoryLimit: '256Mi',
      });
    }
    if (field === 'webserver' && (!data.webserver || data.webserver === 'none')) {
      updates.webserver = 'nginx';
    }
    if (field === 'runtime' && (!data.runtime || data.runtime === 'none')) {
      updates.runtime = 'nodejs';
    }
  }
  return updates;
};

/**
 * Handles automatic naming logic for workloads based on webserver and runtime.
 */
export const getAutoNameUpdate = (nextData: any) => {
  if (nextData.status === 'ready' && nextData.isAutoNamed) {
    let newLabel = '';
    if (nextData.webserver !== 'none' && nextData.runtime !== 'none') {
      newLabel = `${nextData.webserver}-${nextData.runtime}`;
    } else {
      newLabel = nextData.webserver !== 'none' ? nextData.webserver : nextData.runtime;
    }
    return { label: newLabel.toLowerCase().replace(/\s+/g, '-') };
  }
  if (nextData.status === 'pending') {
    return { image: undefined };
  }
  return {};
};

/**
 * Syncs workload metadata and handles status-based updates.
 */
export const getWorkloadUpdates = (type: string, data: any, updates: any) => {
  let nextData = { ...data, ...updates };
  const metadataUpdates = syncWorkloadMetadata(type, nextData);
  nextData = { ...nextData, ...metadataUpdates };

  const autoNameUpdates = getAutoNameUpdate(nextData);
  nextData = { ...nextData, ...autoNameUpdates };

  if (type === 'Pod' && data.parentId && !('replicas' in updates)) {
    delete nextData.replicas;
    delete nextData.parentReplicas;
  }
  return nextData;
};
