import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';
import { Node, Edge } from '@xyflow/react';

describe('clipboardHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      clipboard: null,
    });
  });

  describe('copyNodes', () => {
    it('does nothing if no nodes are selected', () => {
      useFlowStore.setState({
        nodes: [
          { id: 'n1', selected: false, position: { x: 0, y: 0 }, data: {} },
        ] as Node[],
      });

      useFlowStore.getState().copyNodes();
      expect(useFlowStore.getState().clipboard).toBeNull();
    });

    it('copies selected nodes and child pods of selected Deployment along with connecting edges', () => {
      const dep: Node = { id: 'dep1', type: 'Deployment', selected: true, position: { x: 0, y: 0 }, data: { label: 'Dep' } };
      const childPod: Node = { id: 'pod1', type: 'Pod', parentId: 'dep1', selected: false, position: { x: 10, y: 10 }, data: { label: 'Pod1' } };
      const unselectedNode: Node = { id: 'other', type: 'Service', selected: false, position: { x: 100, y: 100 }, data: {} };

      const edgeDepToPod: Edge = { id: 'e1', source: 'dep1', target: 'pod1' };
      const edgeToOther: Edge = { id: 'e2', source: 'dep1', target: 'other' };

      useFlowStore.setState({
        nodes: [dep, childPod, unselectedNode],
        edges: [edgeDepToPod, edgeToOther],
      });

      useFlowStore.getState().copyNodes();

      const clipboard = useFlowStore.getState().clipboard;
      expect(clipboard?.nodes).toHaveLength(2);
      expect(clipboard?.nodes.map((n) => n.id)).toEqual(['dep1', 'pod1']);
      expect(clipboard?.edges).toHaveLength(1);
      expect(clipboard?.edges[0].id).toBe('e1');
    });
  });

  describe('pasteNodes', () => {
    it('does nothing if clipboard is null or contains no nodes', () => {
      useFlowStore.setState({ clipboard: null, nodes: [] });
      useFlowStore.getState().pasteNodes();
      expect(useFlowStore.getState().nodes).toHaveLength(0);

      useFlowStore.setState({ clipboard: { nodes: [], edges: [] } });
      useFlowStore.getState().pasteNodes();
      expect(useFlowStore.getState().nodes).toHaveLength(0);
    });

    it('increments pod replicas when pasting a pod while a matching pod is selected in a Deployment', () => {
      const parentDep: Node = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 2 } };
      const selectedPod: Node = { id: 'pod1', type: 'Pod', parentId: 'dep1', selected: true, position: { x: 10, y: 10 }, data: { label: 'worker' } };

      const updateNodeData = vi.fn();
      useFlowStore.setState({
        nodes: [parentDep, selectedPod],
        updateNodeData,
        clipboard: {
          nodes: [{ id: 'pod1', type: 'Pod', position: { x: 10, y: 10 }, data: { label: 'worker' } } as Node],
          edges: [],
        },
      });

      useFlowStore.getState().pasteNodes();

      expect(updateNodeData).toHaveBeenCalledWith('dep1', { replicas: 3 });
    });

    it('increments pod replicas when parent is a ReplicaSet', () => {
      const parentRS: Node = { id: 'rs1', type: 'ReplicaSet', position: { x: 0, y: 0 }, data: { replicas: 1 } };
      const selectedPod: Node = { id: 'pod1', type: 'Pod', parentId: 'rs1', selected: true, position: { x: 10, y: 10 }, data: { label: 'worker' } };

      const updateNodeData = vi.fn();
      useFlowStore.setState({
        nodes: [parentRS, selectedPod],
        updateNodeData,
        clipboard: {
          nodes: [{ id: 'pod1', type: 'Pod', position: { x: 10, y: 10 }, data: { label: 'worker' } } as Node],
          edges: [],
        },
      });

      useFlowStore.getState().pasteNodes();

      expect(updateNodeData).toHaveBeenCalledWith('rs1', { replicas: 2 });
    });

    it('increments pod replicas for pod with parent that is not a controller (e.g. Namespace)', () => {
      const parentNs: Node = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
      const selectedPod: Node = { id: 'pod1', type: 'Pod', parentId: 'ns1', selected: true, position: { x: 10, y: 10 }, data: { label: 'worker' } };

      const updateNodeData = vi.fn();
      useFlowStore.setState({
        nodes: [parentNs, selectedPod],
        updateNodeData,
        clipboard: {
          nodes: [{ id: 'pod1', type: 'Pod', position: { x: 10, y: 10 }, data: { label: 'worker' } } as Node],
          edges: [],
        },
      });

      useFlowStore.getState().pasteNodes();

      expect(updateNodeData).toHaveBeenCalledWith('pod1', { replicas: 2 });
    });

    it('increments pod replicas for standalone selected pod with fallback default 1 replica when targetNode has no replicas prop', () => {
      const selectedPod: Node = { id: 'pod1', type: 'Pod', selected: true, position: { x: 10, y: 10 }, data: { label: 'worker' } };

      const updateNodeData = vi.fn();
      useFlowStore.setState({
        nodes: [selectedPod],
        updateNodeData,
        clipboard: {
          nodes: [{ id: 'pod1', type: 'Pod', position: { x: 10, y: 10 }, data: { label: 'worker' } } as Node],
          edges: [],
        },
      });

      useFlowStore.getState().pasteNodes();

      expect(updateNodeData).toHaveBeenCalledWith('pod1', { replicas: 2 });
    });

    it('does not increment replicas when tryIncrementPodReplicas selectedPod does not match clipboardPod or target node is missing', () => {
      const selectedPod: Node = { id: 'pod1', type: 'Pod', selected: true, position: { x: 10, y: 10 }, data: { label: 'worker-1' } };
      const clipboardPod: Node = { id: 'pod2', type: 'Pod', position: { x: 10, y: 10 }, data: { label: 'worker-2' } };

      const updateNodeData = vi.fn();
      useFlowStore.setState({
        nodes: [selectedPod],
        updateNodeData,
        clipboard: {
          nodes: [clipboardPod],
          edges: [],
        },
      });

      useFlowStore.getState().pasteNodes();

      expect(updateNodeData).not.toHaveBeenCalled();
      expect(useFlowStore.getState().nodes.length).toBeGreaterThan(1);
    });

    it('pastes new nodes and edges, resetting pod replicas to 1 and setting selection', () => {
      const existingNode: Node = { id: 'n1', selected: true, position: { x: 0, y: 0 }, data: {} };
      const clipboardPod: Node = { id: 'p1', type: 'Pod', position: { x: 10, y: 10 }, data: { label: 'web', replicas: 5 } };
      const clipboardEdge: Edge = { id: 'e1', source: 'p1', target: 'other' };

      useFlowStore.setState({
        nodes: [existingNode],
        edges: [],
        clipboard: {
          nodes: [clipboardPod],
          edges: [clipboardEdge],
        },
      });

      useFlowStore.getState().pasteNodes();

      const state = useFlowStore.getState();
      expect(state.nodes).toHaveLength(2);

      // Existing node unselected
      expect(state.nodes.find((n) => n.id === 'n1')?.selected).toBe(false);

      // Pasted pod selected with replicas reset to 1
      const pastedPod = state.nodes.find((n) => n.id !== 'n1');
      expect(pastedPod?.selected).toBe(true);
      expect(pastedPod?.data.replicas).toBe(1);
      expect(pastedPod?.position).toEqual({ x: 50, y: 50 });

      expect(state.edges).toHaveLength(1);
      expect(state.lastActionName).toBe('Paste Elements');
    });
  });
});
