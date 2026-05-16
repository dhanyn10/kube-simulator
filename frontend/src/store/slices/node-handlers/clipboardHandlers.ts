import { Node } from '@xyflow/react';
import { sortNodes, getNodeData } from '../../helpers';
import { hydrateNodes } from '../../nodeHelpers';
import { FlowState } from '../../types';
import { randomId } from '../../../lib/utils';

const tryIncrementPodReplicas = (nodes: Node[], clipboardNodes: Node[], updateNodeData: any): boolean => {
  const clipboardPod = clipboardNodes.find((n: Node) => n.type === 'Pod');
  const selectedPod = nodes.find(n => n.selected && n.type === 'Pod');
  if (!clipboardPod || !selectedPod) return false;

  const isMatch = selectedPod.id === clipboardPod.id || selectedPod.data?.label === clipboardPod.data?.label;
  if (!isMatch) return false;

  const parent = nodes.find(n => n.id === selectedPod.parentId);
  const isController = parent && (parent.type === 'Deployment' || parent.type === 'PodGroup');
  const targetId = isController ? selectedPod.parentId! : selectedPod.id;
  const targetNode = nodes.find(n => n.id === targetId);

  if (!targetNode) return false;

  const currentReplicas = getNodeData(targetNode).replicas || (targetNode.type === 'Pod' ? 1 : 0);
  updateNodeData(targetId, { replicas: currentReplicas + 1 });
  return true;
};

export const clipboardHandlers = (set: any, get: () => FlowState) => ({
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
