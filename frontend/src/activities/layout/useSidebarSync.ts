import { useEffect, useRef } from 'react';
import { useFlowStore } from '@/store';
import { getBackendGateway } from '@/gateway';
import { K8sResourceType } from '@/types';

export const SIDEBAR_CHANNEL_NAME = 'sidebar-sync-channel';

export interface SidebarSyncMessage {
  type:
    | 'ADD_NODE'
    | 'SYNC_STATE'
    | 'STATE_UPDATE'
    | 'ATTACH_SIDEBAR'
    | 'DETACH_SIDEBAR'
    | 'UPDATE_NODE_DATA'
    | 'SELECT_NODE'
    | 'MODAL_REQUEST';
  side?: 'left' | 'right';
  nodeType?: K8sResourceType;
  nodeId?: string;
  modalId?: string;
  data?: any;
  state?: {
    colorMode?: 'dark' | 'light';
    configuringNodeId?: string | null;
    configuringEdgeId?: string | null;
    nodes?: any[];
    edges?: any[];
  };
}

type StoreState = ReturnType<typeof useFlowStore.getState>;
type BackendGateway = ReturnType<typeof getBackendGateway>;

/**
 * Removes function-valued properties so nodes/edges can cross the BroadcastChannel.
 */
const sanitizeForBroadcast = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(sanitizeForBroadcast);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      if (typeof val !== 'function') {
        out[key] = sanitizeForBroadcast(val);
      }
    }
    return out;
  }
  return value;
};

const sendStateToWindow = (channel: BroadcastChannel, store: StoreState) => {
  channel.postMessage({
    type: 'STATE_UPDATE',
    state: {
      colorMode: store.colorMode,
      configuringNodeId: store.configuringNodeId,
      configuringEdgeId: store.configuringEdgeId,
      nodes: sanitizeForBroadcast(store.nodes),
      edges: sanitizeForBroadcast(store.edges),
    },
  });
};

const attachSidebarToMainWindow = (side: 'left' | 'right', store: StoreState, gw: BackendGateway) => {
  if (side === 'left') {
    store.setSidebarDetached(false);
    store.setSidebarVisible(true);
  } else if (side === 'right') {
    store.setRightSidebarDetached(false);
    store.setRightSidebarVisible(true);
  }
  gw.closeSidebarWindow(side);
};

const handleMainWindowMessage = (
  msg: SidebarSyncMessage,
  channel: BroadcastChannel,
  store: StoreState,
  gw: BackendGateway,
) => {
  if (msg.type === 'SYNC_STATE') {
    sendStateToWindow(channel, store);
  } else if (msg.type === 'ADD_NODE' && msg.nodeType) {
    store.addNode(msg.nodeType);
  } else if (msg.type === 'UPDATE_NODE_DATA' && msg.nodeId && msg.data) {
    store.updateNodeData(msg.nodeId, msg.data);
  } else if (msg.type === 'ATTACH_SIDEBAR' && msg.side) {
    attachSidebarToMainWindow(msg.side, store, gw);
  } else if (msg.type === 'MODAL_REQUEST' && msg.modalId) {
    openModalRequest(msg.modalId, msg.nodeId ?? null);
  }
};

/** Returns true when running inside the detached right sidebar window. */
export const isDetachedRightWindow = (): boolean => {
  const searchParams = new URLSearchParams(globalThis.location?.search || '');
  return searchParams.get('mode') === 'sidebar-right';
};

const openModalRequest = (modalId: string, nodeId: string | null = null) => {
  const store = useFlowStore.getState();
  if (modalId === 'INTERNET_PROFILE_MODAL') {
    if (nodeId) store.setInternetProfileTargetId(nodeId);
    store.setInternetProfileModalOpen(true);
  } else if (modalId === 'KUBE_IAM') {
    store.setKubeIamModalOpen(true);
  } else if (modalId === 'WORKER_BUDGET') {
    store.setWorkerBudgetModalOpen(true);
  } else if (modalId === 'CONFIG_MAP_LIST') {
    store.setConfigMapModalTargetNode({ id: 'cluster-storage', label: 'Cluster ConfigMaps', initialViewMode: 'list' });
  } else if (modalId === 'SECRET_LIST') {
    store.setSecretModalTargetNode({ id: 'cluster-storage', label: 'Cluster Secrets', initialViewMode: 'list' });
  } else if (modalId === 'OVERVIEW_HPA') {
    store.setActiveOverviewModal('HPA');
  } else if (modalId === 'OVERVIEW_RESOURCE_LIMIT') {
    store.setActiveOverviewModal('ResourceLimit');
  }
};

const handleDetachedMessage = (msg: SidebarSyncMessage, store: StoreState) => {
  if (msg.type !== 'STATE_UPDATE') return;
  const state = msg.state ?? {};
  const { colorMode, configuringNodeId, configuringEdgeId, nodes, edges } = state;
  const updates: {
    colorMode?: 'dark' | 'light';
    configuringNodeId?: string | null;
    configuringEdgeId?: string | null;
    nodes?: any[];
    edges?: any[];
  } = {};
  if (colorMode && colorMode !== store.colorMode) updates.colorMode = colorMode;
  if (configuringNodeId !== undefined) updates.configuringNodeId = configuringNodeId;
  if (configuringEdgeId !== undefined) updates.configuringEdgeId = configuringEdgeId;
  if (nodes !== undefined) updates.nodes = nodes;
  if (edges !== undefined) updates.edges = edges;
  if (Object.keys(updates).length > 0) {
    useFlowStore.setState(updates);
  }
};

