import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  extractPodBaseName,
  evaluateAutocompleteHover,
  formatDisplayLabel,
  useBaseNodeHandler,
} from '@/activities/nodes/useBaseNode';
import { useFlowStore } from '@/store';
import { K8sNodeData } from '@/types';

describe('useBaseNode activity helpers and hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      draggingSidebarItem: null,
      nodes: [],
      hoveredAutocompletePodName: null,
    });
  });

  describe('extractPodBaseName', () => {
    it('returns baseName directly if provided or falls back for non-Pod types', () => {
      expect(extractPodBaseName({ type: 'Deployment', label: 'my-dep' } as K8sNodeData)).toBe('my-dep');
      expect(extractPodBaseName({ type: 'Deployment' } as K8sNodeData)).toBe('pod');
      expect(extractPodBaseName({ type: 'Pod', baseName: 'custom-base', label: 'custom-base-hash-suf' } as K8sNodeData)).toBe('custom-base');
    });

    it('slices label when ends with -podHash-replicaSuffix or -podHash', () => {
      const dataHashAndSuf: K8sNodeData = {
        type: 'Pod',
        podHash: 'abc12',
        replicaSuffix: 'xyz89',
        label: 'web-app-abc12-xyz89',
      };
      expect(extractPodBaseName(dataHashAndSuf)).toBe('web-app');

      const dataHashOnly: K8sNodeData = {
        type: 'Pod',
        podHash: 'abc12',
        label: 'web-app-abc12',
      };
      expect(extractPodBaseName(dataHashOnly)).toBe('web-app');
    });

    it('falls back to label or "pod" when pattern does not match', () => {
      expect(extractPodBaseName({ type: 'Pod', label: 'standalone-pod' } as K8sNodeData)).toBe('standalone-pod');
      expect(extractPodBaseName({ type: 'Pod' } as K8sNodeData)).toBe('pod');
    });
  });

  describe('evaluateAutocompleteHover', () => {
    it('returns not hovered if hoveredName is null', () => {
      const res = evaluateAutocompleteHover('node-1', { label: 'pod-1' } as K8sNodeData, null);
      expect(res).toEqual({ isAutocompleteHovered: false, hoveredPodIndex: null });
    });

    it('returns true when hoveredName matches label or node id', () => {
      expect(evaluateAutocompleteHover('node-1', { label: 'pod-1' } as K8sNodeData, 'pod-1')).toEqual({
        isAutocompleteHovered: true,
        hoveredPodIndex: 0,
      });
      expect(evaluateAutocompleteHover('node-1', { label: 'pod-1' } as K8sNodeData, 'node-1')).toEqual({
        isAutocompleteHovered: true,
        hoveredPodIndex: 0,
      });
    });

    it('evaluates pod with replicaSuffixes array matching suffix or full name', () => {
      const dataWithSuffixes: K8sNodeData = {
        type: 'Pod',
        podHash: 'hash1',
        replicaSuffixes: ['suf1', 'suf2', 'suf3'],
        label: 'pod-group',
      };

      const match1 = evaluateAutocompleteHover('node-1', dataWithSuffixes, 'app-hash1-suf2');
      expect(match1).toEqual({ isAutocompleteHovered: true, hoveredPodIndex: 1 });

      const matchEnd = evaluateAutocompleteHover('node-1', dataWithSuffixes, 'app-hash1-suf3');
      expect(matchEnd).toEqual({ isAutocompleteHovered: true, hoveredPodIndex: 2 });

      const noMatch = evaluateAutocompleteHover('node-1', dataWithSuffixes, 'app-hash1-suf99');
      expect(noMatch).toEqual({ isAutocompleteHovered: false, hoveredPodIndex: null });
    });

    it('evaluates pod with single replicaSuffix property', () => {
      const singleSuffixData: K8sNodeData = {
        type: 'Pod',
        podHash: 'hash1',
        replicaSuffix: 'suf1',
        label: 'pod-single',
      };

      const matchSingle = evaluateAutocompleteHover('node-1', singleSuffixData, 'app-hash1-suf1');
      expect(matchSingle).toEqual({ isAutocompleteHovered: true, hoveredPodIndex: 0 });

      const noMatch = evaluateAutocompleteHover('node-1', singleSuffixData, 'other-hovered');
      expect(noMatch).toEqual({ isAutocompleteHovered: false, hoveredPodIndex: null });
    });
  });

  describe('formatDisplayLabel', () => {
    it('returns original label if not stacked', () => {
      expect(formatDisplayLabel({ label: 'my-pod' } as K8sNodeData, 'my-pod', false)).toBe('my-pod');
    });

    it('masks stacked pod label with podHash or fallback', () => {
      expect(formatDisplayLabel({ label: 'my-pod', podHash: 'abc12' } as K8sNodeData, 'my-pod', true)).toBe('my-pod-abc12-*****');
      expect(formatDisplayLabel({ label: 'my-pod' } as K8sNodeData, 'my-pod', true)).toBe('my-pod-*****');
    });
  });

  describe('useBaseNodeHandler hook', () => {
    it('computes node properties, status override, and parent namespace checks', () => {
      useFlowStore.setState({
        nodes: [
          { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} },
          { id: 'dep1', type: 'Deployment', parentId: 'ns1', position: { x: 0, y: 0 }, data: {} },
          { id: 'pod1', type: 'Pod', parentId: 'dep1', position: { x: 0, y: 0 }, data: { label: 'pod1', type: 'Pod', parentReplicas: 5 } },
        ],
        draggingSidebarItem: 'Role',
      });

      const { result } = renderHook(() =>
        useBaseNodeHandler({
          id: 'pod1',
          data: { label: 'pod1', type: 'Pod', parentReplicas: 5 } as K8sNodeData,
          color: 'blue',
          statusOverride: 'pending',
        })
      );

      expect(result.current.isPending).toBe(true);
      expect(result.current.showDashedProgress).toBe(true);
      expect(result.current.displayLabel).toContain('*****');
    });

    it('handles nested nodes when grandparent is a Namespace or when parent is not in a namespace', () => {
      useFlowStore.setState({
        nodes: [
          { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} },
          { id: 'dep1', type: 'Deployment', parentId: 'ns1', position: { x: 0, y: 0 }, data: {} },
          { id: 'pod1', type: 'Pod', parentId: 'dep1', position: { x: 0, y: 0 }, data: { label: 'pod1', type: 'Pod' } },
          { id: 'otherParent', type: 'Deployment', position: { x: 0, y: 0 }, data: {} },
          { id: 'pod2', type: 'Pod', parentId: 'otherParent', position: { x: 0, y: 0 }, data: { label: 'pod2', type: 'Pod' } },
        ],
      });

      const { result: res1 } = renderHook(() =>
        useBaseNodeHandler({
          id: 'pod1',
          data: { label: 'pod1', type: 'Pod' } as K8sNodeData,
          color: 'blue',
        })
      );
      expect(res1.current.displayLabel).toBe('pod1');

      const { result: res2 } = renderHook(() =>
        useBaseNodeHandler({
          id: 'pod2',
          data: { label: 'pod2', type: 'Pod' } as K8sNodeData,
          color: 'blue',
        })
      );
      expect(res2.current.displayLabel).toBe('pod2');
    });
  });
});
