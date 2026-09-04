import React, { useState, useCallback } from 'react';
import { useReactFlow, Node, Edge } from '@xyflow/react';
import { useFlowStore } from '../store';
import { getAbsPos, generateYaml } from '../lib/utils';

function computeAutofocusZoom(node: Node) {
  let zoom = 1.5;
  const containerElement = document.querySelector('.react-flow__renderer');
  if (containerElement) {
    const rect = containerElement.getBoundingClientRect();
    const containerWidth = rect.width || 1024;
    const containerHeight = rect.height || 768;
    const padding = 0.08;
    const availableWidth = containerWidth * (1 - padding * 2);
    const availableHeight = containerHeight * (1 - padding * 2);

    const nodeW = node.measured?.width ?? node.width ?? 150;
    const nodeH = node.measured?.height ?? node.height ?? 100;

    const scaleX = availableWidth / nodeW;
    const scaleY = availableHeight / nodeH;

    zoom = Math.max(0.5, Math.min(1.5, Math.min(scaleX, scaleY)));
  }
  return zoom;
}

export function useCanvasHandlers() {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const onNodeClickStore = useFlowStore((state) => state.onNodeClick);
  const isAutofocusEnabled = useFlowStore((state) => state.isAutofocusEnabled);
  const isRightSidebarVisible = useFlowStore((state) => state.isRightSidebarVisible);
  const setConfiguringEdgeId = useFlowStore((state) => state.setConfiguringEdgeId);

  const { setCenter, fitBounds } = useReactFlow();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isYamlOpen, setIsYamlOpen] = useState(false);
  const [yamlContent, setYamlContent] = useState('');

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (!node.selected) {
        useFlowStore.setState({
          nodes: nodes.map((n) => ({ ...n, selected: n.id === node.id })),
        });
      }
      setContextMenu({ x: event.clientX, y: event.clientY });
    },
    [nodes]
  );

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      onNodeClickStore(event, node);
      if (isAutofocusEnabled) {
        const absPos = getAbsPos(node.id, nodes);
        const nodeW = node.measured?.width ?? node.width ?? 150;
        const nodeH = node.measured?.height ?? node.height ?? 100;
        const centerX = absPos.x + nodeW / 2;
        const centerY = absPos.y + nodeH / 2;
        const zoom = computeAutofocusZoom(node);

        setCenter(centerX, centerY, { zoom, duration: 800 });
      }
    },
    [onNodeClickStore, isAutofocusEnabled, setCenter, nodes]
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (!isRightSidebarVisible) {
        useFlowStore.getState().setRightSidebarVisible(true);
      }
      setConfiguringEdgeId(edge.id);
      if (isAutofocusEnabled) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (sourceNode && targetNode) {
          const sourceAbsPos = getAbsPos(sourceNode.id, nodes);
          const targetAbsPos = getAbsPos(targetNode.id, nodes);

          const sourceW = sourceNode.measured?.width ?? sourceNode.width ?? 150;
          const sourceH = sourceNode.measured?.height ?? sourceNode.height ?? 100;
          const targetW = targetNode.measured?.width ?? targetNode.width ?? 150;
          const targetH = targetNode.measured?.height ?? targetNode.height ?? 100;

          const minX = Math.min(sourceAbsPos.x, targetAbsPos.x);
          const minY = Math.min(sourceAbsPos.y, targetAbsPos.y);
          const maxX = Math.max(sourceAbsPos.x + sourceW, targetAbsPos.x + targetW);
          const maxY = Math.max(sourceAbsPos.y + sourceH, targetAbsPos.y + targetH);

          fitBounds(
            {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            },
            { padding: 0.2, duration: 800 }
          );
        }
      }
    },
    [setConfiguringEdgeId, isAutofocusEnabled, nodes, fitBounds, isRightSidebarVisible]
  );

  const handleExport = useCallback(async () => {
    const content = await generateYaml(nodes, edges);
    setYamlContent(content);
    setIsYamlOpen(true);
  }, [nodes, edges]);

  return {
    contextMenu,
    setContextMenu,
    isYamlOpen,
    setIsYamlOpen,
    yamlContent,
    onNodeContextMenu,
    onPaneContextMenu,
    onNodeClick,
    onEdgeClick,
    handleExport,
  };
}
