/**
 * Hook for BaseNode status, container styles, and properties computation.
 */

import { useFlowStore } from '@/store';
import { useNodeStyles } from '@/hooks/useNodeStyles';
import { useNodeRename } from '@/hooks/useNodeEditor';
import { useNodeStatus, useNodeContainerStyles, getNodeBorderColorHex } from '@/hooks/useNodeStatusStyles';
import { K8sNodeData } from '@/types';

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

  const isAutocompleteHovered = Boolean(
    hoveredAutocompletePodName &&
    (data.label === hoveredAutocompletePodName || id === hoveredAutocompletePodName)
  );

  const { transitionClasses } = useNodeStyles(id);

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
  const showDashedProgress = data.type === 'Pod' && ((data.parentReplicas || 0) > 3 || (replicas > 1 && !data.parentId));

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
    borderColorHex,
  };
};
