import { createStore } from 'zustand';
import { useStore } from 'zustand';
import { FlowState } from './types';
import { createFlowSlice } from './slices/createFlowSlice';
import { createDeploymentSlice } from './slices/createDeploymentSlice';
import { createNodeSlice } from './slices/createNodeSlice';
import { createUiSlice } from './slices/createUiSlice';
import { createAlignmentSlice } from './slices/createAlignmentSlice';

// Import Wails bindings (assuming they will be updated by wails dev)
// @ts-ignore
import * as App from '../wailsjs/go/main/App';

const flowStore = createStore<FlowState>()(
  (...a) => ({
    clipboard: null,
    alignmentGuides: { vertical: [], horizontal: [] },
    snapGuides: { vertical: [], horizontal: [] },
    draggedNodeId: null,
    lastActionId: 'init',
    lastActionName: 'Initialize Store',
    currentProject: null,
    lastSavedSnapshot: null,
    ...createFlowSlice(...a),
    ...createDeploymentSlice(...a),
    ...createNodeSlice(...a),
    ...createUiSlice(...a),
    ...createAlignmentSlice(...a),
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
  // @ts-ignore
  if (window.go?.main?.App?.PushHistory) {
    // @ts-ignore
    window.go.main.App.PushHistory(snapshot);
    console.log('[History] Initial state recorded to Go database');
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

    console.log(`[History] Recording event: ${state.lastActionName} (${state.lastActionId})`);
    
    // Push to Go Backend "Database"
    // @ts-ignore
    if (window.go?.main?.App?.PushHistory) {
      // @ts-ignore
      window.go.main.App.PushHistory(snapshot);
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
    console.log(`[History] Applied state from log: ${data.actionName}`);
  } catch (e) {
    console.error('[History] Failed to apply state:', e);
    isApplyingHistory = false;
  }
};

export const useFlowStore = ((selector: any) => useStore(flowStore, selector)) as any;
Object.assign(useFlowStore, flowStore);
