/**
 * Hook for BaseNode status, container styles, properties computation,
 * stacked pod label masking (`basename-podHash-*****`), and replica segment hover indexing.
 */

import { useFlowStore } from '@/store';
import { useNodeStyles } from '@/hooks/useNodeStyles';
import { useNodeRename } from '@/hooks/useNodeEditor';
import { useNodeStatus, useNodeContainerStyles, getNodeBorderColorHex } from '@/hooks/useNodeStatusStyles';
import { K8sNodeData } from '@/types';

/**
 * Extracts base application name for Pod resource cards.
 *
 * @param data - Kubernetes node data object.
 * @returns Clean base name string for editing and display.
 */
export const extractPodBaseName = (data: K8sNodeData): string => {
  if (data.type !== 'Pod') return data.baseName || data.label || 'pod';
  if (data.baseName) return data.baseName;

  const hash = data.podHash;
  const suf = data.replicaSuffix;
  const label = data.label;

  if (hash && suf && label?.endsWith(`-${hash}-${suf}`)) {
    return label.slice(0, -(hash.length + suf.length + 2));
  }
  if (hash && label?.endsWith(`-${hash}`)) {
    return label.slice(0, -(hash.length + 1));
  }
  return data.label || 'pod';
};

/**
 * Evaluates whether a canvas node is targeted by terminal autocomplete hover,
 * and determines the exact pod replica index targeted for segment highlighting.
 *
 * @param id - Canvas node ID.
 * @param data - Kubernetes node data object.
 * @param hoveredName - Currently hovered autocomplete pod name string from store.
 * @returns Object containing boolean hover flag and target pod index.
 */
export const evaluateAutocompleteHover = (
  id: string,
  data: K8sNodeData,
  hoveredName: string | null
): { isAutocompleteHovered: boolean; hoveredPodIndex: number | null } => {
  if (!hoveredName) {
    return { isAutocompleteHovered: false, hoveredPodIndex: null };
  }

  if (data.label === hoveredName || id === hoveredName) {
    return { isAutocompleteHovered: true, hoveredPodIndex: 0 };
  }

  if (data.type === 'Pod' && data.podHash && hoveredName.includes(`-${data.podHash}`)) {
    if (Array.isArray(data.replicaSuffixes) && data.replicaSuffixes.length > 0) {
      const idx = data.replicaSuffixes.findIndex((suf: string) =>
        hoveredName.endsWith(`-${suf}`) || hoveredName.includes(`-${data.podHash}-${suf}`)
      );
      if (idx !== -1) {
        return { isAutocompleteHovered: true, hoveredPodIndex: idx };
      }
    } else if (
      data.replicaSuffix &&
      (hoveredName.endsWith(`-${data.replicaSuffix}`) ||
       hoveredName.includes(`-${data.podHash}-${data.replicaSuffix}`))
    ) {
      return { isAutocompleteHovered: true, hoveredPodIndex: 0 };
    }
  }

  return { isAutocompleteHovered: false, hoveredPodIndex: null };
};

/**
 * Formats display label for canvas card rendering, masking stacked pod replicas as `basename-podHash-*****`.
 *
 * @param data - Kubernetes node data object.
 * @param podBaseName - Extracted base pod name string.
 * @param isStackedPod - Flag indicating if pod card represents stacked replicas (> 3).
 * @returns Formatted label string for card header rendering.
 */
export const formatDisplayLabel = (data: K8sNodeData, podBaseName: string, isStackedPod: boolean): string => {
  if (!isStackedPod) return data.label;
  return data.podHash ? `${podBaseName}-${data.podHash}-*****` : `${podBaseName}-*****`;
};

/**
 * Custom hook encapsulating business logic, status styles, display label formatting,
 * and autocomplete hover targeting for BaseNode canvas cards.
 *
 * @param params - Object containing node ID, data, selection state, color theme, and optional status override.
 * @returns Evaluated node styles, edit state, replica count, display label, and hovered pod index.
 */
export const useBaseNodeHandler = ({
  id,
  data,
  selected,
  color,
  statusOverride
}: {
  id: string;
  data: K8sNodeData;
  selected?: boolean;
  color: string;
  statusOverride?: 'pending' | 'ready' | 'crashing';
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const draggingSidebarItem = useFlowStore((state) => state.draggingSidebarItem);
  const nodes = useFlowStore((state) => state.nodes);
  const hoveredAutocompletePodName = useFlowStore((state) => state.hoveredAutocompletePodName);

  const podBaseName = extractPodBaseName(data);
  const { isAutocompleteHovered, hoveredPodIndex } = evaluateAutocompleteHover(id, data, hoveredAutocompletePodName);

  const { transitionClasses } = useNodeStyles(id);

  const { isEditing, setIsEditing, editValue, setEditValue, inputRef, handleRename, onKeyDown } =
    useNodeRename(podBaseName, data.onRename);

  const isRoleDragging = draggingSidebarItem === 'Role' || draggingSidebarItem === 'ConfigMap' || draggingSidebarItem === 'HPA';
  const currentNode = nodes.find((n) => n.id === id);
  const parentNode = currentNode?.parentId ? nodes.find((n) => n.id === currentNode.parentId) : null;
  const isInsideNamespace = currentNode?.parentId
    ? (parentNode?.type === 'Namespace' || nodes.find((p) => p.id === parentNode?.parentId)?.type === 'Namespace')
    : false;

  const { isPending, isReady, isCrashing, statusIconColor, statusTextColor, statusDotColor } =
    useNodeStatus(data, statusOverride, color, colorMode);

  const borderColorHex = getNodeBorderColorHex(isPending, isReady, isCrashing, color);

  const { containerClasses, progressEmptyBgClass } =
    useNodeContainerStyles({
      selected,
      isReady,
      isPending,
      isCrashing,
      color,
      colorMode,
      isRoleDragging,
      nodeType: data.type,
      isInsideNamespace,
      isHovered: data.isHovered,
      isAutocompleteHovered,
      borderColorHex
    });

  const replicas = data.replicas || 1;
  const parentReplicas = data.parentReplicas || 0;
  const showDashedProgress = data.type === 'Pod' && (parentReplicas > 3 || (replicas > 1 && !data.parentId));
  const isStackedPod = data.type === 'Pod' && (parentReplicas > 3 || (replicas > 3 && !data.parentId));
  const displayLabel = formatDisplayLabel(data, podBaseName, isStackedPod);

  return {
    colorMode,
    transitionClasses,
    isEditing,
    setIsEditing,
    editValue,
    setEditValue,
    inputRef,
    handleRename,
    onKeyDown,
    isPending,
    isReady,
    isCrashing,
    statusIconColor,
    statusTextColor,
    statusDotColor,
    containerClasses,
    progressEmptyBgClass,
    replicas,
    showDashedProgress,
    isAutocompleteHovered,
    hoveredPodIndex,
    borderColorHex,
    displayLabel,
  };
};
