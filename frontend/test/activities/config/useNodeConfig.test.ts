import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  syncPeersAndParent,
  syncParentPodUpdates,
  useNodeConfigHandler,
} from '@/activities/config/useNodeConfig';
import { useFlowStore } from '@/store';

describe('useNodeConfig', () => {
  const mockUpdateNodeData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      updateNodeData: mockUpdateNodeData,
    });
  });

  describe('syncPeersAndParent', () => {
    it('updates peer pods and parent node for displaySettings and ignores current node and non-peers', () => {
      const parentNode = {
        id: 'dep-1',
        type: 'Deployment',
        data: { label: 'web-dep' },
      };
      const peerPod = {
        id: 'pod-2',
        type: 'Pod',
        parentId: 'dep-1',
        data: { label: 'web-dep-pod' },
      };
      const nonPeerNode = {
        id: 'svc-1',
        type: 'Service',
        data: { label: 'some-svc' },
      };
      const currentPod = {
        id: 'pod-1',
        type: 'Pod',
        parentId: 'dep-1',
        data: { label: 'web-dep-pod' },
      };

      useFlowStore.setState({
        nodes: [parentNode, peerPod, nonPeerNode, currentPod] as any,
        updateNodeData: mockUpdateNodeData,
      });

      syncPeersAndParent(
        currentPod,
        { extraField: true },
        { ports: false },
        'displaySettings',
        currentPod.data
      );

      // Peer pod updated
      expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-2', {
        extraField: true,
        displaySettings: { ports: false },
      });
      // Parent deployment updated
      expect(mockUpdateNodeData).toHaveBeenCalledWith('dep-1', {
        extraField: true,
        displaySettings: { ports: false },
      });
      // Non-peer node and current pod not updated by syncPeersAndParent
      expect(mockUpdateNodeData).not.toHaveBeenCalledWith('svc-1', expect.anything());
      expect(mockUpdateNodeData).not.toHaveBeenCalledWith('pod-1', expect.anything());
    });

    it('updates peer pods and parent node for yamlSettings with data spread', () => {
      const parentNode = {
        id: 'dep-1',
        type: 'Deployment',
        data: { label: 'web-dep' },
      };
      const currentPod = {
        id: 'pod-1',
        type: 'Pod',
        parentId: 'dep-1',
        data: { label: 'web-dep-pod', cpuLimit: '100m' },
      };

      useFlowStore.setState({
        nodes: [parentNode, currentPod] as any,
        updateNodeData: mockUpdateNodeData,
      });

      syncPeersAndParent(
        currentPod,
        {},
        { env: true },
        'yamlSettings',
        currentPod.data
      );

      expect(mockUpdateNodeData).toHaveBeenCalledWith('dep-1', {
        label: 'web-dep-pod',
        cpuLimit: '100m',
        yamlSettings: { env: true },
      });
    });

    it('handles parent node not found gracefully when parentId is set', () => {
      const currentPod = {
        id: 'pod-1',
        type: 'Pod',
        parentId: 'non-existent-parent',
        data: { label: 'web-pod' },
      };

      useFlowStore.setState({
        nodes: [currentPod] as any,
        updateNodeData: mockUpdateNodeData,
      });

      syncPeersAndParent(
        currentPod,
        {},
        { ports: true },
        'displaySettings',
        currentPod.data
      );

      expect(mockUpdateNodeData).not.toHaveBeenCalled();
    });
  });

  describe('syncParentPodUpdates', () => {
    it('returns early if selectedNode is not a Pod', () => {
      syncParentPodUpdates({ id: 'svc-1', type: 'Service', parentId: 'dep-1' }, { label: 'new-svc' });
      expect(mockUpdateNodeData).not.toHaveBeenCalled();
    });

    it('returns early if selectedNode has no parentId', () => {
      syncParentPodUpdates({ id: 'pod-1', type: 'Pod' }, { cpuLimit: '200m' });
      expect(mockUpdateNodeData).not.toHaveBeenCalled();
    });

    it('returns early if parent node is not found in store', () => {
      useFlowStore.setState({ nodes: [] });
      syncParentPodUpdates({ id: 'pod-1', type: 'Pod', parentId: 'dep-1' }, { cpuLimit: '200m' });
      expect(mockUpdateNodeData).not.toHaveBeenCalled();
    });

    it('syncs allowed keys to parent deployment when updates contain allowed keys', () => {
      const parentNode = { id: 'dep-1', type: 'Deployment', data: {} };
      const selectedPod = { id: 'pod-1', type: 'Pod', parentId: 'dep-1' };

      useFlowStore.setState({
        nodes: [parentNode] as any,
        updateNodeData: mockUpdateNodeData,
      });

      syncParentPodUpdates(selectedPod, {
        cpuLimit: '500m',
        memoryLimit: '1Gi',
        unrelatedKey: 'ignored',
      });

      expect(mockUpdateNodeData).toHaveBeenCalledWith('dep-1', {
        cpuLimit: '500m',
        memoryLimit: '1Gi',
      });
    });

    it('does not call updateNodeData if updates contain no synced keys', () => {
      const parentNode = { id: 'dep-1', type: 'Deployment', data: {} };
      const selectedPod = { id: 'pod-1', type: 'Pod', parentId: 'dep-1' };

      useFlowStore.setState({
        nodes: [parentNode] as any,
        updateNodeData: mockUpdateNodeData,
      });

      syncParentPodUpdates(selectedPod, { unrelatedKey: 'ignored' });

      expect(mockUpdateNodeData).not.toHaveBeenCalled();
    });
  });

  describe('useNodeConfigHandler', () => {
    it('toggleVisibility toggles visibility field and defaults displaySettings when missing', () => {
      const selectedNode = {
        id: 'pod-1',
        type: 'Pod',
        data: { label: 'pod-1' },
      };

      useFlowStore.setState({
        nodes: [selectedNode] as any,
        updateNodeData: mockUpdateNodeData,
      });

      const { result } = renderHook(() => useNodeConfigHandler(selectedNode));

      act(() => {
        result.current.toggleVisibility('ports');
      });

      expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-1', {
        label: 'pod-1',
        displaySettings: { ports: false },
      });
    });

    it('toggleVisibility toggles existing false field to true', () => {
      const selectedNode = {
        id: 'pod-1',
        type: 'Pod',
        data: { label: 'pod-1', displaySettings: { ports: false } },
      };

      useFlowStore.setState({
        nodes: [selectedNode] as any,
        updateNodeData: mockUpdateNodeData,
      });

      const { result } = renderHook(() => useNodeConfigHandler(selectedNode));

      act(() => {
        result.current.toggleVisibility('ports');
      });

      expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-1', expect.objectContaining({
        displaySettings: { ports: true },
      }));
    });

    it('toggleYaml toggles yamlSettings field and defaults yamlSettings when missing', () => {
      const selectedNode = {
        id: 'pod-1',
        type: 'Pod',
        data: { label: 'pod-1' },
      };

      useFlowStore.setState({
        nodes: [selectedNode] as any,
        updateNodeData: mockUpdateNodeData,
      });

      const { result } = renderHook(() => useNodeConfigHandler(selectedNode));

      act(() => {
        result.current.toggleYaml('env');
      });

      expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-1', {
        label: 'pod-1',
        yamlSettings: { env: false },
      });
    });

    it('toggleYaml toggles existing false yamlSetting field to true', () => {
      const selectedNode = {
        id: 'pod-1',
        type: 'Pod',
        data: { label: 'pod-1', yamlSettings: { env: false } },
      };

      useFlowStore.setState({
        nodes: [selectedNode] as any,
        updateNodeData: mockUpdateNodeData,
      });

      const { result } = renderHook(() => useNodeConfigHandler(selectedNode));

      act(() => {
        result.current.toggleYaml('env');
      });

      expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-1', {
        label: 'pod-1',
        yamlSettings: { env: true },
      });
    });

    it('performUpdate applies workload updates for Pod and Deployment and standard updates for Service', () => {
      // 1. Pod performUpdate
      const podNode = {
        id: 'pod-1',
        type: 'Pod',
        data: { label: 'pod-1' },
      };
      useFlowStore.setState({
        nodes: [podNode] as any,
        updateNodeData: mockUpdateNodeData,
      });

      const { result: podHook } = renderHook(() => useNodeConfigHandler(podNode));
      act(() => {
        podHook.current.performUpdate({ cpuLimit: '250m' });
      });

      expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-1', expect.objectContaining({
        cpuLimit: '250m',
      }));

      // 2. Service performUpdate (non-workload)
      mockUpdateNodeData.mockClear();
      const serviceNode = {
        id: 'svc-1',
        type: 'Service',
        data: { label: 'svc-1', port: 80 },
      };
      useFlowStore.setState({
        nodes: [serviceNode] as any,
        updateNodeData: mockUpdateNodeData,
      });

      const { result: svcHook } = renderHook(() => useNodeConfigHandler(serviceNode));
      act(() => {
        svcHook.current.performUpdate({ port: 8080 });
      });

      expect(mockUpdateNodeData).toHaveBeenCalledWith('svc-1', {
        label: 'svc-1',
        port: 8080,
      });
    });

    it('randomizePodHash re-randomizes deployment group pods via setNodes', () => {
      const mockSetNodes = vi.fn();
      const parentDeployment = {
        id: 'dep-1',
        type: 'Deployment',
        data: { label: 'myapp', replicas: 2 },
      };
      const pod1 = {
        id: 'p1',
        type: 'Pod',
        parentId: 'dep-1',
        data: { baseName: 'myapp', podHash: 'old01', replicaSuffix: 'suf01', label: 'myapp-old01-suf01' },
      };
      const pod2 = {
        id: 'p2',
        type: 'Pod',
        parentId: 'dep-1',
        data: { baseName: 'myapp', podHash: 'old01', replicaSuffix: 'suf02', label: 'myapp-old01-suf02' },
      };

      useFlowStore.setState({
        nodes: [parentDeployment, pod1, pod2] as any,
        setNodes: mockSetNodes,
        updateNodeData: mockUpdateNodeData,
      });

      const { result } = renderHook(() => useNodeConfigHandler(pod1));
      act(() => {
        result.current.randomizePodHash();
      });

      expect(mockSetNodes).toHaveBeenCalled();
      const updatedNodes = mockSetNodes.mock.calls[0][0];
      const updatedPod1 = updatedNodes.find((n: any) => n.id === 'p1');
      const updatedPod2 = updatedNodes.find((n: any) => n.id === 'p2');

      expect(updatedPod1.data.podHash).not.toBe('old01');
      expect(updatedPod1.data.podHash).toBe(updatedPod2.data.podHash);
      expect(updatedPod1.data.replicaSuffix).not.toBe('suf01');
      expect(updatedPod2.data.replicaSuffix).not.toBe('suf02');
      expect(updatedPod1.data.label).toBe(`myapp-${updatedPod1.data.podHash}-${updatedPod1.data.replicaSuffix}`);
      expect(updatedPod2.data.label).toBe(`myapp-${updatedPod2.data.podHash}-${updatedPod2.data.replicaSuffix}`);
    });

    it('updatePodBaseName updates deployment label when pod has parent deployment', () => {
      const parentDeployment = {
        id: 'dep-1',
        type: 'Deployment',
        data: { label: 'myapp', replicas: 1 },
      };
      const pod1 = {
        id: 'p1',
        type: 'Pod',
        parentId: 'dep-1',
        data: { baseName: 'myapp', podHash: 'old01', replicaSuffix: 'suf01', label: 'myapp-old01-suf01' },
      };

      useFlowStore.setState({
        nodes: [parentDeployment, pod1] as any,
        updateNodeData: mockUpdateNodeData,
      });

      const { result } = renderHook(() => useNodeConfigHandler(pod1));
      act(() => {
        result.current.updatePodBaseName('newapp');
      });

      expect(mockUpdateNodeData).toHaveBeenCalledWith('dep-1', { label: 'newapp' });
    });
  });
});
