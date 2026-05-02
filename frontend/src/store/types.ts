import {
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import { K8sResourceType } from '../types';

export interface AlignmentGuide {
  position: number;
}

export interface SnapGuide {
  position: number;
  isActive: boolean;
}

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
  activeDeploymentId: string | null;
  hoveredDeploymentId: string | null;
  detachingDeploymentId: string | null;
  configuringNodeId: string | null;
  configuringEdgeId: string | null;
  draggingSidebarItem: K8sResourceType | null;
  colorMode: 'dark' | 'light';
  clipboard: { nodes: Node[], edges: Edge[] } | null;
  alignmentGuides: {
    vertical: AlignmentGuide[];
    horizontal: AlignmentGuide[];
  };
  snapGuides: {
    vertical: SnapGuide[];
    horizontal: SnapGuide[];
  };
  draggedNodeId: string | null;
  lastActionId: string;
  lastActionName: string;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  setActiveDeploymentId: (id: string | null) => void;
  setHoveredDeploymentId: (id: string | null) => void;
  setDetachingDeploymentId: (id: string | null) => void;
  setConfiguringNodeId: (id: string | null) => void;
  setConfiguringEdgeId: (id: string | null) => void;
  setAlignmentGuides: (guides: { vertical: AlignmentGuide[], horizontal: AlignmentGuide[] }) => void;
  clearAlignmentGuides: () => void;
  setSnapGuides: (guides: { vertical: SnapGuide[], horizontal: SnapGuide[] }) => void;
  clearSnapGuides: () => void;
  setDraggedNodeId: (id: string | null) => void;

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
  onQuickConnect: (nodeId: string, direction: 'top' | 'bottom' | 'left' | 'right') => void;
  copyNodes: () => void;
  pasteNodes: () => void;
  toggleColorMode: () => void;
}
