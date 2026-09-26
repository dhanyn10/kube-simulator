/**
 * Helpers for Node configuration synchronization and visibility toggles.
 */

import { useFlowStore } from '@/store';
import { sortNodes } from '@/store/helpers';
import { syncDeployment } from '@/store/nodeHelpers';
import { getVisibilityUpdates, getWorkloadUpdates, isPeerPod } from '@/store/slices/node-handlers/configUtils';
import { generateRandomHash, sanitizeSlug } from '@/lib/utils';

export const syncPeersAndParent = (
  selectedNode: any,
  additionalUpdates: any,
  nextSettings: any,
  settingKey: 'displaySettings' | 'yamlSettings',
  data: any
) => {
  const state = useFlowStore.getState();
  const updateNodeData = state.updateNodeData;

  state.nodes.forEach((n: any) => {
    if (isPeerPod(n, selectedNode, data.label)) {
      updateNodeData(n.id, {
        ...(settingKey === 'yamlSettings' ? data : {}),
        ...additionalUpdates,
        [settingKey]: nextSettings,
      });
    }
  });

  if (selectedNode.parentId) {
    const parent = state.nodes.find((n: any) => n.id === selectedNode.parentId);
    if (parent) {
      updateNodeData(parent.id, {
        ...(settingKey === 'yamlSettings' ? data : {}),
        ...additionalUpdates,
        [settingKey]: nextSettings,
      });
    }
  }
};

export const syncParentPodUpdates = (selectedNode: any, updates: any) => {
  if (selectedNode.type !== 'Pod' || !selectedNode.parentId) return;
  const state = useFlowStore.getState();
  const parent = state.nodes.find((n: any) => n.id === selectedNode.parentId);
  if (!parent) return;

  const syncData: any = {};
  const syncKeys = ['cpuLimit', 'memoryLimit', 'label', 'image', 'status', 'webserver', 'runtime'];
  syncKeys.forEach((key) => {
    if (key in updates) syncData[key] = updates[key];
  });
  if (Object.keys(syncData).length > 0) {
    state.updateNodeData(parent.id, syncData);
  }
};

export const useNodeConfigHandler = (selectedNode: any) => {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const data = selectedNode.data;

  const toggleVisibility = (field: string) => {
    const currentSettings = data.displaySettings || {};
    const nextVisibility = currentSettings[field] === false;
    const additionalUpdates = getVisibilityUpdates(field, nextVisibility, data);
    const nextSettings = { ...currentSettings, [field]: nextVisibility };

    updateNodeData(selectedNode.id, { ...data, ...additionalUpdates, displaySettings: nextSettings });
    syncPeersAndParent(selectedNode, additionalUpdates, nextSettings, 'displaySettings', data);
  };

  const toggleYaml = (field: string) => {
    const currentSettings = data.yamlSettings || {};
    const nextYaml = currentSettings[field] === false;
    const nextSettings = { ...currentSettings, [field]: nextYaml };

    updateNodeData(selectedNode.id, { ...data, yamlSettings: nextSettings });
    syncPeersAndParent(selectedNode, {}, nextSettings, 'yamlSettings', data);
  };

  const performUpdate = (updates: any) => {
    let nextData = { ...data, ...updates };

    if (selectedNode.type === 'Pod' || selectedNode.type === 'Deployment') {
      nextData = getWorkloadUpdates(selectedNode.type, data, updates);
    }

    updateNodeData(selectedNode.id, nextData);
    syncParentPodUpdates(selectedNode, updates);
  };

  const podHash = data.podHash || (data.label?.includes('-') ? data.label.split('-').pop() : '') || generateRandomHash(5);
  let podBaseName = data.baseName || data.label || 'pod';
  if (!data.baseName) {
    if (data.podHash && data.replicaSuffix && data.label?.endsWith(`-${data.podHash}-${data.replicaSuffix}`)) {
      podBaseName = data.label.slice(0, -(data.podHash.length + data.replicaSuffix.length + 2));
    } else if (data.podHash && data.label?.endsWith(`-${data.podHash}`)) {
      podBaseName = data.label.slice(0, -(data.podHash.length + 1));
    }
  }

  const updatePodBaseName = (newBase: string) => {
    const cleanBase = sanitizeSlug(newBase) || 'pod';
    const state = useFlowStore.getState();
    let deploymentNode = selectedNode.type === 'Deployment' || selectedNode.type === 'ReplicaSet' ? selectedNode : null;
    if (!deploymentNode && selectedNode.parentId) {
      deploymentNode = state.nodes.find((n: any) => n.id === selectedNode.parentId) || null;
    }

    if (deploymentNode) {
      state.updateNodeData(deploymentNode.id, { label: cleanBase });
    } else {
      const currentSuffix = data.replicaSuffix ? `-${data.replicaSuffix}` : '';
      const newLabel = `${cleanBase}-${podHash}${currentSuffix}`;
      updateNodeData(selectedNode.id, {
        baseName: cleanBase,
        label: newLabel,
        podHash,
      });
    }
  };

  const randomizePodHash = () => {
    const state = useFlowStore.getState();
    let deploymentNode = selectedNode.type === 'Deployment' || selectedNode.type === 'ReplicaSet' ? selectedNode : null;
    if (!deploymentNode && selectedNode.parentId) {
      deploymentNode = state.nodes.find((n: any) => n.id === selectedNode.parentId) || null;
    }

    if (deploymentNode) {
      const { updatedDeployment, laidOut } = syncDeployment(deploymentNode, state.nodes, 0, () => state, undefined, true);
      const others = state.nodes.filter((n: any) => n.id !== deploymentNode.id && n.parentId !== deploymentNode.id);
      const nextNodes = sortNodes([...others, updatedDeployment, ...laidOut]);
      state.setNodes(nextNodes);
    } else {
      const newHash = generateRandomHash(5);
      const cleanBase = sanitizeSlug(podBaseName) || 'pod';
      const newLabel = `${cleanBase}-${newHash}`;
      updateNodeData(selectedNode.id, {
        baseName: cleanBase,
        label: newLabel,
        podHash: newHash,
      });
    }
  };

  return {
    data,
    podHash,
    podBaseName,
    updatePodBaseName,
    toggleVisibility,
    toggleYaml,
    performUpdate,
    randomizePodHash,
  };
};
