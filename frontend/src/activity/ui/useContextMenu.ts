/**
 * Custom hook for ContextMenu state selectors and actions.
 */

import { useEffect, useRef } from 'react';
import { useFlowStore } from '../../store';

export const useContextMenuHandler = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const colorMode = useFlowStore((state: any) => state.colorMode);
  const toggleColorMode = useFlowStore((state: any) => state.toggleColorMode);
  const nodes = useFlowStore((state: any) => state.nodes);
  const clipboard = useFlowStore((state: any) => state.clipboard);
  const groupNodes = useFlowStore((state: any) => state.groupNodes);
  const ungroupNodes = useFlowStore((state: any) => state.ungroupNodes);
  const copyNodes = useFlowStore((state: any) => state.copyNodes);
  const pasteNodes = useFlowStore((state: any) => state.pasteNodes);

  const setTerminalOpen = useFlowStore((state: any) => state.setTerminalOpen);
  const setTerminalActiveTab = useFlowStore((state: any) => state.setTerminalActiveTab);
  const setTerminalSelectedResourceId = useFlowStore((state: any) => state.setTerminalSelectedResourceId);

  const menuRef = useRef<HTMLDivElement>(null);

  const selectedNodes = nodes.filter((n: any) => n.selected);
  const selectedIds = selectedNodes.map((n: any) => n.id);
  const singleNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const canViewLogs = singleNode && ['Deployment', 'ReplicaSet', 'Pod'].includes(singleNode.type);
  const hasSelection = selectedIds.length > 0;
  const canGroup = selectedIds.length > 1;
  const isGrouped = selectedNodes.some((n: any) => n.data?.groupId);
  const canPaste = Boolean(
    clipboard &&
      Array.isArray(clipboard.nodes) &&
      clipboard.nodes.length > 0 &&
      clipboard.nodes.every((n: any) => n && typeof n === 'object' && n.id && n.type)
  );

  useEffect(() => {
    const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
    firstItem?.focus();
  }, []);

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []
    );
    const current = document.activeElement as HTMLElement;
    const idx = items.indexOf(current);

    e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      onClose();
    }
  };

  return {
    colorMode,
    toggleColorMode,
    nodes,
    menuRef,
    singleNode,
    canViewLogs,
    hasSelection,
    canGroup,
    isGrouped,
    canPaste,
    selectedIds,
    groupNodes,
    ungroupNodes,
    copyNodes,
    pasteNodes,
    setTerminalOpen,
    setTerminalActiveTab,
    setTerminalSelectedResourceId,
    handleMenuKeyDown,
  };
};
