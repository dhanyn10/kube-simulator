import { logger } from '@/lib/logger';
import { createStore, useStore } from 'zustand';
import type { FlowState } from '@/store/types';
import { createFlowSlice } from '@/store/slices/createFlowSlice';
import { ejectLoadBalancersFromNamespaces } from '@/store/helpers';
import { createDeploymentSlice } from '@/store/slices/createDeploymentSlice';
import { createNodeSlice } from '@/store/slices/createNodeSlice';
import { createUiSlice } from '@/store/slices/createUiSlice';
import { createLogSlice } from '@/store/slices/createLogSlice';
import { saveConfigMapsToLocal } from '@/activities/modals/configMapStorageHelpers';
import { saveSecretsToLocal } from '@/activities/modals/secretStorageHelpers';
import { K8sConfigMapItem, K8sSecretItem } from '@/types';

/**
 * Formats a Date object into an autosave key with format: autosave-ddmmyyyyhis
 * Example: autosave-10092026120008
 */
export const formatAutosaveKey = (d: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `autosave-${day}${month}${year}${hours}${minutes}${seconds}`;
};

const flowStore = createStore<FlowState>()(
  (set, get, store) => ({
    clipboard: null,
    draggedNodeId: null,
    lastActionId: 'init',
    lastActionName: 'Initialize Store',
    currentProject: null,
    lastSavedSnapshot: null,
    ...createFlowSlice(set, get, store),
    ...createDeploymentSlice(set, get, store),
    ...createNodeSlice(set, get, store),
    ...createUiSlice(set, get, store),
    ...createLogSlice(set, get, store),
  })
);

// Session autosave key generated when activity begins
let currentSessionAutosaveKey: string | null = null;
let isApplyingHistory = false;

export const getCurrentSessionAutosaveKey = (): string => {
  if (!currentSessionAutosaveKey) {
    currentSessionAutosaveKey = formatAutosaveKey(new Date());
  }
  return currentSessionAutosaveKey;
};

export const setCurrentSessionAutosaveKey = (key: string | null): void => {
  currentSessionAutosaveKey = key;
};

export const getActiveProfileName = (currentProject?: { name?: string } | null): string => {
  if (currentProject?.name?.trim()) {
    return currentProject.name.trim();
  }
  return getCurrentSessionAutosaveKey();
};

// Initial capture (base state)
setTimeout(() => {
  const state = flowStore.getState();
  const snapshot = JSON.stringify({
    nodes: state.nodes,
    edges: state.edges,
    actionName: 'Initial State',
    timestamp: Date.now()
  });
  if (globalThis.go?.main?.App?.PushHistory) {
    void globalThis.go.main.App.PushHistory(snapshot);
    logger.info('[History] Initial state recorded to Go database');
  }
}, 500);

// Core function to execute autosave


const syncSecretsOnAutosave = (state: FlowState) => {
  const allNodeSecrets: K8sSecretItem[] = [];
  state.nodes.forEach((n) => {
    if (Array.isArray(n.data?.secrets)) {
      allNodeSecrets.push(...n.data.secrets);
    }
  });

  const merged = [...allNodeSecrets];
  if (Array.isArray(state.savedSecrets)) {
    state.savedSecrets.forEach((sec) => {
      if (!merged.some((m) => m.id === sec.id || m.name === sec.name)) {
        merged.push(sec);
      }
    });
  }

  if (merged.length > 0) {
    void saveSecretsToLocal(merged);
  }
};

const syncConfigMapsOnAutosave = (state: FlowState) => {
  const allNodeConfigMaps: K8sConfigMapItem[] = [];
  state.nodes.forEach((n) => {
    if (Array.isArray(n.data?.configMaps)) {
      allNodeConfigMaps.push(...n.data.configMaps);
    }
  });

  const merged = [...allNodeConfigMaps];
  if (Array.isArray(state.savedConfigMaps)) {
    state.savedConfigMaps.forEach((scm) => {
      if (!merged.some((m) => m.id === scm.id || m.name === scm.name)) {
        merged.push(scm);
      }
    });
  }

  if (merged.length > 0) {
    void saveConfigMapsToLocal(merged);
  }
};

const executeAutosave = (state: FlowState) => {
  if (!state.isAutosaveEnabled) return;

  if (!currentSessionAutosaveKey) {
    currentSessionAutosaveKey = formatAutosaveKey(new Date());
  }

  const content = JSON.stringify({
    nodes: state.nodes,
    edges: state.edges,
    lastActionName: state.lastActionName,
    timestamp: Date.now(),
  });

  const app = globalThis.go?.main?.App;
  if (app?.SaveSetting) {
    void app.SaveSetting(currentSessionAutosaveKey, content);
    void app.SaveSetting('auto_saved_profile_latest', currentSessionAutosaveKey);
    void app.SaveSetting('auto_saved_profile_content', content);
    logger.info(`[Autosave] Profile saved under key: ${currentSessionAutosaveKey}`);
  }

  syncConfigMapsOnAutosave(state);
  syncSecretsOnAutosave(state);

  if (state.currentProject && state.currentProject.id !== -1 && app?.UpdateProject) {
    void app.UpdateProject(state.currentProject.id, content).then((success) => {
      if (success) {
        flowStore.setState({ lastSavedSnapshot: content });
      }
    });
  }
};

// Global unload handler for final save before app close
if (typeof globalThis !== 'undefined') {
  globalThis.addEventListener('beforeunload', () => {
    executeAutosave(flowStore.getState());
  });
}

flowStore.subscribe((state, prevState) => {
  if (isApplyingHistory) return;

  // Only record if lastActionId changed
  if (state.lastActionId !== prevState.lastActionId) {
    const snapshot = JSON.stringify({
      nodes: state.nodes,
      edges: state.edges,
      actionName: state.lastActionName,
      timestamp: Date.now()
    });

    logger.info(`[History] Recording event: ${state.lastActionName} (${state.lastActionId})`);
    
    // Push to Go Backend "Database"
    if (globalThis.go?.main?.App?.PushHistory) {
      void Promise.resolve(globalThis.go.main.App.PushHistory(snapshot))
        .then(() => {
          void state.fetchHistoryLogs?.();
        })
        .catch(() => {});
    }

    // Always execute autosave on state changes
    executeAutosave(state);
  }
});

// Helper to apply state from history
export const applyHistoryState = (json: string) => {
  if (!json) return;
  try {
    const data = JSON.parse(json);
    isApplyingHistory = true;
    flowStore.setState({
      nodes: Array.isArray(data.nodes) ? ejectLoadBalancersFromNamespaces(data.nodes).nodes : data.nodes,
      edges: data.edges,
      lastActionId: `history-apply-${Date.now()}`,
      lastActionName: `Applied: ${data.actionName}`
    });
    isApplyingHistory = false;
    void flowStore.getState().fetchHistoryLogs();
    logger.info(`[History] Applied state from log: ${data.actionName}`);
  } catch (e) {
    logger.error('[History] Failed to apply state:', e);
    isApplyingHistory = false;
  }
};

if (typeof globalThis !== 'undefined') {
  (globalThis as any).useFlowStore = flowStore;
}

export const useFlowStore = Object.assign(
  <T>(selector: (state: FlowState) => T) => useStore(flowStore, selector),
  flowStore
);
