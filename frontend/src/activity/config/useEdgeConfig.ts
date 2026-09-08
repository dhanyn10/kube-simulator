/**
 * Hook and helpers for Edge Configuration (Connection styles, colors, thickness).
 */

import { useFlowStore } from '../../store';

export const DEFAULT_RUNNING_COLOR = 'var(--color-mat-indigo)';
export const DEFAULT_ERROR_COLOR = 'var(--color-mat-red)';

export const formatColorName = (color: string) => color.replace('var(--color-mat-', '').replace(')', '');

export const useEdgeConfigHandler = (selectedEdge: any) => {
  const edges = useFlowStore((state) => state.edges);
  const setEdges = useFlowStore((state) => state.setEdges);

  const globalEdgeColor = useFlowStore((state) => state.globalEdgeColor);
  const globalEdgeErrorColor = useFlowStore((state) => state.globalEdgeErrorColor);
  const setGlobalEdgeColors = useFlowStore((state) => state.setGlobalEdgeColors);

  const data = selectedEdge.data || {};
  const edgeWidth = data.width || 2;

  const updateEdgeData = (newData: any) => {
    setEdges(edges.map(e => e.id === selectedEdge.id ? {
      ...e,
      data: { ...e.data, ...newData }
    } : e));
  };

  const handleRunningColorChange = (newColor: string) => {
    if (newColor.toLowerCase() === globalEdgeErrorColor.toLowerCase()) {
      setGlobalEdgeColors(newColor, globalEdgeColor);
    } else {
      setGlobalEdgeColors(newColor, globalEdgeErrorColor);
    }
  };

  const handleErrorColorChange = (newColor: string) => {
    if (newColor.toLowerCase() === globalEdgeColor.toLowerCase()) {
      setGlobalEdgeColors(globalEdgeErrorColor, newColor);
    } else {
      setGlobalEdgeColors(globalEdgeColor, newColor);
    }
  };

  const resetRunningColor = () => setGlobalEdgeColors(DEFAULT_RUNNING_COLOR, globalEdgeErrorColor);
  const resetErrorColor = () => setGlobalEdgeColors(globalEdgeColor, DEFAULT_ERROR_COLOR);

  return {
    edgeWidth,
    globalEdgeColor,
    globalEdgeErrorColor,
    updateEdgeData,
    handleRunningColorChange,
    handleErrorColorChange,
    resetRunningColor,
    resetErrorColor,
  };
};
