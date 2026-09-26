/**
 * Helpers for Node configuration synchronization and visibility toggles.
 */

import { useFlowStore } from '@/store';
import { getVisibilityUpdates, getWorkloadUpdates, isPeerPod } from '@/store/slices/node-handlers/configUtils';
import { generateRandomHash, sanitizeSlug, formatPodName, parsePodName } from '@/lib/utils';

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

  const state = useFlowStore.getState();
  const parentNode = selectedNode.parentId
    ? state.nodes.find((n: any) => n.id === selectedNode.parentId)
    : null;

  const parentBaseName = parentNode?.data?.label;
  const parsed = parsePodName(data.label, parentBaseName || data.podBaseName, data.podHash);

  const podBaseName = parentBaseName || data.podBaseName || parsed.baseName;
  const podSuffix = parsed.fullSuffix;
  const internalPodHash = data.podHash || parsed.podHash;

  const updatePodBaseName = (newBase: string) => {
    const cleanBase = sanitizeSlug(newBase);
    if (selectedNode.type === 'Pod' && selectedNode.parentId) {
      const parent = state.nodes.find((n: any) => n.id === selectedNode.parentId);
      if (parent) {
        updateNodeData(parent.id, { label: cleanBase });
        return;
      }
    }
    const newLabel = formatPodName(cleanBase, parsed.rsHash, internalPodHash);
    updateNodeData(selectedNode.id, {
      label: newLabel,
      podBaseName: cleanBase,
      podHash: internalPodHash,
    });
  };

  const randomizePodHash = () => {
    const newHash = generateRandomHash(5);
    const base = parentBaseName || data.podBaseName || parsed.baseName || 'pod';
    const deployHash = (parentNode?.data?.deployHash as string) || '';
    const rsHash = parsed.rsHash || (deployHash ? deployHash.substring(0, 5) : undefined);

    const newLabel = formatPodName(base, rsHash, newHash);
    updateNodeData(selectedNode.id, {
      label: newLabel,
      podHash: newHash,
      podBaseName: base,
    });
  };

  return {
    data,
    podHash: podSuffix,
    podBaseName,
    updatePodBaseName,
    toggleVisibility,
    toggleYaml,
    performUpdate,
    randomizePodHash,
  };
};
