import React from 'react';
import { useFlowStore } from '../../store';
import { useReactFlow } from '@xyflow/react';
import { getEffectiveSize } from '../../store/helpers';

export const AlignmentGuides = () => {
  const alignmentGuides = useFlowStore((state: { alignmentGuides: any; }) => state.alignmentGuides);
  const snapGuides = useFlowStore((state: { snapGuides: any; }) => state.snapGuides);
  const draggedNodeId = useFlowStore((state: { draggedNodeId: any; }) => state.draggedNodeId);
  const nodes = useFlowStore((state: { nodes: any; }) => state.nodes);
  const { getViewport } = useReactFlow();

  // Get viewport to transform flow coordinates to screen coordinates
  const viewport = getViewport();

  // Get dragged node for snap guide positioning
  const draggedNode = nodes.find((n: { id: any; }) => n.id === draggedNodeId);
  const { width: nodeWidth, height: nodeHeight } = draggedNode
    ? getEffectiveSize(draggedNode)
    : { width: 0, height: 0 };

  // Transform flow coordinates to screen coordinates for alignment guides
  const alignmentGuidesTransformed = React.useMemo(() => {
    const vertical = alignmentGuides?.vertical ?? [];
    const horizontal = alignmentGuides?.horizontal ?? [];

    return {
      vertical: vertical.map((guide: any) => {
        const screenX = (guide.position ?? 0) * viewport.zoom + viewport.x;
        // If minY/maxY are provided, use them for segmented lines
        const screenTop = typeof guide.minY === 'number' ? guide.minY * viewport.zoom + viewport.y : 0;
        const screenBottom = typeof guide.maxY === 'number' ? guide.maxY * viewport.zoom + viewport.y : 10000;
        return { ...guide, screenX, screenTop, screenBottom };
      }),
      horizontal: horizontal.map((guide: any) => {
        const screenY = (guide.position ?? 0) * viewport.zoom + viewport.y;
        const screenLeft = typeof guide.minX === 'number' ? guide.minX * viewport.zoom + viewport.x : 0;
        const screenRight = typeof guide.maxX === 'number' ? guide.maxX * viewport.zoom + viewport.x : 10000;
        return { ...guide, screenY, screenLeft, screenRight };
      }),
    };
  }, [alignmentGuides, viewport]);

  // Transform snap guide coordinates to screen coordinates relative to dragged node
  const snapGuidesTransformed = React.useMemo(() => {
    if (!draggedNode?.position) return { vertical: [], horizontal: [] };

    // Calculate absolute position of the dragged node
    const getAbsPosition = (node: any): { x: number, y: number } => {
      if (!node?.position) return { x: 0, y: 0 };
      if (!node.parentId) return node.position;
      const parent = nodes.find((n: any) => n.id === node.parentId);
      if (!parent) return node.position;
      const parentAbs = getAbsPosition(parent);
      return { x: node.position.x + parentAbs.x, y: node.position.y + parentAbs.y };
    };

    const nodeAbs = getAbsPosition(draggedNode);
    const nodeScreenX = nodeAbs.x * viewport.zoom + viewport.x;
    const nodeScreenY = nodeAbs.y * viewport.zoom + viewport.y;

    const vGuides = snapGuides?.vertical ?? [];
    const hGuides = snapGuides?.horizontal ?? [];

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
      {alignmentGuidesTransformed.vertical.map((guide: any) => {
        const centerScreenY = guide.targetCenterPos * viewport.zoom + viewport.y;
        const relativeCenter = centerScreenY - guide.screenTop;

        return (
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
              {guide.targetType === 'center' && (
                  <div style={{
                      position: 'absolute',
                      top: `${relativeCenter}px`,
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
        );
      })}

      {alignmentGuidesTransformed.horizontal.map((guide: any) => {
        const centerScreenX = guide.targetCenterPos * viewport.zoom + viewport.x;
        const relativeCenter = centerScreenX - guide.screenLeft;

        return (
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
              {guide.targetType === 'center' && (
                  <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${relativeCenter}px`,
                      transform: 'translate(-50%, -50%)',
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: '#f43f5e',
                      boxShadow: '0 0 6px rgba(244, 63, 94, 0.8)'
                  }} />
              )}
          </div>
        );
      })}

      {/* Snap guides (blue indicators inside dragged node) */}
      {draggedNode && (
        <>
          {snapGuidesTransformed.vertical.map((guide: { screenX: any; nodeScreenX: any; nodeScreenY: any; relativeX: any; }) => (
            <div
              key={`v-snap-${guide.relativeX}`}
              style={{
                position: 'absolute',
                left: `${guide.nodeScreenX + nodeScreenWidth / 2}px`,
                top: `${guide.nodeScreenY}px`,
                width: '2px', // Slightly thicker for emphasis
                height: `${nodeScreenHeight}px`,
                backgroundColor: '#3b82f6', // blue-500
                opacity: 0.9,
                boxShadow: '0 0 8px rgba(59, 130, 246, 0.8)',
              }}
            />
          ))}

          {snapGuidesTransformed.horizontal.map((guide: { screenY: any; nodeScreenX: any; nodeScreenY: any; relativeY: any; }) => (
            <div
              key={`h-snap-${guide.relativeY}`}
              style={{
                position: 'absolute',
                top: `${guide.nodeScreenY + nodeScreenHeight / 2}px`,
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