/** Tracks the last broadcasted selecting state so we only broadcast real changes. */
const createSettingsSyncSubscriber = (channel: BroadcastChannel, gw: BackendGateway) => {
  const prev = {
    configuringNodeId: useFlowStore.getState().configuringNodeId,
    configuringEdgeId: useFlowStore.getState().configuringEdgeId,
  };

  return (state: StoreState) => {
    const changed = state.configuringNodeId !== prev.configuringNodeId || state.configuringEdgeId !== prev.configuringEdgeId;
    if (!changed) return;
    prev.configuringNodeId = state.configuringNodeId;
    prev.configuringEdgeId = state.configuringEdgeId;
    if (!state.isRightSidebarDetached) return;
    // Broadcast so the detached right window switches to the Settings tab.
    sendStateToWindow(channel, state);
    gw.emitEvent('sidebar-settings-selected', state.configuringNodeId, state.configuringEdgeId);
  };
};

/** Applies a selecting change reported by the main window to the detached window's store. */
const applyDetachedSettings = (nodeId: string | null, edgeId: string | null) => {
  useFlowStore.setState({ configuringNodeId: nodeId, configuringEdgeId: edgeId });
};

/**
 * Hook to manage two-way synchronization between the main window and
 * detached sidebar windows (left: Components, right: Configuration).
 */
export const useSidebarSync = () => {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const isBrowser = typeof globalThis !== 'undefined';
    if (!isBrowser) return;

    const channel = new BroadcastChannel(SIDEBAR_CHANNEL_NAME);
    channelRef.current = channel;
    const gw = getBackendGateway();

    const searchParams = new URLSearchParams(globalThis.location?.search || '');
    const mode = searchParams.get('mode');
    const isDetachedSidebar = mode === 'sidebar-left' || mode === 'sidebar-right';

    if (isDetachedSidebar) {
      // In detached window, request current state snapshot from main window
      channel.postMessage({ type: 'SYNC_STATE', side: mode === 'sidebar-left' ? 'left' : 'right' });
    }

    const handleMessage = (event: MessageEvent<SidebarSyncMessage>) => {
      const msg = event.data;
      if (!msg?.type) return;

      const store = useFlowStore.getState();
      if (isDetachedSidebar) {
        // --- Detached Window Handlers ---
        handleDetachedMessage(msg, store);
      } else {
        // --- Main Window Handlers ---
        handleMainWindowMessage(msg, channel, store, gw);
      }
    };

    channel.onmessage = handleMessage;

    // Broadcast selecting changes (Settings etc.) to detached windows when needed.
    const unsubStore = isDetachedSidebar ? () => {} : useFlowStore.subscribe(createSettingsSyncSubscriber(channel, gw));

    // In detached windows, apply selecting changes reported by the main window.
    const unsubSettings = gw.onEvent('sidebar-settings-selected', (nodeId: string | null, edgeId: string | null) => {
      if (isDetachedSidebar) {
        applyDetachedSettings(nodeId ?? null, edgeId ?? null);
      }
    });

    // Listen to native window close event from backend
    const unsubClose = gw.onEvent('sidebar-detached-closed', (side: any) => {
      if (side === 'left') {
        useFlowStore.getState().setSidebarDetached(false);
      } else if (side === 'right') {
        useFlowStore.getState().setRightSidebarDetached(false);
      }
    });

    const unsubOpen = gw.onEvent('sidebar-detached-open', (side: any) => {
      if (side === 'left') {
        useFlowStore.getState().setSidebarDetached(true);
      } else if (side === 'right') {
        useFlowStore.getState().setRightSidebarDetached(true);
      }
    });

    // Wails event transport (fallback when BroadcastChannel doesn't cross windows)
    const unsubModalReq = gw.onEvent('sidebar-modal-request', (modalId: string) => {
      if (!isDetachedSidebar && modalId) {
        openModalRequest(modalId);
      }
    });

    // Wails event transport for attach: detached windows reattach through the main window.
    const unsubAttachReq = gw.onEvent('sidebar-attach-request', (side: string | null) => {
      if (!isDetachedSidebar && side) {
        attachSidebarToMainWindow(side as 'left' | 'right', useFlowStore.getState(), gw);
      }
    });

    return () => {
      channel.close();
      unsubClose();
      unsubOpen();
      unsubModalReq();
      unsubAttachReq();
      unsubStore();
      unsubSettings();
    };
  }, []);

  const broadcastAddNode = (nodeType: K8sResourceType) => {
    channelRef.current?.postMessage({ type: 'ADD_NODE', nodeType });
  };

  const broadcastModalRequest = (modalId: string, nodeId?: string | null) => {
    channelRef.current?.postMessage({ type: 'MODAL_REQUEST', modalId, nodeId: nodeId ?? undefined });
  };

  const broadcastAttachSidebar = (side: 'left' | 'right') => {
    channelRef.current?.postMessage({ type: 'ATTACH_SIDEBAR', side });
  };

  const broadcastUpdateNodeData = (nodeId: string, data: any) => {
    channelRef.current?.postMessage({ type: 'UPDATE_NODE_DATA', nodeId, data });
  };

  return {
    broadcastAddNode,
    broadcastAttachSidebar,
    broadcastModalRequest,
    broadcastUpdateNodeData,
  };
};
