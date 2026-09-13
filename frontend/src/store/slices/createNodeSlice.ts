import { StateCreator } from 'zustand';
import { FlowState } from '../types';

// Import modular handlers
import { nodeActions } from './node-handlers/nodeActions';
import { dragHandlers } from './node-handlers/dragHandlers';
import { resizeHandlers } from './node-handlers/resizeHandlers';
import { clipboardHandlers } from './node-handlers/clipboardHandlers';

export type NodeSlice = Pick<
  FlowState,
  | 'addNode'
  | 'deleteNodes'
  | 'updateNodeData'
  | 'onNodeClick'
  | 'onPaneClick'
  | 'onNodeDragStart'
  | 'onNodeDrag'
  | 'onNodeDragStop'
  | 'onNodeResize'
  | 'onNodeResizeStop'
  | 'copyNodes'
  | 'pasteNodes'
  | 'groupNodes'
  | 'ungroupNodes'
>;

export const createNodeSlice: StateCreator<FlowState, [], [], NodeSlice> = (set, get) => {
  // Initialize handlers with set/get
  const actions = nodeActions(set, get);
  const drag = dragHandlers(set, get);
  const resize = resizeHandlers(set, get);
  const clipboard = clipboardHandlers(set, get);

  return {
    ...actions,
    ...drag,
    ...resize,
    ...clipboard,
  };
};
