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

  let podBaseName = data.baseName || data.label || 'pod';
  if (data.type === 'Pod') {
    if (data.baseName) {
      podBaseName = data.baseName;
    } else if (data.podHash && data.replicaSuffix && data.label?.endsWith(`-${data.podHash}-${data.replicaSuffix}`)) {
      podBaseName = data.label.slice(0, -(data.podHash.length + data.replicaSuffix.length + 2));
    } else if (data.podHash && data.label?.endsWith(`-${data.podHash}`)) {
      podBaseName = data.label.slice(0, -(data.podHash.length + 1));
    }
  }

  let hoveredPodIndex: number | null = null;
  let isAutocompleteHovered = false;

  if (hoveredAutocompletePodName) {
    if (data.label === hoveredAutocompletePodName || id === hoveredAutocompletePodName) {
      isAutocompleteHovered = true;
      hoveredPodIndex = 0;
    } else if (data.type === 'Pod' && data.podHash && hoveredAutocompletePodName.includes(`-${data.podHash}`)) {
      isAutocompleteHovered = true;
      if (data.replicaSuffixes && Array.isArray(data.replicaSuffixes)) {
        const idx = data.replicaSuffixes.findIndex((suf: string) =>
          hoveredAutocompletePodName.endsWith(`-${suf}`) ||
          hoveredAutocompletePodName.includes(`-${data.podHash}-${suf}`)
        );
        if (idx !== -1) {
          hoveredPodIndex = idx;
        }
      }
    }
  }

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

  let displayLabel = data.label;
  if (isStackedPod) {
    if (data.podHash) {
      displayLabel = `${podBaseName}-${data.podHash}-*****`;
    } else {
      displayLabel = `${podBaseName}-*****`;
    }
  }

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
