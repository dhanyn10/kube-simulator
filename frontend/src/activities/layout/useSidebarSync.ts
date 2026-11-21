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

      if (!isDetachedSidebar) {
        // --- Main Window Handlers ---
        if (msg.type === 'SYNC_STATE') {
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
        } else if (msg.type === 'ADD_NODE' && msg.nodeType) {
          store.addNode(msg.nodeType);
        } else if (msg.type === 'UPDATE_NODE_DATA' && msg.nodeId && msg.data) {
          store.updateNodeData(msg.nodeId, msg.data);
        } else if (msg.type === 'ATTACH_SIDEBAR' && msg.side) {
          if (msg.side === 'left') {
            store.setSidebarDetached(false);
            store.setSidebarVisible(true);
          } else {
            store.setRightSidebarDetached(false);
            store.setRightSidebarVisible(true);
          }
          gw.closeSidebarWindow(msg.side);
        }
      } else {
        // --- Detached Window Handlers ---
        if (msg.type === 'STATE_UPDATE' && msg.state) {
          const { colorMode, configuringNodeId, configuringEdgeId, nodes, edges } = msg.state;
          const updates: any = {};
          if (colorMode && colorMode !== store.colorMode) updates.colorMode = colorMode;
          if (configuringNodeId !== undefined) updates.configuringNodeId = configuringNodeId;
          if (configuringEdgeId !== undefined) updates.configuringEdgeId = configuringEdgeId;
          if (nodes !== undefined) updates.nodes = nodes;
          if (edges !== undefined) updates.edges = edges;
          if (Object.keys(updates).length > 0) {
            useFlowStore.setState(updates);
          }
        }
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
