import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

interface FitViewOptions {
  padding?: number;
  duration?: number;
  maxZoom?: number;
}

export const useFitView = () => {
  const { getNodes, setViewport, fitView: rfFitView } = useReactFlow();

  const customFitView = useCallback(({ padding = 0.05, duration = 800, maxZoom = 1.2 }: FitViewOptions = {}) => {
    const nodes = getNodes();
    if (nodes.length === 0) return;

    // Calculate Bounding Box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      const x = node.position.x;
      const y = node.position.y;
      const w = node.measured?.width ?? node.width ?? 0;
      const h = node.measured?.height ?? node.height ?? 0;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Get Container Dimensions
    // We can infer container size from the current viewport and internal state if we had it,
    // but React Flow's fitView is already quite good if we just use its parameters correctly.
    // However, the user wants a CUSTOM Bounding Box approach.

    // Actually, React Flow's fitView already uses the bounding box.
    // The "inaccuracy" often comes from nodes not being measured yet.

    // Let's implement the explicit scale calculation as requested.
    const containerElement = document.querySelector('.react-flow__renderer');
    if (!containerElement) {
        // Fallback to standard fitView if we can't find the container
        rfFitView({ padding, duration, maxZoom });
        return;
    }

    const { width: containerWidth, height: containerHeight } = containerElement.getBoundingClientRect();

    const availableWidth = containerWidth * (1 - padding * 2);
    const availableHeight = containerHeight * (1 - padding * 2);

    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;

    let scale = Math.min(scaleX, scaleY);
    if (scale > maxZoom) scale = maxZoom;

    // Center the content
    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;

    const x = containerWidth / 2 - centerX * scale;
    const y = containerHeight / 2 - centerY * scale;

    setViewport({ x, y, zoom: scale }, { duration });
  }, [getNodes, setViewport, rfFitView]);

  return customFitView;
};
