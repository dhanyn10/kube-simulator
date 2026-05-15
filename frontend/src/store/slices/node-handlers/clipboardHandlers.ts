import { Node } from '@xyflow/react';
import { getNodeData, sortNodes } from '../../helpers';
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

    const nodesToCopy = nodes.filter(n => nodeIdsToCopy.has(n.id));
    const edgesToCopy = edges.filter(e => nodeIdsToCopy.has(e.source) && nodeIdsToCopy.has(e.target));

    set({ clipboard: { nodes: structuredClone(nodesToCopy), edges: structuredClone(edgesToCopy) } });
  },

  pasteNodes: () => {
    const { clipboard, nodes, edges } = get();
    if (!clipboard) return;

    if (clipboard.nodes.length === 1 && clipboard.nodes[0].type === 'Pod') {
      const pastedPod = clipboard.nodes[0];
      const pastedLabel = pastedPod.data.label;
      
      // 1. Try to find a logical match by Label and Context
      const target = nodes.find(n => {
        // Match if it's the exact same Pod
        if (n.id === pastedPod.id) return true;
        
        // Match if it's a Pod with the same label in the same parent context
        if (n.type === 'Pod' && n.data.label === pastedLabel && n.parentId === pastedPod.parentId) return true;
        
        // Match PodGroup that was created from this Pod (it will have the same label)
        if (n.type === 'PodGroup' && n.data.label === pastedLabel && (!pastedPod.parentId || n.id === pastedPod.parentId)) return true;
        
        return false;
      });

        if (target) {
          const delta = 1;
          // Identify the parent container ID
          const parentId = (target.type === 'PodGroup' || target.type === 'Deployment') ? target.id : target.parentId;
          
          if (parentId) {
            const parent = nodes.find(n => n.id === parentId);
            const parentData = parent ? getNodeData(parent) : null;
            const currentTotal = parentData?.replicas || 0;
            get().updateNodeData(parentId, { replicas: currentTotal + delta });
          } else {
            // It's a standalone pod with no parent
            const targetData = getNodeData(target);
            const currentTotal = targetData.replicas || 1;
            get().updateNodeData(target.id, { replicas: currentTotal + delta });
          }
          return;
        }
    }

    const idMap: Record<string, string> = {};
    const offset = 40;

    const updatedExistingNodes = [...nodes];
    const pastedNodes = clipboard.nodes.map((n: Node) => {
      const newId = randomId(n.type?.toLowerCase());
      idMap[n.id] = newId;
      
      const newNode = {
        ...n,
        id: newId,
        position: { x: n.position.x + offset, y: n.position.y + offset },
        selected: true,
      };

      // Ensure pasted Pods always start with 1 replica, regardless of source count
      if (n.type === 'Pod' && newNode.data) {
        newNode.data = {
          ...newNode.data,
          replicas: 1
        };
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
      nodes: sortNodes([...updatedExistingNodes.map(n => ({ ...n, selected: false })), ...hydratedPastedNodes]),
      edges: [...edges.map(e => ({ ...e, selected: false })), ...pastedEdges],
      lastActionId: `paste-${Date.now()}`,
      lastActionName: 'Paste Elements'
    });
  },
});
