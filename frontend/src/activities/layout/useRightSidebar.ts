import { useState, useRef, useEffect } from 'react';
import { Activity, Info } from 'lucide-react';
import { useFlowStore } from '@/store';
import { useSidebarContextMenu } from '@/components/UI/SidebarContextMenu';
import { TabType } from './rightSidebarHelpers';

export const useRightSidebar = () => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const toggleColorMode = useFlowStore((state) => state.toggleColorMode);
  const isTerminalOpen = useFlowStore((state) => state.isTerminalOpen);
  const setRightSidebarVisible = useFlowStore((state) => state.setRightSidebarVisible);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);

  const configuringNodeId = useFlowStore((state) => state.configuringNodeId);
  const configuringEdgeId = useFlowStore((state) => state.configuringEdgeId);

  const visibleWidgets = useFlowStore((state) => state.visibleWidgets);
  const toggleWidget = useFlowStore((state) => state.toggleWidget);

  const selectedNode = nodes.find((n) => n.id === configuringNodeId);
  const selectedEdge = edges.find((e) => e.id === configuringEdgeId);
  const isElementSelected = Boolean(selectedNode || selectedEdge);

  const [activeTab, setActiveTab] = useState<TabType>('canvas');
  const [isCanvasDropdownOpen, setIsCanvasDropdownOpen] = useState(false);
  const canvasDropdownRef = useRef<HTMLDivElement>(null);

  const isHistoryViewOpen = useFlowStore((state) => state.isHistoryViewOpen);

  const { contextMenu, handleContextMenu, closeContextMenu } = useSidebarContextMenu();

  useEffect(() => {
    if (isHistoryViewOpen) {
      setActiveTab('history');
    }
  }, [isHistoryViewOpen]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'history') {
      useFlowStore.setState({ isHistoryViewOpen: true });
    } else if (isHistoryViewOpen) {
      useFlowStore.setState({ isHistoryViewOpen: false });
    }
  };

  useEffect(() => {
    if (isElementSelected) {
      handleTabChange('settings');
    }
  }, [isElementSelected, configuringNodeId, configuringEdgeId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (canvasDropdownRef.current && target instanceof Node && !canvasDropdownRef.current.contains(target)) {
        setIsCanvasDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCloseSidebar = () => {
    if (isHistoryViewOpen) {
      useFlowStore.setState({ isHistoryViewOpen: false });
    }
    setRightSidebarVisible(false);
  };

  const canvasWidgets = [
    { id: 'hardware-budget', label: 'Hardware Budget', icon: Activity },
    { id: 'object-stats', label: 'Object Statistics', icon: Info },
  ];

  return {
    colorMode,
    toggleColorMode,
    isTerminalOpen,
    nodes,
    selectedNode,
    selectedEdge,
    isElementSelected,
    activeTab,
    handleTabChange,
    isCanvasDropdownOpen,
    setIsCanvasDropdownOpen,
    canvasDropdownRef,
    visibleWidgets,
    toggleWidget,
    canvasWidgets,
    contextMenu,
    handleContextMenu,
    closeContextMenu,
    handleCloseSidebar,
  };
};
