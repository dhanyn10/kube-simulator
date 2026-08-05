import {
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import { K8sResourceType, K8sNodeData } from '../types';

export type LogLevel = 'error' | 'warn' | 'fatal' | 'info';
export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
}

export interface AlignmentGuide {
  position: number;
}

export interface SnapGuide {
  position: number;
  isActive: boolean;
}

export interface SimulationMetricPoint {
  cpuPercent: number;
  memoryPercent: number;
  cpuValue: number;
  memoryValue: number;
  cpuLimit: number;
  memoryLimit: number;
  isThrottled: boolean;
  isOOM: boolean;
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
  globalEdgeColor: string;
  globalEdgeErrorColor: string;
  isAutosaveEnabled: boolean;
  isAutofocusEnabled: boolean;
  isSidebarVisible: boolean;
  isRightSidebarVisible: boolean;
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
  currentProject: { id: number, name: string } | null;
  lastSavedSnapshot: string | null;

  // Simulation state
  isSimulating: boolean;
  activeSimulationEdges: string[];
  simulationMetrics: Record<string, SimulationMetricPoint[]>;
  isMonitoringOpen: boolean;
  isMonitoringDetached: boolean;
  systemResources: { cpuCores: number, totalMemoryGB: number, freeMemoryGB: number, cpuUsage: number } | null;

  // Log state
  logs: LogEntry[];
  isLogToastVisible: boolean;
  isLogModalOpen: boolean;
  addLog: (level: LogLevel, message: string) => void;
  deleteLog: (id: string) => void;
  deleteLogs: (ids: string[]) => void;
  clearLogs: () => void;
  setLogToastVisible: (visible: boolean) => void;
  setLogModalOpen: (open: boolean) => void;

  visibleWidgets: string[];
  customImages: string[];
  canvasBgVariant: 'dots' | 'lines';
  canvasBgColor: string;
  canvasBgOpacity: number;

  addCustomImage: (image: string) => void;
  deleteCustomImage: (image: string) => void;
  setCanvasBgVariant: (variant: 'dots' | 'lines') => void;
  setCanvasBgColor: (color: string) => void;
  setCanvasBgOpacity: (opacity: number) => void;
  saveSettingsJson: () => void;
  loadSettingsJson: () => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  validateEdge: (edge: Edge) => Edge;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  setActiveDeploymentId: (id: string | null) => void;
  setHoveredDeploymentId: (id: string | null) => void;
  setDetachingDeploymentId: (id: string | null) => void;
  setConfiguringNodeId: (id: string | null) => void;
  setConfiguringEdgeId: (id: string | null) => void;
  toggleNodeSettings: (id: string) => void;
  toggleEdgeSettings: (id: string) => void;
  setAlignmentGuides: (guides: { vertical: AlignmentGuide[], horizontal: AlignmentGuide[] }) => void;
  clearAlignmentGuides: () => void;
  setSnapGuides: (guides: { vertical: SnapGuide[], horizontal: SnapGuide[] }) => void;
  clearSnapGuides: () => void;
  setDraggedNodeId: (id: string | null) => void;

  addNode: (type: K8sResourceType, position?: { x: number, y: number }, parentId?: string) => void;
  deleteNodes: (nodesToDelete: Node[]) => void;
  updateNodeData: (nodeId: string, newData: Partial<K8sNodeData>) => void;
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
  setGlobalEdgeColors: (color: string, errorColor: string) => void;
  setDraggingSidebarItem: (item: K8sResourceType | null) => void;
  toggleColorMode: () => void;
  toggleAutosave: () => void;
  toggleAutofocus: () => void;
  startSimulation: (internetNodeIds?: string[]) => void;
  stopSimulation: () => void;
  setMonitoringOpen: (open: boolean) => void;
  setMonitoringDetached: (detached: boolean) => void;
  setSidebarVisible: (visible: boolean) => void;
  setRightSidebarVisible: (visible: boolean) => void;
  groupNodes: (nodeIds: string[]) => void;
  ungroupNodes: (nodeIds: string[]) => void;
  autoLayout: (direction?: 'LR' | 'TB') => void;
  setSystemResources: (resources: { cpuCores: number, totalMemoryGB: number, freeMemoryGB: number, cpuUsage: number }) => void;
  toggleWidget: (widgetId: string) => void;
}
