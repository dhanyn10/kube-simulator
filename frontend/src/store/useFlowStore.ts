import { logger, setLogConsumer } from '@/lib/logger';
import { getBackendGateway } from '@/gateway';
import { createStore, useStore } from 'zustand';
import type { FlowState } from '@/store/types';
import { createFlowSlice } from '@/store/slices/createFlowSlice';
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
 *
 * @param d - Date to format (defaults to now).
 * @returns Key string like `autosave-10092026120008` (padded day/month/year/hours/minutes/seconds).
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

// Register application log store with the library logger
if (typeof setLogConsumer === 'function') {
  setLogConsumer((level, message, scope) => {
    const store = flowStore.getState();
    if (scope !== undefined) {
      store.addLog?.(level, message, scope);
    } else {
      store.addLog?.(level, message);
    }
  });
}

// Session autosave key generated when activity begins
let currentSessionAutosaveKey: string | null = null;
let isApplyingHistory = false;

/**
 * Lazily generates and caches the current session autosave key (format `autosave-ddmmyyyyhis`).
 * Generated once per session; subsequent calls return the same key.
 *
 * @returns The session autosave key.
 */
export const getCurrentSessionAutosaveKey = (): string => {
  if (!currentSessionAutosaveKey) {
    currentSessionAutosaveKey = formatAutosaveKey(new Date());
  }
  return currentSessionAutosaveKey;
};

/**
 * Resets the current session autosave key (used when starting a new session/activity).
 *
 * @param key - The new key, or null to clear.
 */
export const setCurrentSessionAutosaveKey = (key: string | null): void => {
  currentSessionAutosaveKey = key;
};

/**
 * Resolves the profile name for the current session: the trimmed `currentProject.name`
 * when present, otherwise the cached session autosave key.
 *
 * @param currentProject - Optional current project context.
 * @returns Non-empty project name, or the session autosave key fallback.
 */
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
  const initGw = getBackendGateway();
  void initGw.pushHistory(snapshot).then(() => {
    logger.info('[History] Initial state recorded to Go database');
  }).catch(() => {});
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

let autosaveTimeoutId: ReturnType<typeof setTimeout> | null = null;
let pendingAutosaveState: FlowState | null = null;
let autosaveDebounceMs: number =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 0 : 400;

/**
 * Overrides the autosave debounce delay (in ms). Values <= 0 make `scheduleAutosave` flush synchronously.
 *
 * @param ms - New debounce interval.
 */
export const setAutosaveDebounceMs = (ms: number): void => {
  autosaveDebounceMs = ms;
};

/**
 * Returns the current autosave debounce delay (in ms).
 *
 * @returns The active debounce interval (0 in tests, 400 in production by default).
 */
export const getAutosaveDebounceMs = (): number => autosaveDebounceMs;

/**
 * Immediately executes any pending autosave, cancelling the scheduled debounce timer.
 */
export const flushAutosave = (): void => {
  if (autosaveTimeoutId) {
    clearTimeout(autosaveTimeoutId);
    autosaveTimeoutId = null;
  }
  if (pendingAutosaveState) {
    const stateToSave = pendingAutosaveState;
    pendingAutosaveState = null;
    executeAutosave(stateToSave);
  }
};

/**
 * Schedules a debounced autosave for the given state: stores it as `pendingAutosaveState`
 * and, when the debounce is disabled or expired, flushes immediately.
 *
 * @param state - The FlowState to persist on the next flush.
 */
export const scheduleAutosave = (state: FlowState): void => {
  pendingAutosaveState = state;

  if (autosaveDebounceMs <= 0) {
    flushAutosave();
    return;
  }

  if (autosaveTimeoutId) {
    clearTimeout(autosaveTimeoutId);
  }

  autosaveTimeoutId = setTimeout(() => {
    autosaveTimeoutId = null;
    flushAutosave();
  }, autosaveDebounceMs);
};

/**
 * Executes the autosave for the given state (when `isAutosaveEnabled` is true):
 * persists node/edge/lastActionName/timestamp snapshot via `autoGw.saveSetting`
 * (chained sequential writes), syncs node-attached secrets/configmaps locally,
 * and updates the current project when it has an id other than -1.
 *
 * @param state - The FlowState to autosave.
 */
export const executeAutosave = (state: FlowState) => {
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

  const autoGw = getBackendGateway();
  // Chained sequential writes prevent SQLite database lock contention ("database is locked")
  void Promise.resolve(autoGw.saveSetting(currentSessionAutosaveKey, content))
    .then(() => autoGw.saveSetting('auto_saved_profile_latest', currentSessionAutosaveKey!))
    .then(() => autoGw.saveSetting('auto_saved_profile_content', content))
    .then(() => {
      logger.info(`[Autosave] Profile saved under key: ${currentSessionAutosaveKey}`);
    })
    .catch((err) => {
      logger.error('[Autosave] Error saving settings:', err);
    });

  syncConfigMapsOnAutosave(state);
  syncSecretsOnAutosave(state);

  if (state.currentProject && state.currentProject.id !== -1) {
    void autoGw.updateProject(state.currentProject.id, content).then((success) => {
      if (success) {
        flowStore.setState({ lastSavedSnapshot: content });
      }
    }).catch(() => {});
  }
};

// Global unload handler for final save before app close
if (typeof globalThis !== 'undefined') {
  globalThis.addEventListener('beforeunload', () => {
    pendingAutosaveState = flowStore.getState();
    flushAutosave();
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
    const subGw = getBackendGateway();
    void Promise.resolve(subGw.pushHistory(snapshot))
      .then(() => {
        void state.fetchHistoryLogs?.();
      })
      .catch(() => {});

    // Schedule debounced autosave on state changes
    scheduleAutosave(state);
  }
});

/**
 * Applies a history state JSON snapshot to the store.
 * On parse failure, logs the error and re-enables applying history.
 *
 * @param json - Serialized history snapshot string (nodes, edges, actionName).
 */
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

/**
 * The global flow store instance exposed as a Zustand `useStore` hook with attached store methods
 * (`flowStore.setState`, `flowStore.getState`, ...). Works for both selectors and direct state access.
 */
export const useFlowStore = Object.assign(
  <T>(selector: (state: FlowState) => T) => useStore(flowStore, selector),
  flowStore
);
