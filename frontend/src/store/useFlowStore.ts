import { logger } from '../lib/logger';
import { createStore, useStore } from 'zustand';
import { FlowState } from './types';
import { createFlowSlice } from './slices/createFlowSlice';
import { createDeploymentSlice } from './slices/createDeploymentSlice';
import { createNodeSlice } from './slices/createNodeSlice';
import { createUiSlice } from './slices/createUiSlice';
import { createLogSlice } from './slices/createLogSlice';

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

// Subscription to record meaningful actions in the Go "Database"
let isApplyingHistory = false;

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
      globalThis.go.main.App.PushHistory(snapshot);
    }

    // Autosave logic
    if (state.isAutosaveEnabled && state.currentProject && state.currentProject.id !== -1) {
      const content = JSON.stringify({ nodes: state.nodes, edges: state.edges });
      if (globalThis.go?.main?.App?.UpdateProject) {
        logger.info(`[Autosave] Saving project ${state.currentProject.name}...`);
        globalThis.go.main.App.UpdateProject(state.currentProject.id, content).then((success) => {
          if (success) {
            flowStore.setState({ lastSavedSnapshot: content });
          }
        });
      }
    }
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
      lastActionName: `Applied: ${data.actionName}`
    });
    isApplyingHistory = false;
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
