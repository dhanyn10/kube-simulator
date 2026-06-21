import React from 'react';
import { useFlowStore } from '../../store';
import { useReactFlow } from '@xyflow/react';
import { getEffectiveSize, getAbsPos } from '../../store/helpers';

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
        const screenX = Math.round((guide.position ?? 0) * viewport.zoom + viewport.x);
        // If minY/maxY are provided, use them for segmented lines
        const screenTop = typeof guide.minY === 'number' ? Math.round(guide.minY * viewport.zoom + viewport.y) : 0;
        const screenBottom = typeof guide.maxY === 'number' ? Math.round(guide.maxY * viewport.zoom + viewport.y) : 10000;
        return { ...guide, screenX, screenTop, screenBottom };
      }),
      horizontal: horizontal.map((guide: any) => {
        const screenY = Math.round((guide.position ?? 0) * viewport.zoom + viewport.y);
        const screenLeft = typeof guide.minX === 'number' ? Math.round(guide.minX * viewport.zoom + viewport.x) : 0;
        const screenRight = typeof guide.maxX === 'number' ? Math.round(guide.maxX * viewport.zoom + viewport.x) : 10000;
        return { ...guide, screenY, screenLeft, screenRight };
      }),
    };
  }, [alignmentGuides, viewport]);

  // Transform snap guide coordinates to screen coordinates relative to dragged node
  const snapGuidesTransformed = React.useMemo(() => {
    if (!draggedNode?.position) return { vertical: [], horizontal: [] };

    const nodeAbs = getAbsPos(draggedNode.id, nodes, draggedNode);
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

  const nodeScreenWidth = (nodeWidth || 0) * viewport.zoom;
  const nodeScreenHeight = (nodeHeight || 0) * viewport.zoom;

  const isVerticalSnapping = snapGuidesTransformed.vertical.length > 0;
  const isHorizontalSnapping = snapGuidesTransformed.horizontal.length > 0;

  // Extract these from snapGuidesTransformed if available, or fallback to relative calculation
  // But actually, we need the nodeScreenX/Y outside the map to position the fragment correctly.
  // We can derive them from the draggedNode directly here.
  const nodeAbs = draggedNode ? getAbsPos(draggedNode.id, nodes, draggedNode) : { x: 0, y: 0 };
  const nodeScreenX = Math.round(nodeAbs.x * viewport.zoom + viewport.x);
  const nodeScreenY = Math.round(nodeAbs.y * viewport.zoom + viewport.y);

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
        const centerScreenY = Math.round(guide.targetCenterPos * viewport.zoom + viewport.y);
        const relativeCenter = centerScreenY - guide.screenTop;

        const renderLine = (top: number, height: number, keySuffix: string) => (
            <div
                key={`v-align-${guide.position}-${keySuffix}`}
                style={{
                    position: 'absolute',
                    left: `${guide.screenX}px`,
                    top: `${top}px`,
                    height: `${height}px`,
                    width: '1px',
                    backgroundColor: '#f43f5e', // rose-500
                    opacity: 0.9,
                    boxShadow: '0 0 6px rgba(244, 63, 94, 0.8)',
                }}
            />
        );

        // If snapping, don't draw line through the card
        if (isVerticalSnapping && guide.screenX > nodeScreenX - 2 && guide.screenX < nodeScreenX + nodeScreenWidth + 2) {
            return (
                <React.Fragment key={`v-align-group-${guide.position}`}>
                    {renderLine(guide.screenTop, nodeScreenY - guide.screenTop, 'top')}
                    {renderLine(nodeScreenY + nodeScreenHeight, guide.screenBottom - (nodeScreenY + nodeScreenHeight), 'bottom')}
                    {/* Center indicator dot always rendered on reference node */}
                    {guide.targetType === 'center' && (
                        <div style={{
                            position: 'absolute',
                            left: `${guide.screenX}px`,
                            top: `${centerScreenY}px`,
                            transform: 'translate(-50%, -50%)',
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: '#f43f5e',
                            boxShadow: '0 0 6px rgba(244, 63, 94, 0.8)',
                            zIndex: 10
                        }} />
                    )}
                </React.Fragment>
            );
        }

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
              opacity: 0.9,
              boxShadow: '0 0 6px rgba(244, 63, 94, 0.8)',
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
        const centerScreenX = Math.round(guide.targetCenterPos * viewport.zoom + viewport.x);
        const relativeCenter = centerScreenX - guide.screenLeft;

        const renderLine = (left: number, width: number, keySuffix: string) => (
            <div
                key={`h-align-${guide.position}-${keySuffix}`}
                style={{
                    position: 'absolute',
                    top: `${guide.screenY}px`,
                    left: `${left}px`,
                    width: `${width}px`,
                    height: '1px',
                    backgroundColor: '#f43f5e',
                    opacity: 0.9,
                    boxShadow: '0 0 6px rgba(244, 63, 94, 0.8)',
                }}
            />
        );

        if (isHorizontalSnapping && guide.screenY > nodeScreenY - 2 && guide.screenY < nodeScreenY + nodeScreenHeight + 2) {
            return (
                <React.Fragment key={`h-align-group-${guide.position}`}>
                    {renderLine(guide.screenLeft, nodeScreenX - guide.screenLeft, 'left')}
                    {renderLine(nodeScreenX + nodeScreenWidth, guide.screenRight - (nodeScreenX + nodeScreenWidth), 'right')}
                    {/* Center indicator dot always rendered on reference node */}
                    {guide.targetType === 'center' && (
                        <div style={{
                            position: 'absolute',
                            top: `${guide.screenY}px`,
                            left: `${centerScreenX}px`,
                            transform: 'translate(-50%, -50%)',
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: '#f43f5e',
                            boxShadow: '0 0 6px rgba(244, 63, 94, 0.8)',
                            zIndex: 10
                        }} />
                    )}
                </React.Fragment>
            );
        }

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
              opacity: 0.9,
              boxShadow: '0 0 6px rgba(244, 63, 94, 0.8)',
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
          {snapGuidesTransformed.vertical.map((guide: any) => (
            <div
              key={`v-snap-${guide.screenX}`}
              style={{
                position: 'absolute',
                left: `${Math.round(nodeScreenX + nodeScreenWidth / 2) - 1}px`, // Always center of dragged node
                top: `${nodeScreenY}px`,
                width: '2px',
                height: `${Math.round(nodeScreenHeight)}px`,
                backgroundColor: '#3b82f6',
                opacity: 1,
                boxShadow: '0 0 10px rgba(59, 130, 246, 0.9)',
              }}
            />
          ))}

          {snapGuidesTransformed.horizontal.map((guide: any) => (
            <div
              key={`h-snap-${guide.screenY}`}
              style={{
                position: 'absolute',
                top: `${Math.round(nodeScreenY + nodeScreenHeight / 2) - 1}px`, // Always center of dragged node
                left: `${nodeScreenX}px`,
                width: `${Math.round(nodeScreenWidth)}px`,
                height: '2px',
                backgroundColor: '#3b82f6',
                opacity: 1,
                boxShadow: '0 0 10px rgba(59, 130, 246, 0.9)',
              }}
            />
          ))}
        </>
      )}
    </div>
  );
};
