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
    const vertical = Array.isArray(alignmentGuides?.vertical) ? alignmentGuides.vertical : [];
    const horizontal = Array.isArray(alignmentGuides?.horizontal) ? alignmentGuides.horizontal : [];

    return {
      vertical: vertical.map((guide: any) => {
        const screenX = (guide.position || 0) * viewport.zoom + viewport.x;
        // If minY/maxY are provided, use them for segmented lines
        const screenTop = guide.minY !== undefined ? guide.minY * viewport.zoom + viewport.y : 0;
        const screenBottom = guide.maxY !== undefined ? guide.maxY * viewport.zoom + viewport.y : 10000;
        return { ...guide, screenX, screenTop, screenBottom };
      }),
      horizontal: horizontal.map((guide: any) => {
        const screenY = (guide.position || 0) * viewport.zoom + viewport.y;
        const screenLeft = guide.minX !== undefined ? guide.minX * viewport.zoom + viewport.x : 0;
        const screenRight = guide.maxX !== undefined ? guide.maxX * viewport.zoom + viewport.x : 10000;
        return { ...guide, screenY, screenLeft, screenRight };
      }),
    };
  }, [alignmentGuides, viewport]);

  // Transform snap guide coordinates to screen coordinates relative to dragged node
  const snapGuidesTransformed = React.useMemo(() => {
    if (!draggedNode || !draggedNode.position) return { vertical: [], horizontal: [] };

    // Calculate absolute position of the dragged node
    const getAbsPosition = (node: any): { x: number, y: number } => {
      if (!node || !node.position) return { x: 0, y: 0 };
      if (!node.parentId) return node.position;
      const parent = nodes.find((n: any) => n.id === node.parentId);
      if (!parent) return node.position;
      const parentAbs = getAbsPosition(parent);
      return { x: node.position.x + parentAbs.x, y: node.position.y + parentAbs.y };
    };

    const nodeAbs = getAbsPosition(draggedNode);
    const nodeScreenX = nodeAbs.x * viewport.zoom + viewport.x;
    const nodeScreenY = nodeAbs.y * viewport.zoom + viewport.y;

    const vGuides = Array.isArray(snapGuides?.vertical) ? snapGuides.vertical : [];
    const hGuides = Array.isArray(snapGuides?.horizontal) ? snapGuides.horizontal : [];

    return {
      vertical: vGuides
        .filter((g: { isActive: any; }) => g.isActive)
        .map((guide: { position: number; }) => {
          const guideScreenX = (guide.position || 0) * viewport.zoom + viewport.x;
          const relativeX = guideScreenX - nodeScreenX;

          return {
            nodeScreenX,
            nodeScreenY,
            relativeX,
            screenX: guideScreenX,
          };
        }),
      horizontal: hGuides
        .filter((g: { isActive: any; }) => g.isActive)
        .map((guide: { position: number; }) => {
          const guideScreenY = (guide.position || 0) * viewport.zoom + viewport.y;
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
        overflow: 'hidden'
      }}
    >
      {/* Alignment guides (premium red/pink segmented lines) */}
      {alignmentGuidesTransformed.vertical.map((guide: any) => (
        <div
          key={`v-align-${guide.position}-${guide.screenTop}-${guide.screenBottom}`}
          style={{
            position: 'absolute',
            left: `${guide.screenX}px`,
            top: `${guide.screenTop}px`,
            height: `${guide.screenBottom - guide.screenTop}px`,
            width: '1px',
            backgroundColor: '#f43f5e', // rose-500
            opacity: 0.8,
            boxShadow: '0 0 4px rgba(244, 63, 94, 0.6)',
          }}
        >
            {/* Center indicator dot */}
            {guide.type === 'center' && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: '#f43f5e',
                    boxShadow: '0 0 6px rgba(244, 63, 94, 0.8)'
                }} />
            )}
        </div>
      ))}

      {alignmentGuidesTransformed.horizontal.map((guide: any) => (
        <div
          key={`h-align-${guide.position}-${guide.screenLeft}-${guide.screenRight}`}
          style={{
            position: 'absolute',
            top: `${guide.screenY}px`,
            left: `${guide.screenLeft}px`,
            width: `${guide.screenRight - guide.screenLeft}px`,
            height: '1px',
            backgroundColor: '#f43f5e',
            opacity: 0.8,
            boxShadow: '0 0 4px rgba(244, 63, 94, 0.6)',
          }}
        >
            {/* Center indicator dot */}
            {guide.type === 'center' && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: '#f43f5e',
                    boxShadow: '0 0 6px rgba(244, 63, 94, 0.8)'
                }} />
            )}
        </div>
      ))}

      {/* Snap guides (blue indicators inside dragged node) */}
      {draggedNode && (
        <>
          {snapGuidesTransformed.vertical.map((guide: { screenX: any; nodeScreenY: any; relativeX: any; }) => (
            <div
              key={`v-snap-${guide.relativeX}`}
              style={{
                position: 'absolute',
                left: `${guide.screenX}px`,
                top: `${guide.nodeScreenY}px`,
                width: '2px', // Slightly thicker for emphasis
                height: `${nodeScreenHeight}px`,
                backgroundColor: '#3b82f6', // blue-500
                opacity: 0.9,
                boxShadow: '0 0 8px rgba(59, 130, 246, 0.8)',
              }}
            />
          ))}

          {snapGuidesTransformed.horizontal.map((guide: { screenY: any; nodeScreenX: any; relativeY: any; }) => (
            <div
              key={`h-snap-${guide.relativeY}`}
              style={{
                position: 'absolute',
                top: `${guide.screenY}px`,
                left: `${guide.nodeScreenX}px`,
                width: `${nodeScreenWidth}px`,
                height: '2px',
                backgroundColor: '#3b82f6',
                opacity: 0.9,
                boxShadow: '0 0 8px rgba(59, 130, 246, 0.8)',
              }}
            />
          ))}
        </>
      )}
    </div>
  );
};
