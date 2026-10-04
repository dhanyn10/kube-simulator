import { Node } from '@xyflow/react';
import { sortNodes, getNodeData } from '@/store/helpers';
import { hydrateNodes } from '@/store/nodeHelpers';
import type { FlowState } from '@/store/types';
import { randomId } from '@/lib/utils';

/**
 * Attempts to increment replica count when pasting a copied Pod over an existing matching Pod or Controller.
 *
 * @param nodes Current canvas nodes array
 * @param clipboardNodes Nodes currently stored in the clipboard
 * @param updateNodeData Store action to update node data properties
 * @returns True if replica count was successfully incremented, false otherwise
 */
const tryIncrementPodReplicas = (nodes: Node[], clipboardNodes: Node[], updateNodeData: any): boolean => {
  const clipboardPod = clipboardNodes.find((n: Node) => n.type === 'Pod');
  const selectedPod = nodes.find(n => n.selected && n.type === 'Pod');
  if (!clipboardPod || !selectedPod) return false;

  const isMatch = selectedPod.id === clipboardPod.id || selectedPod.data?.label === clipboardPod.data?.label;
  if (!isMatch) return false;

  const parent = nodes.find(n => n.id === selectedPod.parentId);
  const isController = parent && (parent.type === 'Deployment' || parent.type === 'ReplicaSet');
  const targetId = isController ? selectedPod.parentId! : selectedPod.id;
  const targetNode = nodes.find(n => n.id === targetId);

  if (!targetNode) return false;

  const currentReplicas = getNodeData(targetNode).replicas || (targetNode.type === 'Pod' ? 1 : 0);
  updateNodeData(targetId, { replicas: currentReplicas + 1 });
  return true;
};

/**
 * Higher-order store handler providing copy and paste operations for canvas nodes and edges.
 *
 * @param set Zustand store setter function
 * @param get Zustand store getter function returning current FlowState
 * @returns Object containing `copyNodes` and `pasteNodes` store actions
 */
export const clipboardHandlers = (set: any, get: () => FlowState) => ({
  /**
   * Copies all currently selected nodes and their connecting edges to the store clipboard.
   * If a Deployment is selected, all child pods inside it are automatically included.
   */
  copyNodes: () => {
    const { nodes, edges } = get();
    const selectedNodes = nodes.filter(n => n.selected);
    
    if (selectedNodes.length === 0) return;

    const nodeIdsToCopy = new Set(selectedNodes.map(n => n.id));
    selectedNodes.forEach(node => {
      if (node.type === 'Deployment') {
        nodes.filter(n => n.parentId === node.id).forEach(child => nodeIdsToCopy.add(child.id));
      }
    });

    const nodesToCopy = nodes.filter(n => nodeIdsToCopy.has(n.id)).map(n => ({
      ...n,
      data: { ...n.data }
    }));
    
    const edgesToCopy = edges.filter(e => nodeIdsToCopy.has(e.source) && nodeIdsToCopy.has(e.target)).map(e => ({
      ...e
    }));

    set({ clipboard: { nodes: nodesToCopy, edges: edgesToCopy } });
  },

  /**
   * Pastes elements from the store clipboard onto the canvas with an offset.
   * Generates new unique IDs, maps edge source/target IDs, and selects newly pasted nodes.
   */
  pasteNodes: () => {
    const { clipboard, nodes, updateNodeData } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;

    if (tryIncrementPodReplicas(nodes, clipboard.nodes, updateNodeData)) return;

    const idMap: Record<string, string> = {};
    const offset = 40;

    const pastedNodes = clipboard.nodes.map((n: Node) => {
      const newId = randomId(n.type?.toLowerCase());
      idMap[n.id] = newId;
      
      const newNode = {
        ...n,
        id: newId,
        position: { x: (n.position?.x || 0) + offset, y: (n.position?.y || 0) + offset },
        selected: true,
      };

      if (n.type === 'Pod' && newNode.data) {
        newNode.data = { ...newNode.data, replicas: 1 };
      }

      return newNode;
    });

    const pastedEdges = clipboard.edges.map((e: any) => ({
      ...e,
      id: randomId('edge'),
      source: idMap[e.source] || e.source,
      target: idMap[e.target] || e.target,
      selected: true,
    }));

    const hydratedPastedNodes = hydrateNodes(pastedNodes, get);

    set({
      nodes: sortNodes([...nodes.map(n => ({ ...n, selected: false })), ...hydratedPastedNodes]),
      edges: [...get().edges.map(e => ({ ...e, selected: false })), ...pastedEdges],
      lastActionId: `paste-${Date.now()}`,
      lastActionName: 'Paste Elements'
    });
  },
});
