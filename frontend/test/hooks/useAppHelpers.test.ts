import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useAppInit,
  useAttachmentHandlers,
  isNodeAttachedToConfigMap,
  createEnrichedConfigMapItem,
  attachConfigMapToNode,
  detachConfigMapFromNode,
} from '@/hooks/useAppHelpers';
import { useFlowStore } from '@/store';
import { K8sRoleItem, K8sConfigMapItem, K8sResourceLimitItem } from '@/types';

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
            roles: [{ id: 'role-1', name: 'old-role', rules: [] }],
            configMaps: [{ id: 'cm-1', name: 'old-cm', configData: [] }],
            resourceLimits: [{ id: 'res-1', name: 'old-limit', cpuRequest: '100m', cpuLimit: '200m' }],
          },
        },
      ],
      roleModalTargetNode: null,
      configMapModalTargetNode: null,
      secretModalTargetNode: null,
      hpaModalTargetNode: null,
      resourceLimitModalTargetNode: null,
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

      // Mock window.go.main.App.GetSystemResources for browser check
      (globalThis as any).window = {
        go: {
          main: {
            App: {
              GetSystemResources: mockGetSystemResources,
            },
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

      expect(setSystemResources).toHaveBeenCalledWith({ cpu: 10, ram: 20 });

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

      (globalThis as any).window = {
        go: {
          main: {
            App: {
              GetSystemResources,
            },
          },
        },
      };

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

      (globalThis as any).window = {
        go: {
          main: {
            App: {
              GetSystemResources,
            },
          },
        },
      };

      renderHook(() =>
        useAppInit(false, loadSettingsJson, setGlobalEdgeColors, setSystemResources, setIsAboutDialogOpen)
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(setSystemResources).not.toHaveBeenCalled();
    });

    it('covers edge color fallback branches when both or one color is empty', async () => {
      const loadSettingsJson = vi.fn();
      const setGlobalEdgeColors = vi.fn();
      const setSystemResources = vi.fn();
      const setIsAboutDialogOpen = vi.fn();

      // Case 1: Both colors are empty string -> if (color !== '' || errorColor !== '') is false
      let mockGetSetting = vi.fn().mockResolvedValue('');
      (globalThis as any).go = { main: { App: { GetSetting: mockGetSetting } } };
      (globalThis as any).window = {};

      const { rerender } = renderHook(() =>
        useAppInit(false, loadSettingsJson, setGlobalEdgeColors, setSystemResources, setIsAboutDialogOpen)
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(setGlobalEdgeColors).not.toHaveBeenCalled();

      // Case 2: color is empty, errorColor is provided -> color fallback 'var(--color-mat-indigo)'
      mockGetSetting = vi.fn((key: string) => {
        if (key === 'globalEdgeErrorColor') return Promise.resolve('custom-red');
        return Promise.resolve('');
      });
      (globalThis as any).go = { main: { App: { GetSetting: mockGetSetting } } };

      renderHook(() =>
        useAppInit(false, loadSettingsJson, setGlobalEdgeColors, setSystemResources, setIsAboutDialogOpen)
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(setGlobalEdgeColors).toHaveBeenCalledWith('var(--color-mat-indigo)', 'custom-red');

      // Case 3: color is provided, errorColor is empty -> errorColor fallback 'var(--color-mat-red)'
      setGlobalEdgeColors.mockClear();
      mockGetSetting = vi.fn((key: string) => {
        if (key === 'globalEdgeColor') return Promise.resolve('custom-blue');
        return Promise.resolve('');
      });
      (globalThis as any).go = { main: { App: { GetSetting: mockGetSetting } } };

      renderHook(() =>
        useAppInit(false, loadSettingsJson, setGlobalEdgeColors, setSystemResources, setIsAboutDialogOpen)
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(setGlobalEdgeColors).toHaveBeenCalledWith('custom-blue', 'var(--color-mat-red)');
    });

    it('handles GetSystemResources undefined or resolving to null', async () => {
      const loadSettingsJson = vi.fn();
      const setGlobalEdgeColors = vi.fn();
      const setSystemResources = vi.fn();
      const setIsAboutDialogOpen = vi.fn();

      // 1. GetSystemResources resolves to null
      vi.mocked(GetSystemResources).mockResolvedValue(null as any);
      (globalThis as any).window = {
        go: { main: { App: { GetSystemResources } } },
      };

      renderHook(() =>
        useAppInit(false, loadSettingsJson, setGlobalEdgeColors, setSystemResources, setIsAboutDialogOpen)
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(setSystemResources).not.toHaveBeenCalled();

      // 2. window.go.main.App.GetSystemResources is undefined
      delete (globalThis as any).window.go.main.App.GetSystemResources;
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
      expect(useFlowStore.getState().savedConfigMaps).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'cm-1', name: 'new-cm' })])
      );
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
      expect(updatedNodes[0].data.configMaps).toEqual([
        expect.objectContaining({ id: 'cm-1', name: 'updated-cm' }),
      ]);
      expect(useFlowStore.getState().configuringNodeId).toBe('node-1');

      act(() => {
        result.current.setConfigMapModalTargetNode({ id: 'node-1', label: 'Test Node' });
      });

      const newCm: K8sConfigMapItem = { id: 'cm-2', name: 'new-cm', configData: [] };
      act(() => {
        result.current.handleConfigMapSave(newCm);
      });

      updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.configMaps).toEqual([
        expect.objectContaining({ id: 'cm-1', name: 'updated-cm' }),
        expect.objectContaining({ id: 'cm-2', name: 'new-cm' }),
      ]);
    });

    it('covers all condition branches in handleConfigMapSave: cluster-storage, list mode with/without resourceName, fallback label, and fallback type', () => {
      const { result } = renderHook(() => useAttachmentHandlers());

      // 1. Target node has no data.label and no type (falls back to target.id and 'Resource')
      useFlowStore.setState({
        nodes: [
          {
            id: 'node-bare',
            position: { x: 0, y: 0 },
            data: {}, // no label
          } as any,
        ],
      });

      act(() => {
        result.current.setConfigMapModalTargetNode({ id: 'node-bare', label: '' });
      });

      act(() => {
        result.current.handleConfigMapSave({ id: 'cm-bare', name: 'bare-cm', configData: [] });
      });

      let nodes = useFlowStore.getState().nodes;
      expect(nodes[0].data.configMaps).toEqual([
        expect.objectContaining({
          id: 'cm-bare',
          resourceName: 'node-bare', // fell back to target.id
          resourceType: 'Resource',   // fell back to 'Resource'
        }),
      ]);

      // 2. targetNodeId is 'cluster-storage' (unattached in overview)
      act(() => {
        result.current.setConfigMapModalTargetNode({ id: 'cluster-storage', label: 'Cluster ConfigMaps', initialViewMode: 'list' });
      });

      act(() => {
        result.current.handleConfigMapSave({ id: 'cm-cs', name: 'cs-cm', configData: [] });
      });

      expect(useFlowStore.getState().savedConfigMaps).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'cm-cs', name: 'cs-cm' })])
      );

      // 3. initialViewMode === 'list' with cmItem.resourceName present (isUnattachedInOverview is false, attaches to node)
      useFlowStore.setState({
        nodes: [
          {
            id: 'node-with-res',
            type: 'Pod',
            position: { x: 0, y: 0 },
            data: { label: 'Pod With Res' },
          } as any,
        ],
      });

      act(() => {
        result.current.setConfigMapModalTargetNode({ id: 'node-with-res', label: 'Pod With Res', initialViewMode: 'list' });
      });

      act(() => {
        result.current.handleConfigMapSave({ id: 'cm-with-res', name: 'with-res-cm', resourceName: 'Pod With Res', configData: [] });
      });

      nodes = useFlowStore.getState().nodes;
      expect(nodes[0].data.configMaps).toEqual([
        expect.objectContaining({ id: 'cm-with-res', name: 'with-res-cm', resourceName: 'Pod With Res' }),
      ]);

      // 4. initialViewMode === 'list' with !cmItem.resourceName (isUnattachedInOverview is true, stays unattached)
      act(() => {
        result.current.setConfigMapModalTargetNode({ id: 'node-with-res', label: 'Pod With Res', initialViewMode: 'list' });
      });

      act(() => {
        result.current.handleConfigMapSave({ id: 'cm-unattached-list', name: 'unattached-list-cm', configData: [] });
      });

      expect(useFlowStore.getState().savedConfigMaps).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'cm-unattached-list', name: 'unattached-list-cm' })])
      );

      // 5. User removes component association (resourceName is empty/different), removes ConfigMap from target
      act(() => {
        result.current.setConfigMapModalTargetNode({ id: 'node-with-res', label: 'Pod With Res' });
      });

      act(() => {
        result.current.handleConfigMapSave({ id: 'cm-with-res', name: 'with-res-cm', resourceName: '', configData: [] });
      });

      nodes = useFlowStore.getState().nodes;
      expect(nodes[0].data.configMaps).toHaveLength(0);
    });

    it('handleSecretSave returns early or attaches new/updated Secret', () => {
      const { result } = renderHook(() => useAttachmentHandlers());

      // Return early when secretModalTargetNode is null or non-existent
      act(() => {
        result.current.handleSecretSave({ id: 'sec-1', name: 'my-secret', secretType: 'Opaque', secretData: [] });
      });

      act(() => {
        result.current.setSecretModalTargetNode({ id: 'non-existent', label: 'NonExistent' });
      });

      act(() => {
        result.current.handleSecretSave({ id: 'sec-1', name: 'my-secret', secretType: 'Opaque', secretData: [] });
      });

      // Valid target node save
      act(() => {
        result.current.setSecretModalTargetNode({ id: 'node-1', label: 'Test Node' });
      });

      const sec1 = { id: 'sec-1', name: 'my-secret', secretType: 'Opaque', secretData: [] };
      act(() => {
        result.current.handleSecretSave(sec1);
      });

      let updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.secrets).toEqual([sec1]);

      // Update existing secret
      act(() => {
        result.current.setSecretModalTargetNode({ id: 'node-1', label: 'Test Node' });
      });

      const sec1Updated = { id: 'sec-1', name: 'updated-secret', secretType: 'Opaque', secretData: [{ key: 'K', value: 'V' }] };
      act(() => {
        result.current.handleSecretSave(sec1Updated);
      });

      updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.secrets).toEqual([sec1Updated]);
    });

    it('handleHpaSave returns early or attaches new/updated HPA', () => {
      const { result } = renderHook(() => useAttachmentHandlers());

      // Return early when hpaModalTargetNode is null or non-existent
      act(() => {
        result.current.handleHpaSave({ id: 'hpa-1', name: 'my-hpa', minReplicas: 1, maxReplicas: 5, targetCPU: 80 });
      });

      act(() => {
        result.current.setHpaModalTargetNode({ id: 'non-existent', label: 'NonExistent' });
      });

      act(() => {
        result.current.handleHpaSave({ id: 'hpa-1', name: 'my-hpa', minReplicas: 1, maxReplicas: 5, targetCPU: 80 });
      });

      // Valid target node save
      act(() => {
        result.current.setHpaModalTargetNode({ id: 'node-1', label: 'Test Node' });
      });

      const hpa1 = { id: 'hpa-1', name: 'my-hpa', minReplicas: 1, maxReplicas: 5, targetCPU: 80 };
      act(() => {
        result.current.handleHpaSave(hpa1);
      });

      let updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.hpas).toEqual([hpa1]);

      // Update existing HPA
      act(() => {
        result.current.setHpaModalTargetNode({ id: 'node-1', label: 'Test Node' });
      });

      const hpa1Updated = { id: 'hpa-1', name: 'updated-hpa', minReplicas: 2, maxReplicas: 10, targetCPU: 75 };
      act(() => {
        result.current.handleHpaSave(hpa1Updated);
      });

      updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.hpas).toEqual([hpa1Updated]);
    });

    it('covers HPA defaults when minReplicas, maxReplicas, or targetCPUUtilizationPercentage are falsy', () => {
      const { result } = renderHook(() => useAttachmentHandlers());

      act(() => {
        result.current.setHpaModalTargetNode({ id: 'node-1', label: 'Test Node' });
      });

      const hpaFalsy = { id: 'hpa-falsy', name: 'falsy-hpa' } as any;
      act(() => {
        result.current.handleHpaSave(hpaFalsy);
      });

      const updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.hpas).toEqual([hpaFalsy]);
    });

    it('handleResourceLimitSave returns early or attaches new/updated ResourceLimit', () => {
      const { result } = renderHook(() => useAttachmentHandlers());

      const resItem: K8sResourceLimitItem = {
        id: 'res-1',
        name: 'updated-limit',
        cpuRequest: '250m',
        cpuLimit: '500m',
        memoryRequest: '128Mi',
        memoryLimit: '256Mi',
      };

      // Return early when resourceLimitModalTargetNode is null
      act(() => {
        result.current.handleResourceLimitSave(resItem);
      });

      // Return early when target node not found
      act(() => {
        result.current.setResourceLimitModalTargetNode({ id: 'non-existent', label: 'NonExistent' });
      });

      act(() => {
        result.current.handleResourceLimitSave(resItem);
      });

      // Valid target node save - update existing item (index >= 0)
      act(() => {
        result.current.setResourceLimitModalTargetNode({ id: 'node-1', label: 'Test Node' });
      });

      act(() => {
        result.current.handleResourceLimitSave(resItem);
      });

      let updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.resourceLimits).toEqual([resItem]);
      expect(updatedNodes[0].data.cpuLimit).toBe('500m');
      expect(useFlowStore.getState().configuringNodeId).toBe('node-1');

      // Valid target node save - add new item (index < 0)
      act(() => {
        result.current.setResourceLimitModalTargetNode({ id: 'node-1', label: 'Test Node' });
      });

      const newResItem: K8sResourceLimitItem = {
        id: 'res-2',
        name: 'new-limit',
        cpuRequest: '500m',
        cpuLimit: '1000m',
        memoryRequest: '256Mi',
        memoryLimit: '512Mi',
      };

      act(() => {
        result.current.handleResourceLimitSave(newResItem);
      });

      updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.resourceLimits).toEqual([resItem, newResItem]);
    });

    it('handles saving role, configMap, and resourceLimit when target node has undefined collections', () => {
      useFlowStore.setState({
        nodes: [
          {
            id: 'node-clean',
            type: 'Deployment',
            position: { x: 0, y: 0 },
            data: {
              label: 'Clean Node',
              // roles, configMaps, resourceLimits are undefined
            },
          },
        ],
      });

      const { result } = renderHook(() => useAttachmentHandlers());

      // 1. handleRoleSave with undefined target.data.roles
      act(() => {
        result.current.setRoleModalTargetNode({ id: 'node-clean', label: 'Clean Node' });
      });
      const newRole: K8sRoleItem = { id: 'r-fresh', name: 'fresh-role', rules: [] };
      act(() => {
        result.current.handleRoleSave(newRole);
      });
      let updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.roles).toEqual([newRole]);

      // 2. handleConfigMapSave with undefined target.data.configMaps
      act(() => {
        useFlowStore.setState({
          nodes: [
            {
              id: 'node-clean',
              type: 'Deployment',
              position: { x: 0, y: 0 },
              data: { label: 'Clean Node' },
            },
          ],
        });
        result.current.setConfigMapModalTargetNode({ id: 'node-clean', label: 'Clean Node' });
      });
      const newCM: K8sConfigMapItem = { id: 'cm-fresh', name: 'fresh-cm', configData: [] };
      act(() => {
        result.current.handleConfigMapSave(newCM);
      });
      updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.configMaps).toEqual([
        expect.objectContaining({ id: 'cm-fresh', name: 'fresh-cm' }),
      ]);

      // 3. handleResourceLimitSave with undefined target.data.resourceLimits
      act(() => {
        useFlowStore.setState({
          nodes: [
            {
              id: 'node-clean',
              type: 'Deployment',
              position: { x: 0, y: 0 },
              data: { label: 'Clean Node' },
            },
          ],
        });
        result.current.setResourceLimitModalTargetNode({ id: 'node-clean', label: 'Clean Node' });
      });
      const newLimit: K8sResourceLimitItem = {
        id: 'limit-fresh',
        name: 'fresh-limit',
        cpuRequest: '100m',
        cpuLimit: '200m',
        memoryRequest: '128Mi',
        memoryLimit: '256Mi',
      };
      act(() => {
        result.current.handleResourceLimitSave(newLimit);
      });
      updatedNodes = useFlowStore.getState().nodes;
      expect(updatedNodes[0].data.resourceLimits).toEqual([newLimit]);
    });
  });

  describe('ConfigMap attachment helpers', () => {
    it('isNodeAttachedToConfigMap handles all conditions', () => {
      // 1. null target or cluster-storage
      expect(isNodeAttachedToConfigMap(null, { id: 'node-1' })).toBe(false);
      expect(isNodeAttachedToConfigMap({ id: 'node-1' }, { id: 'cluster-storage' })).toBe(false);

      // 2. resourceName is string
      const node = { id: 'node-1', data: { label: 'My Node' } };
      expect(isNodeAttachedToConfigMap(node, { id: 'node-1' }, 'My Node, Other Node')).toBe(true);
      expect(isNodeAttachedToConfigMap(node, { id: 'node-1' }, 'node-1')).toBe(true);
      expect(isNodeAttachedToConfigMap(node, { id: 'node-1' }, 'Unrelated Node')).toBe(false);

      // 2b. Replica pod matching group name or prefix
      const replicaPod = {
        id: 'pod-rep-1',
        type: 'Pod',
        data: {
          baseName: 'web-pod',
          podHash: '7f9b2',
          replicaSuffix: 'suf01',
          label: 'web-pod-7f9b2-suf01',
        },
      };
      expect(isNodeAttachedToConfigMap(replicaPod, { id: 'pod-rep-1' }, 'web-pod-7f9b2')).toBe(true);
      expect(isNodeAttachedToConfigMap(replicaPod, { id: 'pod-rep-1' }, 'other-pod-group')).toBe(false);

      // 3. resourceName is undefined
      expect(isNodeAttachedToConfigMap(node, { id: 'node-1', initialViewMode: 'list' })).toBe(false);
      expect(isNodeAttachedToConfigMap(node, { id: 'node-1', initialViewMode: 'form' })).toBe(true);
    });

    it('createEnrichedConfigMapItem correctly enriches or strips resource fields', () => {
      const baseCm: K8sConfigMapItem = { id: 'cm-1', name: 'app-cm', configData: [] };

      // Unattached
      const unattached = createEnrichedConfigMapItem(baseCm, null, false, 'dev-profile', 'Node Label');
      expect(unattached.profileName).toBe('dev-profile');
      expect(unattached.resourceName).toBeUndefined();
      expect(unattached.resourceType).toBeUndefined();

      // Attached with fallback profileName, targetLabel, and default 'Resource' type
      const attachedBare = createEnrichedConfigMapItem(baseCm, { id: 'node-1' }, true, 'dev-profile', 'Node Label');
      expect(attachedBare.profileName).toBe('dev-profile');
      expect(attachedBare.resourceName).toBe('Node Label');
      expect(attachedBare.resourceType).toBe('Resource');

      // Attached with custom profileName, resourceName, and target type
      const customCm: K8sConfigMapItem = {
        id: 'cm-2',
        name: 'custom-cm',
        profileName: 'custom-profile',
        resourceName: 'Custom Res',
        resourceType: 'Deployment',
        configData: [],
      };
      const attachedCustom = createEnrichedConfigMapItem(customCm, { id: 'node-1', type: 'StatefulSet' }, true, 'dev-profile', 'Node Label');
      expect(attachedCustom.profileName).toBe('custom-profile');
      expect(attachedCustom.resourceName).toBe('Custom Res');
      expect(attachedCustom.resourceType).toBe('Deployment');
    });

    it('attachConfigMapToNode updates existing or appends and logs event', () => {
      const mockUpdate = vi.fn();
      const target = {
        id: 'node-1',
        data: {
          configMaps: [{ id: 'cm-1', name: 'my-cm', configData: [] }],
        },
      };

      // Update existing
      const updatedCm: K8sConfigMapItem = { id: 'cm-1', name: 'my-cm', configData: [{ key: 'K', value: 'V' }] };
      attachConfigMapToNode(target, updatedCm, updatedCm, 'Target Card', mockUpdate);
      expect(mockUpdate).toHaveBeenCalledWith('node-1', { configMaps: [updatedCm] });

      // Append new
      const newCm: K8sConfigMapItem = { id: 'cm-2', name: 'other-cm', configData: [] };
      attachConfigMapToNode(target, newCm, newCm, 'Target Card', mockUpdate);
      expect(mockUpdate).toHaveBeenCalledWith('node-1', {
        configMaps: [target.data.configMaps[0], newCm],
      });
    });

    it('detachConfigMapFromNode removes existing item or skips if not found / null target', () => {
      const mockUpdate = vi.fn();

      // null target
      detachConfigMapFromNode(null, { id: 'cm-1', name: 'cm-1', configData: [] }, 'Target Card', mockUpdate);
      expect(mockUpdate).not.toHaveBeenCalled();

      // target without matching CM
      const target = {
        id: 'node-1',
        data: {
          configMaps: [{ id: 'cm-other', name: 'cm-other', configData: [] }],
        },
      };
      detachConfigMapFromNode(target, { id: 'cm-1', name: 'cm-1', configData: [] }, 'Target Card', mockUpdate);
      expect(mockUpdate).not.toHaveBeenCalled();

      // target with matching CM
      detachConfigMapFromNode(target, { id: 'cm-other', name: 'cm-other', configData: [] }, 'Target Card', mockUpdate);
      expect(mockUpdate).toHaveBeenCalledWith('node-1', { configMaps: [] });
    });
  });
});
