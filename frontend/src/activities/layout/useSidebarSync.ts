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
    | 'SELECT_NODE';
  side?: 'left' | 'right';
  nodeType?: K8sResourceType;
  nodeId?: string;
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

const sendStateToWindow = (channel: BroadcastChannel, store: StoreState) => {
  channel.postMessage({
    type: 'STATE_UPDATE',
    state: {
      colorMode: store.colorMode,
      configuringNodeId: store.configuringNodeId,
      configuringEdgeId: store.configuringEdgeId,
      nodes: store.nodes,
      edges: store.edges,
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
  void gw.closeSidebarWindow(side);
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
      if (!msg || !msg.type) return;

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

    return () => {
      channel.close();
      unsubClose();
      unsubOpen();
    };
  }, []);

  const broadcastAddNode = (nodeType: K8sResourceType) => {
    channelRef.current?.postMessage({ type: 'ADD_NODE', nodeType });
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
    broadcastUpdateNodeData,
  };
};
