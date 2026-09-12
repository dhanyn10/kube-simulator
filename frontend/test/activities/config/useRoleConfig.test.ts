import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoleConfigHandler, getVerbButtonStyles } from '@/activities/config/useRoleConfig';
import { useFlowStore } from '@/store';
import { K8sRoleRule, Node, Edge } from '@/types';

describe('useRoleConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      updateNodeData: vi.fn(),
      setEdges: vi.fn(),
      addLog: vi.fn(),
    });
  });

  describe('getVerbButtonStyles', () => {
    it('returns selected button style', () => {
      expect(getVerbButtonStyles(true, 'dark')).toContain('bg-emerald-500/20');
      expect(getVerbButtonStyles(true, 'light')).toContain('bg-emerald-500/20');
    });

    it('returns unselected button style for dark and light modes', () => {
      expect(getVerbButtonStyles(false, 'dark')).toContain('bg-slate-800/40');
      expect(getVerbButtonStyles(false, 'light')).toContain('bg-white');
    });
  });

  describe('useRoleConfigHandler', () => {
    it('handleAddRule appends a new rule', () => {
      const rules: K8sRoleRule[] = [
        { apiGroups: ['apps'], resources: ['pods'], verbs: ['get'] },
      ];
      const updateNodeDataSpy = vi.fn();
      useFlowStore.setState({ updateNodeData: updateNodeDataSpy });

      const { result } = renderHook(() => useRoleConfigHandler('role-1', rules));

      act(() => {
        result.current.handleAddRule();
      });

      expect(updateNodeDataSpy).toHaveBeenCalledWith('role-1', {
        rules: [
          ...rules,
          { apiGroups: [''], resources: [], verbs: ['get', 'list'] },
        ],
      });
    });

    it('handleRemoveRule removes specified rule by index', () => {
      const rules: K8sRoleRule[] = [
        { apiGroups: ['apps'], resources: ['pods'], verbs: ['get'] },
      ];
      const updateNodeDataSpy = vi.fn();
      useFlowStore.setState({ updateNodeData: updateNodeDataSpy });

      const { result } = renderHook(() => useRoleConfigHandler('role-1', rules));

      act(() => {
        result.current.handleRemoveRule(0);
      });

      expect(updateNodeDataSpy).toHaveBeenCalledWith('role-1', { rules: [] });
    });

    it('handleToggleVerb toggles verb presence in specified rule', () => {
      const rules: K8sRoleRule[] = [
        { apiGroups: ['apps'], resources: ['pods'], verbs: ['get', 'list'] },
      ];
      const updateNodeDataSpy = vi.fn();
      useFlowStore.setState({ updateNodeData: updateNodeDataSpy });

      const { result } = renderHook(() => useRoleConfigHandler('role-1', rules));

      // Remove existing verb 'get'
      act(() => {
        result.current.handleToggleVerb(0, 'get');
      });

      expect(updateNodeDataSpy).toHaveBeenNthCalledWith(1, 'role-1', {
        rules: [
          {
            apiGroups: ['apps'],
            resources: ['pods'],
            verbs: ['list'],
          },
        ],
      });

      // Add verb 'watch'
      act(() => {
        result.current.handleToggleVerb(0, 'watch');
      });

      expect(updateNodeDataSpy).toHaveBeenNthCalledWith(2, 'role-1', {
        rules: [
          {
            apiGroups: ['apps'],
            resources: ['pods'],
            verbs: ['list', 'watch'],
          },
        ],
      });
    });

    it('handleDisconnectResource removes resource and connected edges when edges exist', () => {
      const rules: K8sRoleRule[] = [
        { apiGroups: ['apps'], resources: ['pods', 'deployments'], verbs: ['get'] },
      ];
      const updateNodeDataSpy = vi.fn();
      const setEdgesSpy = vi.fn();
      const addLogSpy = vi.fn();

      const roleNode: Node = { id: 'role-1', type: 'Role', position: { x: 0, y: 0 }, data: {} };
      const podNode: Node = { id: 'pod-1', type: 'Pod', position: { x: 100, y: 0 }, data: {} };
      const edge: Edge = { id: 'e1', source: 'role-1', target: 'pod-1' };

      useFlowStore.setState({
        nodes: [roleNode, podNode] as any,
        edges: [edge] as any,
        updateNodeData: updateNodeDataSpy,
        setEdges: setEdgesSpy,
        addLog: addLogSpy,
      });

      const { result } = renderHook(() => useRoleConfigHandler('role-1', rules));

      act(() => {
        result.current.handleDisconnectResource('pods');
      });

      expect(setEdgesSpy).toHaveBeenCalledWith([]);
      expect(updateNodeDataSpy).toHaveBeenCalledWith('role-1', {
        rules: [
          {
            apiGroups: ['apps'],
            resources: ['deployments'],
            verbs: ['get'],
          },
        ],
      });
      expect(addLogSpy).toHaveBeenCalledWith('info', '[Canvas Action] Disconnected Role from pods', 'UI');
    });

    it('handleDisconnectResource removes resource when no connected edges exist', () => {
      const rules: K8sRoleRule[] = [
        { apiGroups: ['apps'], resources: ['pods', 'deployments'], verbs: ['get'] },
      ];
      const updateNodeDataSpy = vi.fn();

      useFlowStore.setState({
        nodes: [{ id: 'role-1', type: 'Role', position: { x: 0, y: 0 }, data: {} }] as any,
        edges: [],
        updateNodeData: updateNodeDataSpy,
      });

      const { result } = renderHook(() => useRoleConfigHandler('role-1', rules));

      act(() => {
        result.current.handleDisconnectResource('deployments');
      });

      expect(updateNodeDataSpy).toHaveBeenCalledWith('role-1', {
        rules: [
          {
            apiGroups: ['apps'],
            resources: ['pods'],
            verbs: ['get'],
          },
        ],
      });
    });
  });
});
