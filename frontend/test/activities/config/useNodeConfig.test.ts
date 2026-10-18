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
      const peerPod = {
        id: 'pod-2',
        type: 'Pod',
        parentId: 'dep-1',
        data: { label: 'web-dep-pod' },
      };
      const currentPod = {
        id: 'pod-1',
        type: 'Pod',
        parentId: 'dep-1',
        data: { label: 'web-dep-pod', cpuLimit: '100m' },
      };

      useFlowStore.setState({
        nodes: [parentNode, peerPod, currentPod] as any,
        updateNodeData: mockUpdateNodeData,
      });

      syncPeersAndParent(
        currentPod,
        {},
        { env: true },
        'yamlSettings',
        currentPod.data
      );

      expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-2', {
        label: 'web-dep-pod',
        cpuLimit: '100m',
        yamlSettings: { env: true },
      });
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

    it('covers podHash / podBaseName fallbacks and standalone pod updatePodBaseName / randomizePodHash', () => {
      // 1. Pod node without podHash or baseName, with label containing podHash suffix
      const podWithHashInLabel = {
        id: 'p-standalone-1',
        type: 'Pod',
        data: { label: 'mybase-abc12-xyz34', podHash: 'abc12', replicaSuffix: 'xyz34' },
      };
      useFlowStore.setState({
        nodes: [podWithHashInLabel] as any,
        updateNodeData: mockUpdateNodeData,
      });

      const { result: res1 } = renderHook(() => useNodeConfigHandler(podWithHashInLabel));
      expect(res1.current.podBaseName).toBe('mybase');
      expect(res1.current.podHash).toBe('abc12');

      // 2. Pod node with podHash in label ending with -podHash
      const podHashOnlyInLabel = {
        id: 'p-standalone-2',
        type: 'Pod',
        data: { label: 'mybase-abc12', podHash: 'abc12' },
      };
      const { result: res2 } = renderHook(() => useNodeConfigHandler(podHashOnlyInLabel));
      expect(res2.current.podBaseName).toBe('mybase');

      // 3. Pod node without hyphen or label or baseName (defaults podBaseName to 'pod' or label)
      const podNoHyphen = {
        id: 'p-standalone-3',
        type: 'Pod',
        data: { label: '' },
      };
      const { result: res3 } = renderHook(() => useNodeConfigHandler(podNoHyphen));
      expect(res3.current.podBaseName).toBe('pod');
      expect(res3.current.podHash).toBeDefined();

      // 4. Standalone pod updatePodBaseName (no parent deployment)
      const standalonePod = {
        id: 'p-standalone-4',
        type: 'Pod',
        data: { baseName: 'oldbase', podHash: 'hash1', replicaSuffix: 'suf1', label: 'oldbase-hash1-suf1' },
      };
      const { result: res4 } = renderHook(() => useNodeConfigHandler(standalonePod));
      act(() => {
        res4.current.updatePodBaseName('newbase');
      });
      expect(mockUpdateNodeData).toHaveBeenCalledWith('p-standalone-4', {
        baseName: 'newbase',
        label: 'newbase-hash1-suf1',
        podHash: 'hash1',
      });

      // 5. Standalone pod randomizePodHash (no parent deployment)
      mockUpdateNodeData.mockClear();
      act(() => {
        res4.current.randomizePodHash();
      });
      expect(mockUpdateNodeData).toHaveBeenCalledWith('p-standalone-4', expect.objectContaining({
        baseName: 'oldbase',
      }));
    });

    it('covers ReplicaSet deploymentNode in updatePodBaseName and randomizePodHash, and empty slug fallback to "pod"', () => {
      // 1. ReplicaSet node as selectedNode in updatePodBaseName and randomizePodHash
      const replicaSetNode = {
        id: 'rs-1',
        type: 'ReplicaSet',
        data: { label: 'myrs', replicas: 1 },
      };
      const mockSetNodes = vi.fn();

      useFlowStore.setState({
        nodes: [replicaSetNode] as any,
        updateNodeData: mockUpdateNodeData,
        setNodes: mockSetNodes,
      });

      const { result: resRs } = renderHook(() => useNodeConfigHandler(replicaSetNode));

      act(() => {
        resRs.current.updatePodBaseName('newrs');
      });
      expect(mockUpdateNodeData).toHaveBeenCalledWith('rs-1', { label: 'newrs' });

      act(() => {
        resRs.current.randomizePodHash();
      });
      expect(mockSetNodes).toHaveBeenCalled();

      // 2. Empty/invalid slug input falls back to 'pod'
      mockUpdateNodeData.mockClear();
      const standalonePod = {
        id: 'p-empty-slug',
        type: 'Pod',
        data: { baseName: 'pod', podHash: 'h1', label: 'pod-h1' },
      };
      useFlowStore.setState({
        nodes: [standalonePod] as any,
        updateNodeData: mockUpdateNodeData,
      });

      const { result: resEmpty } = renderHook(() => useNodeConfigHandler(standalonePod));
      act(() => {
        resEmpty.current.updatePodBaseName('!@#$%^');
      });
      expect(mockUpdateNodeData).toHaveBeenCalledWith('p-empty-slug', {
        baseName: 'pod',
        label: 'pod-h1',
        podHash: 'h1',
      });
    });

    it('covers child Pod calling updatePodBaseName and randomizePodHash which resolves parent Deployment by parentId', () => {
      const mockSetNodes = vi.fn();
      const parentDep = {
        id: 'dep-child-test',
        type: 'Deployment',
        data: { label: 'olddepname', replicas: 1 },
      };
      const childPod = {
        id: 'pod-child-test',
        type: 'Pod',
        parentId: 'dep-child-test',
        data: { baseName: 'olddepname', podHash: 'h1234', replicaSuffix: 's1234', label: 'olddepname-h1234-s1234' },
      };

      useFlowStore.setState({
        nodes: [parentDep, childPod] as any,
        updateNodeData: mockUpdateNodeData,
        setNodes: mockSetNodes,
      });

      const { result } = renderHook(() => useNodeConfigHandler(childPod));

      // 1. Child pod updatePodBaseName resolves parent deployment
      act(() => {
        result.current.updatePodBaseName('newdepname');
      });
      expect(mockUpdateNodeData).toHaveBeenCalledWith('dep-child-test', { label: 'newdepname' });

      // 2. Child pod randomizePodHash resolves parent deployment
      act(() => {
        result.current.randomizePodHash();
      });
      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('covers podHash and podBaseName fallback when node data has no label or baseName or podHash', () => {
      const bareNode = {
        id: 'p-bare',
        type: 'Pod',
        data: {}, // no label, no baseName, no podHash
      };

      useFlowStore.setState({
        nodes: [bareNode] as any,
        updateNodeData: mockUpdateNodeData,
      });

      const { result } = renderHook(() => useNodeConfigHandler(bareNode));

      expect(result.current.podBaseName).toBe('pod');
      expect(result.current.podHash).toHaveLength(5);
    });

    it('handles orphaned child pod where parentId is not found in store for updatePodBaseName and randomizePodHash', () => {
      const orphanedPod = {
        id: 'pod-orphan',
        type: 'Pod',
        parentId: 'non-existent-dep',
        data: { baseName: 'mybase', podHash: 'hash1', replicaSuffix: 'suf1', label: 'mybase-hash1-suf1' },
      };

      useFlowStore.setState({
        nodes: [orphanedPod] as any,
        updateNodeData: mockUpdateNodeData,
      });

      const { result } = renderHook(() => useNodeConfigHandler(orphanedPod));

      // Line 108: updatePodBaseName when parentId does not resolve in state.nodes
      act(() => {
        result.current.updatePodBaseName('newbase');
      });
      expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-orphan', {
        baseName: 'newbase',
        label: 'newbase-hash1-suf1',
        podHash: 'hash1',
      });

      // Line 128: randomizePodHash when parentId does not resolve in state.nodes
      mockUpdateNodeData.mockClear();
      act(() => {
        result.current.randomizePodHash();
      });
      expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-orphan', expect.objectContaining({
        baseName: 'mybase',
      }));
    });

    it('covers sanitizeSlug fallback to "pod" in randomizePodHash for standalone pod', () => {
      const podWithSpecialCharsBaseName = {
        id: 'pod-special',
        type: 'Pod',
        data: { baseName: '$$$###@@@', podHash: 'h1234', label: '$$$###@@@-h1234' },
      };

      useFlowStore.setState({
        nodes: [podWithSpecialCharsBaseName] as any,
        updateNodeData: mockUpdateNodeData,
      });

      const { result } = renderHook(() => useNodeConfigHandler(podWithSpecialCharsBaseName));

      act(() => {
        result.current.randomizePodHash();
      });

      expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-special', expect.objectContaining({
        baseName: 'pod',
      }));
    });
  });
});
