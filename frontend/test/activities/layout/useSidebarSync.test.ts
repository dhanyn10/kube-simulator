import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useSidebarSync,
  isDetachedRightWindow,
  SIDEBAR_CHANNEL_NAME,
  SidebarSyncMessage,
} from '@/activities/layout/useSidebarSync';
import { useFlowStore } from '@/store';
import { getBackendGateway, setBackendGateway, resetBackendGateway, MockBackendGateway } from '@/gateway';

describe('useSidebarSync', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    setBackendGateway(new MockBackendGateway());
    originalLocation = globalThis.location;

    useFlowStore.setState({
      colorMode: 'dark',
      configuringNodeId: null,
      configuringEdgeId: null,
      nodes: [],
      edges: [],
      isSidebarVisible: true,
      isRightSidebarVisible: true,
      isSidebarDetached: false,
      isRightSidebarDetached: false,
      isInternetProfileModalOpen: false,
      internetProfileTargetId: null,
      isKubeIamModalOpen: false,
      isWorkerBudgetModalOpen: false,
      configMapModalTargetNode: null,
      secretModalTargetNode: null,
      activeOverviewModal: null,
    });
  });

  afterEach(() => {
    resetBackendGateway();
    globalThis.location = originalLocation;
  });

  const setLocationSearch = (search: string) => {
    // @ts-ignore
    delete globalThis.location;
    globalThis.location = { ...originalLocation, search } as Location;
  };

  describe('isDetachedRightWindow', () => {
    it('returns true when mode query param is sidebar-right', () => {
      setLocationSearch('?mode=sidebar-right');
      expect(isDetachedRightWindow()).toBe(true);
    });

    it('returns false when mode query param is sidebar-left, other, or missing', () => {
      setLocationSearch('?mode=sidebar-left');
      expect(isDetachedRightWindow()).toBe(false);

      setLocationSearch('?mode=monitoring');
      expect(isDetachedRightWindow()).toBe(false);

      setLocationSearch('');
      expect(isDetachedRightWindow()).toBe(false);
    });
  });

  describe('Main Window mode (mode is not detached sidebar)', () => {
    it('initializes and provides broadcast helpers that send messages to BroadcastChannel', async () => {
      setLocationSearch('');
      const channel = new BroadcastChannel(SIDEBAR_CHANNEL_NAME);
      const received: SidebarSyncMessage[] = [];
      channel.onmessage = (e) => received.push(e.data);

      const { result, unmount } = renderHook(() => useSidebarSync());

      await act(async () => {
        result.current.broadcastAddNode('Pod');
        result.current.broadcastAttachSidebar('left');
        result.current.broadcastModalRequest('KUBE_IAM', 'node-1');
        result.current.broadcastModalRequest('WORKER_BUDGET');
        result.current.broadcastUpdateNodeData('node-1', { label: 'updated-node' });
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(received).toEqual(
        expect.arrayContaining([
          { type: 'ADD_NODE', nodeType: 'Pod' },
          { type: 'ATTACH_SIDEBAR', side: 'left' },
          { type: 'MODAL_REQUEST', modalId: 'KUBE_IAM', nodeId: 'node-1' },
          { type: 'MODAL_REQUEST', modalId: 'WORKER_BUDGET', nodeId: undefined },
          { type: 'UPDATE_NODE_DATA', nodeId: 'node-1', data: { label: 'updated-node' } },
        ])
      );

      channel.close();
      unmount();
    });

    it('responds to SYNC_STATE message by posting sanitized STATE_UPDATE to BroadcastChannel', async () => {
      setLocationSearch('');
      useFlowStore.setState({
        colorMode: 'light',
        configuringNodeId: 'node-10',
        configuringEdgeId: 'edge-20',
        nodes: [
          {
            id: 'node-10',
            type: 'Pod',
            data: { label: 'test-pod', fnProp: () => {} },
            position: { x: 0, y: 0 },
          } as any,
        ],
        edges: [
          {
            id: 'edge-20',
            source: 'node-10',
            target: 'node-20',
            onClick: () => {},
          } as any,
        ],
      });

      const channel = new BroadcastChannel(SIDEBAR_CHANNEL_NAME);
      let capturedStateUpdate: any = null;
      channel.onmessage = (e) => {
        if (e.data.type === 'STATE_UPDATE') {
          capturedStateUpdate = e.data.state;
        }
      };

      const { unmount } = renderHook(() => useSidebarSync());

      await act(async () => {
        channel.postMessage({ type: 'SYNC_STATE', side: 'right' });
        await new Promise((r) => setTimeout(r, 30));
      });

      expect(capturedStateUpdate).toBeDefined();
      expect(capturedStateUpdate.colorMode).toBe('light');
      expect(capturedStateUpdate.configuringNodeId).toBe('node-10');
      expect(capturedStateUpdate.configuringEdgeId).toBe('edge-20');
      // Function properties should have been stripped by sanitizeForBroadcast
      expect(capturedStateUpdate.nodes[0].data.fnProp).toBeUndefined();
      expect(capturedStateUpdate.nodes[0].data.label).toBe('test-pod');
      expect(capturedStateUpdate.edges[0].onClick).toBeUndefined();

      channel.close();
      unmount();
    });

    it('handles ADD_NODE and UPDATE_NODE_DATA messages from BroadcastChannel', async () => {
      setLocationSearch('');
      const addNodeSpy = vi.spyOn(useFlowStore.getState(), 'addNode');
      const updateNodeDataSpy = vi.spyOn(useFlowStore.getState(), 'updateNodeData');

      const { unmount } = renderHook(() => useSidebarSync());
      const channel = new BroadcastChannel(SIDEBAR_CHANNEL_NAME);

      await act(async () => {
        // Valid ADD_NODE
        channel.postMessage({ type: 'ADD_NODE', nodeType: 'Deployment' });
        // Invalid ADD_NODE without nodeType
        channel.postMessage({ type: 'ADD_NODE' });

        // Valid UPDATE_NODE_DATA
        channel.postMessage({ type: 'UPDATE_NODE_DATA', nodeId: 'dep-1', data: { replicas: 3 } });
        // Invalid UPDATE_NODE_DATA without data
        channel.postMessage({ type: 'UPDATE_NODE_DATA', nodeId: 'dep-1' });

        await new Promise((r) => setTimeout(r, 30));
      });

      expect(addNodeSpy).toHaveBeenCalledTimes(1);
      expect(addNodeSpy).toHaveBeenCalledWith('Deployment');

      expect(updateNodeDataSpy).toHaveBeenCalledTimes(1);
      expect(updateNodeDataSpy).toHaveBeenCalledWith('dep-1', { replicas: 3 });

      channel.close();
      unmount();
    });

    it('handles ATTACH_SIDEBAR messages for left, right, and invalid sides', async () => {
      setLocationSearch('');
      const gw = getBackendGateway();
      const closeSidebarSpy = vi.spyOn(gw, 'closeSidebarWindow').mockResolvedValue(true);

      useFlowStore.setState({
        isSidebarDetached: true,
        isSidebarVisible: false,
        isRightSidebarDetached: true,
        isRightSidebarVisible: false,
      });

      const { unmount } = renderHook(() => useSidebarSync());
      const channel = new BroadcastChannel(SIDEBAR_CHANNEL_NAME);

      // Attach left
      await act(async () => {
        channel.postMessage({ type: 'ATTACH_SIDEBAR', side: 'left' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(useFlowStore.getState().isSidebarDetached).toBe(false);
      expect(useFlowStore.getState().isSidebarVisible).toBe(true);
      expect(closeSidebarSpy).toHaveBeenCalledWith('left');

      // Attach right
      await act(async () => {
        channel.postMessage({ type: 'ATTACH_SIDEBAR', side: 'right' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(useFlowStore.getState().isRightSidebarDetached).toBe(false);
      expect(useFlowStore.getState().isRightSidebarVisible).toBe(true);
      expect(closeSidebarSpy).toHaveBeenCalledWith('right');

      // Invalid side without side property
      closeSidebarSpy.mockClear();
      await act(async () => {
        channel.postMessage({ type: 'ATTACH_SIDEBAR' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(closeSidebarSpy).not.toHaveBeenCalled();

      channel.close();
      unmount();
    });

    it('handles closeSidebarWindow promise rejection safely in attachSidebarToMainWindow', async () => {
      setLocationSearch('');
      const gw = getBackendGateway();
      vi.spyOn(gw, 'closeSidebarWindow').mockRejectedValue(new Error('Window already closed'));

      const { unmount } = renderHook(() => useSidebarSync());
      const channel = new BroadcastChannel(SIDEBAR_CHANNEL_NAME);

      await act(async () => {
        channel.postMessage({ type: 'ATTACH_SIDEBAR', side: 'left' });
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(useFlowStore.getState().isSidebarDetached).toBe(false);

      channel.close();
      unmount();
    });

    it('handles MODAL_REQUEST messages for all supported modal types', async () => {
      setLocationSearch('');
      const { unmount } = renderHook(() => useSidebarSync());
      const channel = new BroadcastChannel(SIDEBAR_CHANNEL_NAME);

      // 1. INTERNET_PROFILE_MODAL with nodeId
      await act(async () => {
        channel.postMessage({ type: 'MODAL_REQUEST', modalId: 'INTERNET_PROFILE_MODAL', nodeId: 'net-1' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(useFlowStore.getState().isInternetProfileModalOpen).toBe(true);
      expect(useFlowStore.getState().internetProfileTargetId).toBe('net-1');

      // 2. INTERNET_PROFILE_MODAL without nodeId
      useFlowStore.setState({ isInternetProfileModalOpen: false, internetProfileTargetId: 'net-1' });
      await act(async () => {
        channel.postMessage({ type: 'MODAL_REQUEST', modalId: 'INTERNET_PROFILE_MODAL' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(useFlowStore.getState().isInternetProfileModalOpen).toBe(true);
      expect(useFlowStore.getState().internetProfileTargetId).toBe('net-1');

      // 3. KUBE_IAM
      await act(async () => {
        channel.postMessage({ type: 'MODAL_REQUEST', modalId: 'KUBE_IAM' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(useFlowStore.getState().isKubeIamModalOpen).toBe(true);

      // 4. WORKER_BUDGET
      await act(async () => {
        channel.postMessage({ type: 'MODAL_REQUEST', modalId: 'WORKER_BUDGET' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(useFlowStore.getState().isWorkerBudgetModalOpen).toBe(true);

      // 5. CONFIG_MAP_LIST
      await act(async () => {
        channel.postMessage({ type: 'MODAL_REQUEST', modalId: 'CONFIG_MAP_LIST' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(useFlowStore.getState().configMapModalTargetNode).toEqual({
        id: 'cluster-storage',
        label: 'Cluster ConfigMaps',
        initialViewMode: 'list',
      });

      // 6. SECRET_LIST
      await act(async () => {
        channel.postMessage({ type: 'MODAL_REQUEST', modalId: 'SECRET_LIST' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(useFlowStore.getState().secretModalTargetNode).toEqual({
        id: 'cluster-storage',
        label: 'Cluster Secrets',
        initialViewMode: 'list',
      });

      // 7. OVERVIEW_HPA
      await act(async () => {
        channel.postMessage({ type: 'MODAL_REQUEST', modalId: 'OVERVIEW_HPA' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(useFlowStore.getState().activeOverviewModal).toBe('HPA');

      // 8. OVERVIEW_RESOURCE_LIMIT
      await act(async () => {
        channel.postMessage({ type: 'MODAL_REQUEST', modalId: 'OVERVIEW_RESOURCE_LIMIT' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(useFlowStore.getState().activeOverviewModal).toBe('ResourceLimit');

      // 9. Unknown modal or empty modalId (no crash, no-op)
      await act(async () => {
        channel.postMessage({ type: 'MODAL_REQUEST', modalId: 'UNKNOWN_MODAL' });
        channel.postMessage({ type: 'MODAL_REQUEST' });
        await new Promise((r) => setTimeout(r, 20));
      });

      channel.close();
      unmount();
    });

    it('ignores unknown message types or messages without type', async () => {
      setLocationSearch('');
      const { unmount } = renderHook(() => useSidebarSync());
      const channel = new BroadcastChannel(SIDEBAR_CHANNEL_NAME);

      await act(async () => {
        channel.postMessage({} as any);
        channel.postMessage({ type: 'UNKNOWN_TYPE' } as any);
        await new Promise((r) => setTimeout(r, 20));
      });

      channel.close();
      unmount();
    });

    it('broadcasts settings selection to detached right window when right sidebar is detached', async () => {
      setLocationSearch('');
      useFlowStore.setState({
        isRightSidebarDetached: true,
        configuringNodeId: null,
        configuringEdgeId: null,
      });

      const gw = getBackendGateway();
      const emitSpy = vi.spyOn(gw, 'emitEvent');

      const channel = new BroadcastChannel(SIDEBAR_CHANNEL_NAME);
      let capturedStateUpdate: any = null;
      channel.onmessage = (e) => {
        if (e.data.type === 'STATE_UPDATE') {
          capturedStateUpdate = e.data.state;
        }
      };

      const { unmount } = renderHook(() => useSidebarSync());

      // 1. Changing configuringNodeId when isRightSidebarDetached is true
      await act(async () => {
        useFlowStore.setState({ configuringNodeId: 'node-abc' });
        await new Promise((r) => setTimeout(r, 30));
      });

      expect(emitSpy).toHaveBeenCalledWith('sidebar-settings-selected', 'node-abc', null);
      expect(capturedStateUpdate).toBeDefined();
      expect(capturedStateUpdate.configuringNodeId).toBe('node-abc');

      // 2. Unchanged selection state does not broadcast again
      emitSpy.mockClear();
      capturedStateUpdate = null;
      await act(async () => {
        useFlowStore.setState({ colorMode: 'light' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(emitSpy).not.toHaveBeenCalled();
      expect(capturedStateUpdate).toBeNull();

      // 3. Selection changes when isRightSidebarDetached is false should not broadcast
      useFlowStore.setState({ isRightSidebarDetached: false });
      emitSpy.mockClear();
      capturedStateUpdate = null;
      await act(async () => {
        useFlowStore.setState({ configuringEdgeId: 'edge-xyz' });
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(emitSpy).not.toHaveBeenCalled();
      expect(capturedStateUpdate).toBeNull();

      channel.close();
      unmount();
    });

    it('listens to backend gateway events (sidebar-detached-closed, open, modal-request, attach-request)', async () => {
      setLocationSearch('');
      useFlowStore.setState({
        isSidebarDetached: true,
        isRightSidebarDetached: true,
      });

      const gw = getBackendGateway();
      const { unmount } = renderHook(() => useSidebarSync());

      await act(async () => {
        // sidebar-detached-closed
        gw.emitEvent('sidebar-detached-closed', 'left');
        gw.emitEvent('sidebar-detached-closed', 'right');
        gw.emitEvent('sidebar-detached-closed', 'unknown-side');
      });
      expect(useFlowStore.getState().isSidebarDetached).toBe(false);
      expect(useFlowStore.getState().isRightSidebarDetached).toBe(false);

      await act(async () => {
        // sidebar-detached-open
        gw.emitEvent('sidebar-detached-open', 'left');
        gw.emitEvent('sidebar-detached-open', 'right');
        gw.emitEvent('sidebar-detached-open', 'unknown-side');
      });
      expect(useFlowStore.getState().isSidebarDetached).toBe(true);
      expect(useFlowStore.getState().isRightSidebarDetached).toBe(true);

      await act(async () => {
        // sidebar-modal-request
        gw.emitEvent('sidebar-modal-request', 'KUBE_IAM');
        gw.emitEvent('sidebar-modal-request', '');
      });
      expect(useFlowStore.getState().isKubeIamModalOpen).toBe(true);

      await act(async () => {
        // sidebar-attach-request
        gw.emitEvent('sidebar-attach-request', 'left');
        gw.emitEvent('sidebar-attach-request', null);
      });
      expect(useFlowStore.getState().isSidebarDetached).toBe(false);

      unmount();
    });
  });

  describe('Detached Window mode (mode is sidebar-left or sidebar-right)', () => {
    it('requests SYNC_STATE from main window on mount for sidebar-left', async () => {
      setLocationSearch('?mode=sidebar-left');
      const channel = new BroadcastChannel(SIDEBAR_CHANNEL_NAME);
      const messages: any[] = [];
      channel.onmessage = (e) => messages.push(e.data);

      const { unmount } = renderHook(() => useSidebarSync());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(messages).toContainEqual({ type: 'SYNC_STATE', side: 'left' });

      channel.close();
      unmount();
    });

    it('requests SYNC_STATE from main window on mount for sidebar-right', async () => {
      setLocationSearch('?mode=sidebar-right');
      const channel = new BroadcastChannel(SIDEBAR_CHANNEL_NAME);
      const messages: any[] = [];
      channel.onmessage = (e) => messages.push(e.data);

      const { unmount } = renderHook(() => useSidebarSync());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(messages).toContainEqual({ type: 'SYNC_STATE', side: 'right' });

      channel.close();
      unmount();
    });

    it('updates detached store when STATE_UPDATE message arrives', async () => {
      setLocationSearch('?mode=sidebar-right');
      useFlowStore.setState({
        colorMode: 'dark',
        configuringNodeId: null,
        configuringEdgeId: null,
      });

      const { unmount } = renderHook(() => useSidebarSync());
      const channel = new BroadcastChannel(SIDEBAR_CHANNEL_NAME);

      // 1. Full STATE_UPDATE
      await act(async () => {
        channel.postMessage({
          type: 'STATE_UPDATE',
          state: {
            colorMode: 'light',
            configuringNodeId: 'node-1',
            configuringEdgeId: 'edge-1',
            nodes: [{ id: 'node-1' } as any],
            edges: [{ id: 'edge-1' } as any],
          },
        });
        await new Promise((r) => setTimeout(r, 30));
      });

      expect(useFlowStore.getState().colorMode).toBe('light');
      expect(useFlowStore.getState().configuringNodeId).toBe('node-1');
      expect(useFlowStore.getState().configuringEdgeId).toBe('edge-1');
      expect(useFlowStore.getState().nodes).toHaveLength(1);
      expect(useFlowStore.getState().edges).toHaveLength(1);

      // 2. STATE_UPDATE with empty state or same colorMode
      await act(async () => {
        channel.postMessage({
          type: 'STATE_UPDATE',
          state: {
            colorMode: 'light', // same as current
          },
        });
        channel.postMessage({
          type: 'STATE_UPDATE',
        });
        await new Promise((r) => setTimeout(r, 20));
      });

      // 3. Non-STATE_UPDATE message is ignored in detached mode
      await act(async () => {
        channel.postMessage({
          type: 'SYNC_STATE',
        });
        await new Promise((r) => setTimeout(r, 20));
      });

      channel.close();
      unmount();
    });

    it('applies selecting changes reported by backend gateway sidebar-settings-selected event', async () => {
      setLocationSearch('?mode=sidebar-right');
      const { unmount } = renderHook(() => useSidebarSync());
      const gw = getBackendGateway();

      await act(async () => {
        gw.emitEvent('sidebar-settings-selected', 'selected-node-1', 'selected-edge-1');
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(useFlowStore.getState().configuringNodeId).toBe('selected-node-1');
      expect(useFlowStore.getState().configuringEdgeId).toBe('selected-edge-1');

      // With null values
      await act(async () => {
        gw.emitEvent('sidebar-settings-selected', null, null);
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(useFlowStore.getState().configuringNodeId).toBeNull();
      expect(useFlowStore.getState().configuringEdgeId).toBeNull();

      unmount();
    });

    it('ignores sidebar-modal-request and sidebar-attach-request when in detached mode', async () => {
      setLocationSearch('?mode=sidebar-left');
      const { unmount } = renderHook(() => useSidebarSync());
      const gw = getBackendGateway();

      await act(async () => {
        gw.emitEvent('sidebar-modal-request', 'KUBE_IAM');
        gw.emitEvent('sidebar-attach-request', 'left');
      });

      expect(useFlowStore.getState().isKubeIamModalOpen).toBe(false);

      unmount();
    });
  });
});
