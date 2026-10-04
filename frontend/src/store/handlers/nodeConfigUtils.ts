import { syncWorkloadMetadata } from './nodeUtils';
import { sanitizeSlug } from '@/lib/utils';

/**
 * Checks if a candidate node is a sibling/peer pod of the currently selected pod.
 *
 * @param node Candidate node to evaluate
 * @param selectedNode Currently active/selected node
 * @param selectedNodeLabel Label string of the selected node
 * @returns True if node is a peer pod sharing parent or standalone status, false otherwise
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
 * Calculates additional data updates when toggling visibility settings on workload cards.
 * Sets default initial values when enabling a previously unconfigured feature.
 *
 * @param field Field name being toggled (e.g. 'resources', 'webserver', 'runtime')
 * @param nextVisibility Targeted visibility boolean state
 * @param data Current node data object
 * @returns Data patch object with initial default settings
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
 * Derives automatic workload label updates based on selected webserver and runtime configurations.
 *
 * @param nextData Merged next node data object
 * @returns Patch object containing sanitized automatic label or image adjustments
 */
export const getAutoNameUpdate = (nextData: any) => {
  if (nextData.status === 'ready' && nextData.isAutoNamed) {
    let newLabel = '';
    if (nextData.webserver !== 'none' && nextData.runtime !== 'none') {
      newLabel = `${nextData.webserver}-${nextData.runtime}`;
    } else {
      newLabel = nextData.webserver !== 'none' ? nextData.webserver : nextData.runtime;
    }
    return { label: sanitizeSlug(newLabel) };
  }
  if (nextData.status === 'pending') {
    return { image: undefined };
  }
  return {};
};

/**
 * Synchronizes workload metadata, status transitions, and automatic naming rules.
 *
 * @param type K8s resource node type (e.g., 'Pod', 'Deployment')
 * @param data Existing node data
 * @param updates Incoming data updates patch
 * @returns Fully reconciled node data object
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
