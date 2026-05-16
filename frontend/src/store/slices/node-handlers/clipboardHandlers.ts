import { Node } from '@xyflow/react';
import { sortNodes, getNodeData } from '../../helpers';
import { hydrateNodes } from '../../nodeHelpers';
import { FlowState } from '../../types';
import { randomId } from '../../../lib/utils';

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

    // Use a safer cloning method that handles functions/handlers
    const nodesToCopy = nodes.filter(n => nodeIdsToCopy.has(n.id)).map(n => ({
      ...n,
      data: { ...n.data } // Shallow copy data to preserve top-level properties
    }));
    
    const edgesToCopy = edges.filter(e => nodeIdsToCopy.has(e.source) && nodeIdsToCopy.has(e.target)).map(e => ({
      ...e
    }));

    set({ clipboard: { nodes: nodesToCopy, edges: edgesToCopy } });
  },

  pasteNodes: () => {
    const { clipboard, nodes } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;

    // USER LOGIC: If a Pod is SELECTED and matches the clipboard, increment its replicas
    const clipboardPod = clipboard.nodes.find((n: Node) => n.type === 'Pod');
    const selectedPod = nodes.find(n => n.selected && n.type === 'Pod');

    if (clipboardPod && selectedPod) {
      const isSameLabel = selectedPod.data?.label === clipboardPod.data?.label;
      const isSameId = selectedPod.id === clipboardPod.id;

      if (isSameId || isSameLabel) {
        // Find if this pod has a controller parent (Deployment/PodGroup)
        const parent = nodes.find(n => n.id === selectedPod.parentId);
        const isController = parent && (parent.type === 'Deployment' || parent.type === 'PodGroup');
        
        // Target ID for replica update: either the parent controller or the pod itself
        const targetId = isController ? selectedPod.parentId! : selectedPod.id;
        const targetNode = nodes.find(n => n.id === targetId);
        
        if (targetNode) {
          const currentReplicas = getNodeData(targetNode).replicas || (targetNode.type === 'Pod' ? 1 : 0);
          // Call updateNodeData via get() to ensure absolute synchronization
          get().updateNodeData(targetId, { replicas: currentReplicas + 1 });
          return;
        }
      }
    }

    // Fallback: Standard copy-paste logic (creating new nodes)
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
