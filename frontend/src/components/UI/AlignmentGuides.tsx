import React from 'react';
import { useFlowStore } from '../../store';
import { useReactFlow } from '@xyflow/react';

export const AlignmentGuides = () => {
  const alignmentGuides = useFlowStore((state: { alignmentGuides: any; }) => state.alignmentGuides);
  const draggedNodeId = useFlowStore((state: { draggedNodeId: any; }) => state.draggedNodeId);
  const { getViewport } = useReactFlow();

  // Get viewport to transform flow coordinates to screen coordinates
  const viewport = getViewport();

  // Transform flow coordinates to screen coordinates for alignment guides
  const alignmentGuidesTransformed = React.useMemo(() => {
    const vertical = alignmentGuides?.vertical ?? [];
    const horizontal = alignmentGuides?.horizontal ?? [];

    return {
      vertical: vertical.map((guide: any) => {
        const screenX = (guide.position ?? 0) * viewport.zoom + viewport.x;
        return { ...guide, screenX };
      }),
      horizontal: horizontal.map((guide: any) => {
        const screenY = (guide.position ?? 0) * viewport.zoom + viewport.y;
        return { ...guide, screenY };
      }),
    };
  }, [alignmentGuides, viewport]);

  if (!draggedNodeId) return null;

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
      {/* Alignment guides (characteristic Draw.io flat orange dashed lines) */}
      {alignmentGuidesTransformed.vertical.map((guide: any) => (
        <div
          key={`v-align-${guide.position}`}
          style={{
            position: 'absolute',
            left: `${Math.round(guide.screenX)}px`,
            top: 0,
            bottom: 0,
            width: 0,
            borderLeft: '1px dashed #ff6600', // Draw.io orange
            opacity: 0.8,
          }}
        />
      ))}

      {alignmentGuidesTransformed.horizontal.map((guide: any) => (
        <div
          key={`h-align-${guide.position}`}
          style={{
            position: 'absolute',
            top: `${Math.round(guide.screenY)}px`,
            left: 0,
            right: 0,
            height: 0,
            borderTop: '1px dashed #ff6600', // Draw.io orange
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
};
