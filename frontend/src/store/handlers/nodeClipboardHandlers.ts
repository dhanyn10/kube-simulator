import { Node } from '@xyflow/react';
import { sortNodes, getNodeData, getAbsPos } from '@/store/helpers';
import { hydrateNodes } from '@/store/nodeHelpers';
import { ensureUniqueResourceName } from '@/store/handlers/nodeUtils';
import { syncPvcRealtimeState } from '@/activities/config/pvcConfigHelpers';
import type { FlowState } from '@/store/types';
import { randomId, safeRandom } from '@/lib/utils';

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
  const isController = parent && (parent.type === 'Deployment' || parent.type === 'StatefulSet' || parent.type === 'ReplicaSet');
  const targetId = isController ? selectedPod.parentId! : selectedPod.id;
  const targetNode = nodes.find(n => n.id === targetId);

  if (!targetNode) return false;

  const currentReplicas = getNodeData(targetNode).replicas || (targetNode.type === 'Pod' ? 1 : 0);
  updateNodeData(targetId, { replicas: currentReplicas + 1 });
  return true;
};

const collectDescendantNodeIds = (parentIds: Set<string>, allNodes: Node[]): Set<string> => {
  const result = new Set<string>(parentIds);
  let currentLevelParents = Array.from(parentIds);

  while (currentLevelParents.length > 0) {
    const nextLevelParents: string[] = [];
    for (const node of allNodes) {
      if (node.parentId && currentLevelParents.includes(node.parentId) && !result.has(node.id)) {
        result.add(node.id);
        nextLevelParents.push(node.id);
      }
    }
    currentLevelParents = nextLevelParents;
  }

  return result;
};

interface ClipboardRemapContext {
  idMap: Record<string, string>;
  groupIdMap: Map<string, string>;
}

const buildClipboardRemapContext = (clipboardNodes: Node[]): ClipboardRemapContext => {
  const idMap: Record<string, string> = {};
  const groupIdMap = new Map<string, string>();

  clipboardNodes.forEach((n) => {
    idMap[n.id] = randomId(n.type?.toLowerCase());
    const gid = typeof n.data?.groupId === 'string' ? n.data.groupId : undefined;
    if (gid && !groupIdMap.has(gid)) {
      groupIdMap.set(gid, `group-${safeRandom().toString(36).slice(2, 9)}`);
    }
  });

  return { idMap, groupIdMap };
};

const calculatePastedPosition = (
  node: Node,
  isParentCopied: boolean,
  offset: number,
  canvasNodes: Node[]
): { x: number; y: number } => {
  if (isParentCopied) {
    return { ...(node.position || { x: 0, y: 0 }) };
  }
  if (node.parentId) {
    const absPos = getAbsPos(node.id, canvasNodes, node);
    return { x: absPos.x + offset, y: absPos.y + offset };
  }
  return { x: (node.position?.x || 0) + offset, y: (node.position?.y || 0) + offset };
};

const createPastedNodeInstance = (
  node: Node,
  ctx: ClipboardRemapContext,
  offset: number,
  canvasNodes: Node[]
): Node => {
  const newId = ctx.idMap[node.id];
  const isParentCopied = Boolean(node.parentId && ctx.idMap[node.parentId]);
  const newParentId = isParentCopied ? ctx.idMap[node.parentId!] : undefined;
  const newPosition = calculatePastedPosition(node, isParentCopied, offset, canvasNodes);
  const existingGroupId = typeof node.data?.groupId === 'string' ? node.data.groupId : undefined;
  const newGroupId = existingGroupId ? ctx.groupIdMap.get(existingGroupId) : undefined;

  const newNode: Node = {
    ...node,
    id: newId,
    parentId: newParentId,
    extent: newParentId ? ('parent' as const) : undefined,
    position: newPosition,
    selected: true,
    data: {
      ...node.data,
      parentId: newParentId,
      groupId: newGroupId,
    },
  };

  if (node.type === 'Pod' && !newParentId && newNode.data) {
    newNode.data = { ...newNode.data, replicas: 1 };
  }

  return newNode;
};

const ensureUniquePastedNodeLabels = (pastedNodes: Node[], existingNodes: Node[]) => {
  pastedNodes.forEach((node) => {
    const label = typeof node.data?.label === 'string' ? node.data.label : '';
    if (!node.parentId && label) {
      const uniqueLabel = ensureUniqueResourceName(
        label,
        node.type || '',
        node.parentId,
        [...existingNodes, ...pastedNodes],
        node.id
      );
      node.data.label = uniqueLabel;
      if (node.data.baseName) {
        node.data.baseName = uniqueLabel;
      }
    }
  });
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
   * If a Deployment or container is selected, all child pods inside it are automatically included.
   */
  copyNodes: () => {
    const { nodes, edges } = get();
    const selectedNodes = nodes.filter(n => n.selected);
    
    if (selectedNodes.length === 0) return;

    const selectedIds = new Set(selectedNodes.map(n => n.id));
    const nodeIdsToCopy = collectDescendantNodeIds(selectedIds, nodes);

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
   * Generates new unique IDs, maps edge source/target IDs, remaps parent/child relationships,
   * assigns unique resource names, and selects newly pasted nodes.
   */
  pasteNodes: () => {
    const { clipboard, nodes, updateNodeData, validateEdge } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;

    if (tryIncrementPodReplicas(nodes, clipboard.nodes, updateNodeData)) return;

    const remapCtx = buildClipboardRemapContext(clipboard.nodes);
    const offset = 40;

    const pastedNodes = clipboard.nodes.map((n: Node) =>
      createPastedNodeInstance(n, remapCtx, offset, nodes)
    );

    ensureUniquePastedNodeLabels(pastedNodes, nodes);

    const pastedEdges = clipboard.edges.map((e: any) => {
      const mappedEdge = {
        ...e,
        id: randomId('edge'),
        source: remapCtx.idMap[e.source] || e.source,
        target: remapCtx.idMap[e.target] || e.target,
        selected: true,
      };
      return validateEdge ? validateEdge(mappedEdge) : mappedEdge;
    });

    const hydratedPastedNodes = hydrateNodes(pastedNodes, get);
    const combinedNodes = sortNodes([...nodes.map(n => ({ ...n, selected: false })), ...hydratedPastedNodes]);
    const combinedEdges = [...get().edges.map(e => ({ ...e, selected: false })), ...pastedEdges];
    const { nodes: syncedNodes, edges: syncedEdges } = syncPvcRealtimeState(combinedNodes, combinedEdges);

    set({
      nodes: syncedNodes,
      edges: syncedEdges,
      lastActionId: `paste-${Date.now()}`,
      lastActionName: 'Paste Elements'
    });
  },
});
