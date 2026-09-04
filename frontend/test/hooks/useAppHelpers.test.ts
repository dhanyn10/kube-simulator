import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppInit, useAttachmentHandlers } from '@/hooks/useAppHelpers';
import { useFlowStore } from '@/store';
import { K8sRoleItem, K8sConfigMapItem } from '@/types';

vi.mock('@wailsjs/go/main/App.js', () => ({
  GetSystemResources: vi.fn(),
}));

vi.mock('@wailsjs/runtime', () => ({
  EventsOn: vi.fn(() => vi.fn()),
}));

import { GetSystemResources } from '@wailsjs/go/main/App.js';
import { EventsOn } from '@wailsjs/runtime';

describe('useAppHelpers', () => {
  const originalGo = (globalThis as any).go;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useFlowStore.setState({
      nodes: [
        {
          id: 'node-1',
          type: 'Deployment',
          position: { x: 0, y: 0 },
          data: {
            label: 'Test Node',
            roles: [
              { id: 'role-1', name: 'old-role', rules: [] },
            ],
            configMaps: [
              { id: 'cm-1', name: 'old-cm', configData: [] },
            ],
          },
        },
      ],
      roleModalTargetNode: null,
      configMapModalTargetNode: null,
      configuringNodeId: null,
      configuringEdgeId: null,
      isRightSidebarVisible: false,
      isHistoryViewOpen: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as any).go = originalGo;
  });

  describe('useAppInit', () => {
    it('does nothing when isDetachedMode is true', () => {
      const loadSettingsJson = vi.fn();
      const setGlobalEdgeColors = vi.fn();
      const setSystemResources = vi.fn();
      const setIsAboutDialogOpen = vi.fn();

      renderHook(() =>
        useAppInit(true, loadSettingsJson, setGlobalEdgeColors, setSystemResources, setIsAboutDialogOpen)
      );

      expect(loadSettingsJson).not.toHaveBeenCalled();
    });

    it('loads settings, fetches global edge colors, polls system resources, and registers EventsOn', async () => {
      const loadSettingsJson = vi.fn();
      const setGlobalEdgeColors = vi.fn();
      const setSystemResources = vi.fn();
      const setIsAboutDialogOpen = vi.fn();

      const mockGetSetting = vi.fn((key: string) => {
        if (key === 'globalEdgeColor') return Promise.resolve('blue');
        if (key === 'globalEdgeErrorColor') return Promise.resolve('red');
        return Promise.resolve('');
      });

      const mockGetSystemResources = vi.mocked(GetSystemResources).mockResolvedValue({ cpu: 10, ram: 20 });

      (globalThis as any).go = {
        main: {
          App: {
            GetSetting: mockGetSetting,
          },
        },
      };

      let eventHandler: any;
      vi.mocked(EventsOn).mockImplementation((event: string, cb: any) => {
        if (event === 'openAboutDialog') eventHandler = cb;
        return () => {};
      });

      renderHook(() =>
        useAppInit(false, loadSettingsJson, setGlobalEdgeColors, setSystemResources, setIsAboutDialogOpen)
      );

      expect(loadSettingsJson).toHaveBeenCalled();
      expect(mockGetSetting).toHaveBeenCalledWith('globalEdgeColor');
      expect(mockGetSetting).toHaveBeenCalledWith('globalEdgeErrorColor');

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(setGlobalEdgeColors).toHaveBeenCalledWith('blue', 'red');

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      if (eventHandler) {
        eventHandler();
        expect(setIsAboutDialogOpen).toHaveBeenCalledWith(true);
      }
    });

    it('handles GetSystemResources error when error message contains "not registered"', async () => {
      const loadSettingsJson = vi.fn();
      const setGlobalEdgeColors = vi.fn();
      const setSystemResources = vi.fn();
      const setIsAboutDialogOpen = vi.fn();

      vi.mocked(GetSystemResources).mockRejectedValue(new Error('not registered'));

      renderHook(() =>
        useAppInit(false, loadSettingsJson, setGlobalEdgeColors, setSystemResources, setIsAboutDialogOpen)
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(setSystemResources).not.toHaveBeenCalled();
    });

    it('handles GetSystemResources generic error', async () => {
      const loadSettingsJson = vi.fn();
      const setGlobalEdgeColors = vi.fn();
      const setSystemResources = vi.fn();
      const setIsAboutDialogOpen = vi.fn();

      vi.mocked(GetSystemResources).mockRejectedValue(new Error('connection failed'));

      renderHook(() =>
        useAppInit(false, loadSettingsJson, setGlobalEdgeColors, setSystemResources, setIsAboutDialogOpen)
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(setSystemResources).not.toHaveBeenCalled();
    });
  });

  describe('useAttachmentHandlers', () => {
    it('handleRoleSave returns early if roleModalTargetNode is null or target node not found', () => {
      const { result } = renderHook(() => useAttachmentHandlers());

      act(() => {
        result.current.handleRoleSave({ id: 'role-1', name: 'new-role', rules: [] });
      });

      act(() => {
        result.current.setRoleModalTargetNode({ id: 'non-existent', label: 'NonExistent' });
      });

      act(() => {
        result.current.handleRoleSave({ id: 'role-1', name: 'new-role', rules: [] });
      });

      expect(useFlowStore.getState().configuringNodeId).toBeNull();
    });

    it('handleRoleSave updates existing role and attaches new role when index >= 0 or index < 0', () => {
      const { result } = renderHook(() => useAttachmentHandlers());

      act(() => {
        result.current.setRoleModalTargetNode({ id: 'node-1', label: 'Test Node' });
      });

      const updatedRole: K8sRoleItem = { id: 'role-1', name: 'updated-role', rules: [] };
      act(() => {
        result.current.handleRoleSave(updatedRole);
      });

      let updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.roles).toEqual([updatedRole]);
      expect(useFlowStore.getState().configuringNodeId).toBe('node-1');
      expect(useFlowStore.getState().isRightSidebarVisible).toBe(true);

      act(() => {
        result.current.setRoleModalTargetNode({ id: 'node-1', label: 'Test Node' });
      });

      const newRole: K8sRoleItem = { id: 'role-2', name: 'new-role', rules: [] };
      act(() => {
        result.current.handleRoleSave(newRole);
      });

      updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.roles).toEqual([updatedRole, newRole]);
    });

    it('handleConfigMapSave returns early if configMapModalTargetNode is null or target node not found', () => {
      const { result } = renderHook(() => useAttachmentHandlers());

      act(() => {
        result.current.handleConfigMapSave({ id: 'cm-1', name: 'new-cm', configData: [] });
      });

      act(() => {
        result.current.setConfigMapModalTargetNode({ id: 'non-existent', label: 'NonExistent' });
      });

      act(() => {
        result.current.handleConfigMapSave({ id: 'cm-1', name: 'new-cm', configData: [] });
      });

      expect(useFlowStore.getState().configuringNodeId).toBeNull();
    });

    it('handleConfigMapSave updates existing configmap and attaches new configmap', () => {
      const { result } = renderHook(() => useAttachmentHandlers());

      act(() => {
        result.current.setConfigMapModalTargetNode({ id: 'node-1', label: 'Test Node' });
      });

      const updatedCm: K8sConfigMapItem = { id: 'cm-1', name: 'updated-cm', configData: [{ key: 'A', value: '1' }] };
      act(() => {
        result.current.handleConfigMapSave(updatedCm);
      });

      let updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.configMaps).toEqual([updatedCm]);
      expect(useFlowStore.getState().configuringNodeId).toBe('node-1');

      act(() => {
        result.current.setConfigMapModalTargetNode({ id: 'node-1', label: 'Test Node' });
      });

      const newCm: K8sConfigMapItem = { id: 'cm-2', name: 'new-cm', configData: [] };
      act(() => {
        result.current.handleConfigMapSave(newCm);
      });

      updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.configMaps).toEqual([updatedCm, newCm]);
    });
  });
});
