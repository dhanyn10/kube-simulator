import React from 'react';
import { K8sResourceType } from '@/types';
import { useFlowStore } from '@/store';

/** Color and border style mapping per Kubernetes resource type in sidebar cards. */
export const ITEM_STYLES: Record<string, { border: string; text: string }> = {
  Deployment: { border: 'border-l-violet-500 hover:border-violet-500', text: 'text-violet-400' },
  Pod: { border: 'border-l-cyan-500 hover:border-cyan-500', text: 'text-cyan-400' },
  Service: { border: 'border-l-amber-500 hover:border-amber-500', text: 'text-amber-400' },
  Ingress: { border: 'border-l-rose-500 hover:border-rose-500', text: 'text-rose-400' },
  HPA: { border: 'border-l-fuchsia-500 hover:border-fuchsia-500', text: 'text-fuchsia-400' },
  ResourceLimit: { border: 'border-l-purple-500 hover:border-purple-500', text: 'text-purple-400' },
  Internet: { border: 'border-l-blue-500 hover:border-blue-500', text: 'text-blue-400' },
  PVC: { border: 'border-l-orange-500 hover:border-orange-500', text: 'text-orange-400' },
  Namespace: { border: 'border-l-emerald-500 hover:border-emerald-500', text: 'text-emerald-400' },
  ConfigMap: { border: 'border-l-teal-500 hover:border-teal-500', text: 'text-teal-400' },
  Secret: { border: 'border-l-rose-400 hover:border-rose-400', text: 'text-rose-400' },
  Role: { border: 'border-l-indigo-500 hover:border-indigo-500', text: 'text-indigo-400' },
  IAM: { border: 'border-l-emerald-400 hover:border-emerald-400', text: 'text-emerald-400' }
};

/** Definition interface for sidebar accordion section categories. */
export interface SidebarSectionDef {
  id: string;
  title: string;
  filter: (type: string) => boolean;
}

/** Predefined category sections displayed in the left sidebar accordion. */
export const SIDEBAR_SECTIONS: SidebarSectionDef[] = [
  { id: 'useful-resources', title: 'Useful Resources', filter: (type: string) => type === 'IAM' },
  { id: 'workloads', title: 'Workloads', filter: (type: string) => type === 'Deployment' || type === 'Pod' },
  { id: 'networking', title: 'Networking', filter: (type: string) => type === 'Service' || type === 'Namespace' || type === 'Ingress' },
  { id: 'security', title: 'Security & Access', filter: (type: string) => type === 'Role' },
  { id: 'configuration', title: 'Configuration', filter: (type: string) => type === 'ConfigMap' || type === 'Secret' },
  { id: 'scaling', title: 'Scaling', filter: (type: string) => type === 'HPA' || type === 'ResourceLimit' },
  { id: 'others', title: 'Others', filter: (type: string) => type === 'Internet' || type === 'PVC' }
];

/**
 * Toggles expanded section accordion states for sidebar navigation.
 * Ensures single-section expansion or section collapse.
 *
 * @param currentExpanded Record of section IDs mapped to boolean expansion flags.
 * @param targetSection Section ID to toggle.
 * @returns Updated accordion expansion state object.
 */
export function toggleSidebarAccordionSection(
  currentExpanded: Record<string, boolean>,
  targetSection: string
): Record<string, boolean> {
  const isCurrentlyExpanded = currentExpanded[targetSection];
  const newState = {
    'useful-resources': false,
    workloads: false,
    networking: false,
    configuration: false,
    scaling: false,
    others: false
  };
  newState[targetSection as keyof typeof newState] = !isCurrentlyExpanded;
  return newState;
}

/**
 * Filters sidebar items by search query string matching card labels.
 *
 * @param items List of sidebar resource items.
 * @param searchTerm Search input query string.
 * @returns Filtered list of resource items matching query.
 */
export function filterSidebarItems<T extends { label: string }>(items: T[], searchTerm: string): T[] {
  const trimmed = searchTerm.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) => item.label.toLowerCase().includes(trimmed));
}

/**
 * Handles adding a resource node or opening modal configurations from the sidebar.
 * Special cases:
 * - 'IAM': Opens Kube IAM User management modal.
 * - 'Role': Evaluates active selection or configuring node to attach a Role, or logs a warning.
 * - Standard nodes: Delegates to `onAddNode` canvas placer.
 *
 * @param type The K8s resource type clicked in sidebar.
 * @param onAddNode Callback placing standard resource node onto canvas.
 * @param context Store context references including nodes, configuring state, and log handlers.
 */
export function executeSidebarAddNode(
  type: K8sResourceType,
  onAddNode: (type: K8sResourceType) => void,
  context: {
    nodes: any[];
    configuringNodeId: string | null;
    setKubeIamModalOpen: (open: boolean) => void;
    setRoleModalTargetNode: (target: { id: string; label: string } | null) => void;
    addLog: (type: 'info' | 'warn' | 'error', msg: string, category?: string) => void;
  }
): void {
  if (type === 'IAM') {
    context.setKubeIamModalOpen(true);
    return;
  }

  if (type === 'Role') {
    const targetNode = context.nodes.find((n) => n.selected || n.id === context.configuringNodeId);
    if (targetNode) {
      context.setRoleModalTargetNode({ id: targetNode.id, label: targetNode.data?.label || targetNode.id });
    } else {
      context.addLog(
        'warn',
        "[Sidebar Action] 'Role' is an attached resource. Drag it onto a target card (e.g. Pod, Deployment, Service) or select a card first.",
        'UI'
      );
    }
    return;
  }

  onAddNode(type);
}

/**
 * Initiates drag data payload when dragging a sidebar item onto canvas.
 *
 * @param event Drag event instance.
 * @param nodeType K8s resource type being dragged.
 * @param setDraggingSidebarItem State setter updating active dragging sidebar item.
 */
export function handleSidebarDragStart(
  event: React.DragEvent,
  nodeType: K8sResourceType,
  setDraggingSidebarItem: (item: string | null) => void
): void {
  event.dataTransfer.setData('application/reactflow', nodeType);
  event.dataTransfer.effectAllowed = 'move';
  setDraggingSidebarItem(nodeType);
}

/**
 * Clears dragging state and resets node hover states on drag completion.
 *
 * @param setDraggingSidebarItem State setter clearing active dragging sidebar item.
 */
export function handleSidebarDragEnd(setDraggingSidebarItem: (item: string | null) => void): void {
  setDraggingSidebarItem(null);
  useFlowStore.setState((state) => ({
    nodes: state.nodes.map((n) => (n.data?.isHovered ? { ...n, data: { ...n.data, isHovered: false } } : n)),
  }));
}
