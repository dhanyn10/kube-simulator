import { Node } from '@xyflow/react';
import { getNodeData, sortNodes } from '../../helpers';

export const clipboardHandlers = (set: any, get: any) => ({
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

    set({ clipboard: { nodes: JSON.parse(JSON.stringify(nodesToCopy)), edges: JSON.parse(JSON.stringify(edgesToCopy)) } });
  },

  pasteNodes: () => {
    const { clipboard, nodes, edges } = get();
    if (!clipboard) return;

    if (clipboard.nodes.length === 1 && clipboard.nodes[0].type === 'Pod') {
      const pastedPod = clipboard.nodes[0];
      const targetPod = nodes.find(n =>
        n.type === 'Pod' &&
        n.parentId === pastedPod.parentId &&
        (pastedPod.parentId ? true : (Math.abs(n.position.x - pastedPod.position.x) < 50 && Math.abs(n.position.y - pastedPod.position.y) < 50))
      );

      if (targetPod) {
        const delta = 1;
        
        if (targetPod.parentId) {
          const parent = nodes.find(n => n.id === targetPod.parentId);
          if (parent) {
            get().updateNodeData(parent.id, { replicas: (getNodeData(parent).replicas || 0) + delta });
            return;
          }
        } else {
          get().updateNodeData(targetPod.id, { replicas: (getNodeData(targetPod).replicas || 1) + delta });
          return;
        }
      }
    }

    const idMap: Record<string, string> = {};
    const offset = 40;
    const clipboardSourceIds = new Set(clipboard.nodes.map((n: Node) => n.id));

    const updatedExistingNodes = [...nodes];
    const pastedNodes = clipboard.nodes.map((n: Node) => {
      const newId = `${n.type?.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
      idMap[n.id] = newId;

      const newData = { ...n.data };
      if (n.type === 'Pod') {
        newData.replicas = 1;
      }

      return {
        ...n,
        id: newId,
        data: newData,
        position: { x: n.position.x + offset, y: n.position.y + offset },
        selected: true,
      };
    });

    const pastedEdges = clipboard.edges.map((e: any) => ({
      ...e,
      id: `edge-${Math.random().toString(36).substr(2, 9)}`,
      source: idMap[e.source] || e.source,
      target: idMap[e.target] || e.target,
      selected: true,
    }));

    set({
      nodes: sortNodes([...updatedExistingNodes.map(n => ({ ...n, selected: false })), ...pastedNodes]),
      edges: [...edges.map(e => ({ ...e, selected: false })), ...pastedEdges],
      lastActionId: `paste-${Date.now()}`,
      lastActionName: 'Paste Elements'
    });
  },
});
