import { StateCreator } from 'zustand';
import { Node } from '@xyflow/react';
import { FlowState } from '../types';
import { K8sResourceType } from '../../types';

// Import modular handlers
import { nodeActions } from './node-handlers/nodeActions';
import { dragHandlers } from './node-handlers/dragHandlers';
import { resizeHandlers } from './node-handlers/resizeHandlers';
import { clipboardHandlers } from './node-handlers/clipboardHandlers';

export interface NodeSlice {
  addNode: (type: K8sResourceType, position?: { x: number, y: number }, parentId?: string) => void;
  deleteNodes: (nodesToDelete: Node[]) => void;
  updateNodeData: (nodeId: string, newData: any) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onNodeDragStart: (event: any, node: Node) => void;
  onNodeDrag: (event: any, node: Node) => void;
  onNodeDragStop: (event: any, node: Node) => void;
  onNodeResize: (event: any, node: Node) => void; 
  onNodeResizeStop: (event: any, node: Node) => void;
  copyNodes: () => void;
  pasteNodes: () => void;
}

export const createNodeSlice: StateCreator<FlowState, [], [], NodeSlice> = (set, get) => {
  // Initialize handlers with set/get
  const actions = nodeActions(set, get);
  const drag = dragHandlers(set, get);
  const resize = resizeHandlers(set, get);
  const clipboard = clipboardHandlers(set, get);

  return {
    clipboard: null,
    ...actions,
    ...drag,
    ...resize,
    ...clipboard,
  };
};
