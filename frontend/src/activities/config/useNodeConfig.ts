/**
 * Helpers for Node configuration synchronization and visibility toggles.
 */

import { useFlowStore } from '@/store';
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

export const parsePodLabelAndHash = (selectedNode: any) => {
  const data = selectedNode?.data || {};
  const fullLabel = data.label || 'pod';
  const storedPodHash = data.podHash;

  if (selectedNode?.parentId) {
    const state = useFlowStore.getState();
    const parent = state.nodes.find((n: any) => n.id === selectedNode.parentId);
    if (parent?.data?.label && fullLabel.startsWith(`${parent.data.label}-`)) {
      const podBaseName = parent.data.label;
      const podHash = fullLabel.slice(podBaseName.length + 1) || storedPodHash || generateRandomHash(5);
      return { podBaseName, podHash };
    }
  }

  const parts = fullLabel.split('-');
  if (parts.length > 1) {
    const hashSegments: string[] = [];
    while (parts.length > 1) {
      const last = parts[parts.length - 1];
      if (last.length >= 4 && last.length <= 10 && /^[a-z0-9]+$/i.test(last)) {
        hashSegments.unshift(parts.pop()!);
      } else {
        break;
      }
    }
    if (hashSegments.length > 0) {
      const podHash = hashSegments.join('-');
      const podBaseName = parts.join('-') || 'pod';
      return { podBaseName, podHash };
    }
  }

  if (storedPodHash && fullLabel.endsWith(`-${storedPodHash}`)) {
    const podBaseName = fullLabel.slice(0, -(storedPodHash.length + 1)) || 'pod';
    return { podBaseName, podHash: storedPodHash };
  }

  const podHash = storedPodHash || generateRandomHash(5);
  return { podBaseName: fullLabel, podHash };
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

  const { podBaseName, podHash } = parsePodLabelAndHash(selectedNode);

  const updatePodBaseName = (newBase: string) => {
    const cleanBase = sanitizeSlug(newBase);
    const newLabel = cleanBase ? `${cleanBase}-${podHash}` : podHash;
    updateNodeData(selectedNode.id, {
      label: newLabel,
      podHash,
    });
  };

  const randomizePodHash = () => {
    const currentHash = podHash || generateRandomHash(5);
    const newHashSegments = currentHash.split('-').map(() => generateRandomHash(5));
    const newPodHash = newHashSegments.join('-');

    const cleanBase = sanitizeSlug(podBaseName) || 'pod';
    const newLabel = `${cleanBase}-${newPodHash}`;
    updateNodeData(selectedNode.id, {
      label: newLabel,
      podHash: newPodHash,
    });
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
