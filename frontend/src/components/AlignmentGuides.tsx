import React from 'react';
import { useFlowStore } from '../store';
import { useReactFlow } from '@xyflow/react';

export const AlignmentGuides = () => {
  const alignmentGuides = useFlowStore((state: { alignmentGuides: any; }) => state.alignmentGuides);
  const snapGuides = useFlowStore((state: { snapGuides: any; }) => state.snapGuides);
  const draggedNodeId = useFlowStore((state: { draggedNodeId: any; }) => state.draggedNodeId);
  const nodes = useFlowStore((state: { nodes: any; }) => state.nodes);
  const { getViewport } = useReactFlow();

  // Get viewport to transform flow coordinates to screen coordinates
  const viewport = getViewport();

  // Get dragged node for snap guide positioning
  const draggedNode = draggedNodeId ? nodes.find((n: { id: any; }) => n.id === draggedNodeId) : null;
  const nodeWidth = draggedNode ? (draggedNode.width || draggedNode.measured?.width || 160) : 0;
  const nodeHeight = draggedNode ? (draggedNode.height || draggedNode.measured?.height || 80) : 0;

  // Transform flow coordinates to screen coordinates for alignment guides
  const alignmentGuidesTransformed = React.useMemo(() => {
    return {
      vertical: alignmentGuides.vertical.map((guide: { position: number; }) => {
        const screenX = guide.position * viewport.zoom + viewport.x;
        return { screenX };
      }),
      horizontal: alignmentGuides.horizontal.map((guide: { position: number; }) => {
        const screenY = guide.position * viewport.zoom + viewport.y;
        return { screenY };
      }),
    };
  }, [alignmentGuides, viewport]);

  // Transform snap guide coordinates to screen coordinates relative to dragged node
  const snapGuidesTransformed = React.useMemo(() => {
    if (!draggedNode) return { vertical: [], horizontal: [] };

    // Calculate absolute position of the dragged node
    const getAbsPosition = (node: any): { x: number, y: number } => {
      if (!node.parentId) return node.position;
      const parent = nodes.find((n: any) => n.id === node.parentId);
      if (!parent) return node.position;
      const parentAbs = getAbsPosition(parent);
      return { x: node.position.x + parentAbs.x, y: node.position.y + parentAbs.y };
    };

    const nodeAbs = getAbsPosition(draggedNode);
    const nodeScreenX = nodeAbs.x * viewport.zoom + viewport.x;
    const nodeScreenY = nodeAbs.y * viewport.zoom + viewport.y;

    return {
      vertical: snapGuides.vertical
        .filter((g: { isActive: any; }) => g.isActive)
        .map((guide: { position: number; }) => {
          const guideScreenX = guide.position * viewport.zoom + viewport.x;
          const relativeX = guideScreenX - nodeScreenX;

          return {
            nodeScreenX,
            nodeScreenY,
            relativeX,
            screenX: guideScreenX,
          };
        }),
      horizontal: snapGuides.horizontal
        .filter((g: { isActive: any; }) => g.isActive)
        .map((guide: { position: number; }) => {
          const guideScreenY = guide.position * viewport.zoom + viewport.y;
          const relativeY = guideScreenY - nodeScreenY;

          return {
            nodeScreenX,
            nodeScreenY,
            relativeY,
            screenY: guideScreenY,
          };
        }),
    };
  }, [snapGuides, draggedNode, nodes, viewport]);

  const nodeScreenWidth = nodeWidth * viewport.zoom;
  const nodeScreenHeight = nodeHeight * viewport.zoom;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {/* Alignment guides (red lines) */}
      {alignmentGuidesTransformed.vertical.map((guide: { screenX: any; }, idx: any) => (
        <div
          key={`v-align-${idx}`}
          style={{
            position: 'absolute',
            left: `${guide.screenX}px`,
            top: 0,
            bottom: 0,
            width: '1px',
            backgroundColor: '#ef4444',
            opacity: 0.7,
            boxShadow: '0 0 3px rgba(239, 68, 68, 0.6)',
          }}
        />
      ))}

      {alignmentGuidesTransformed.horizontal.map((guide: { screenY: any; }, idx: any) => (
        <div
          key={`h-align-${idx}`}
          style={{
            position: 'absolute',
            top: `${guide.screenY}px`,
            left: 0,
            right: 0,
            height: '1px',
            backgroundColor: '#ef4444',
            opacity: 0.7,
            boxShadow: '0 0 3px rgba(239, 68, 68, 0.6)',
          }}
        />
      ))}

      {/* Snap guides (blue dashed lines inside dragged node) */}
      {draggedNode && (
        <>
          {snapGuidesTransformed.vertical.map((guide: { screenX: any; nodeScreenY: any; }, idx: any) => (
            <div
              key={`v-snap-${idx}`}
              style={{
                position: 'absolute',
                left: `${guide.screenX}px`,
                top: `${guide.nodeScreenY}px`,
                width: '1px',
                height: `${nodeScreenHeight}px`,
                backgroundColor: '#3b82f6',
                opacity: 0.8,
                borderLeft: '1px dashed #3b82f6',
                boxShadow: '0 0 4px rgba(59, 130, 246, 0.7)',
              }}
            />
          ))}

          {snapGuidesTransformed.horizontal.map((guide: { screenY: any; nodeScreenX: any; }, idx: any) => (
            <div
              key={`h-snap-${idx}`}
              style={{
                position: 'absolute',
                top: `${guide.screenY}px`,
                left: `${guide.nodeScreenX}px`,
                width: `${nodeScreenWidth}px`,
                height: '1px',
                backgroundColor: '#3b82f6',
                opacity: 0.8,
                borderTop: '1px dashed #3b82f6',
                boxShadow: '0 0 4px rgba(59, 130, 246, 0.7)',
              }}
            />
          ))}
        </>
      )}
    </div>
  );
};
