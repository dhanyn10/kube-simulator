import { logger } from '../lib/logger';
import { createStore, useStore } from 'zustand';
import { FlowState } from './types';
import { createFlowSlice } from './slices/createFlowSlice';
import { createDeploymentSlice } from './slices/createDeploymentSlice';
import { createNodeSlice } from './slices/createNodeSlice';
import { createUiSlice } from './slices/createUiSlice';
import { createLogSlice } from './slices/createLogSlice';

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
    globalThis.go.main.App.PushHistory(snapshot);
    logger.info('[History] Initial state recorded to Go database');
  }
}, 500);

// Core function to execute autosave
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
    app.SaveSetting(currentSessionAutosaveKey, content);
    app.SaveSetting('auto_saved_profile_latest', currentSessionAutosaveKey);
    app.SaveSetting('auto_saved_profile_content', content);
    logger.info(`[Autosave] Profile saved under key: ${currentSessionAutosaveKey}`);
  }

  if (state.currentProject && state.currentProject.id !== -1 && app?.UpdateProject) {
    app.UpdateProject(state.currentProject.id, content).then((success) => {
      if (success) {
        flowStore.setState({ lastSavedSnapshot: content });
      }
    });
  }
};

// Window unload handler for final save before app close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
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
      Promise.resolve(globalThis.go.main.App.PushHistory(snapshot))
        .then(() => {
          state.fetchHistoryLogs?.();
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
      nodes: data.nodes,
      edges: data.edges,
      lastActionId: `history-apply-${Date.now()}`,
      lastActionName: `Applied: ${data.actionName}`
    });
    isApplyingHistory = false;
    flowStore.getState().fetchHistoryLogs();
    logger.info(`[History] Applied state from log: ${data.actionName}`);
  } catch (e) {
    logger.error('[History] Failed to apply state:', e);
    isApplyingHistory = false;
  }
};

export const useFlowStore = Object.assign(
  <T>(selector: (state: FlowState) => T) => useStore(flowStore, selector),
  flowStore
);
