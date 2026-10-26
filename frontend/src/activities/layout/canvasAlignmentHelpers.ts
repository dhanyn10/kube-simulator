import { Node } from '@xyflow/react';
import { resolveGlobalCollisions } from '@/store/helpers';

export interface AlignmentGuideLines {
  horizontal: number | null;
  vertical: number | null;
  snapX?: number;
  snapY?: number;
}

export interface NodeBounds {
  left: number;
  right: number;
  centerX: number;
  top: number;
  bottom: number;
  centerY: number;
  width: number;
  height: number;
}

export interface MatchResult {
  line: number;
  snap: number;
}

/**
 * Calculates absolute or relative bounding dimensions for a given node.
 */
export const getNodeBounds = (node: Node): NodeBounds => {
  const width = node.width || (node.measured && typeof node.measured.width === 'number' ? node.measured.width : 240);
  const height = node.height || (node.measured && typeof node.measured.height === 'number' ? node.measured.height : 120);
  const left = node.position.x;
  const top = node.position.y;

  return {
    left,
    right: left + width,
    centerX: left + width / 2,
    top,
    bottom: top + height,
    centerY: top + height / 2,
    width,
    height,
  };
};

/**
 * Checks for vertical alignment matches (X-axis alignment) between dragging node and target node.
 */
export const checkVerticalMatch = (
  drag: NodeBounds,
  target: NodeBounds,
  threshold: number
): MatchResult | null => {
  if (Math.abs(drag.left - target.left) <= threshold) {
    return { line: target.left, snap: target.left };
  }
  if (Math.abs(drag.centerX - target.centerX) <= threshold) {
    return { line: target.centerX, snap: target.centerX - drag.width / 2 };
  }
  if (Math.abs(drag.right - target.right) <= threshold) {
    return { line: target.right, snap: target.right - drag.width };
  }
  if (Math.abs(drag.left - target.right) <= threshold) {
    return { line: target.right, snap: target.right };
  }
  if (Math.abs(drag.right - target.left) <= threshold) {
    return { line: target.left, snap: target.left - drag.width };
  }
  return null;
};

/**
 * Checks for horizontal alignment matches (Y-axis alignment) between dragging node and target node.
 */
export const checkHorizontalMatch = (
  drag: NodeBounds,
  target: NodeBounds,
  threshold: number
): MatchResult | null => {
  if (Math.abs(drag.top - target.top) <= threshold) {
    return { line: target.top, snap: target.top };
  }
  if (Math.abs(drag.centerY - target.centerY) <= threshold) {
    return { line: target.centerY, snap: target.centerY - drag.height / 2 };
  }
  if (Math.abs(drag.bottom - target.bottom) <= threshold) {
    return { line: target.bottom, snap: target.bottom - drag.height };
  }
  if (Math.abs(drag.top - target.bottom) <= threshold) {
    return { line: target.bottom, snap: target.bottom };
  }
  if (Math.abs(drag.bottom - target.top) <= threshold) {
    return { line: target.top, snap: target.top - drag.height };
  }
  return null;
};

/**
 * Finds vertical alignment match against peer canvas nodes.
 */
const findPeerVerticalGuide = (
  dragBounds: NodeBounds,
  peers: Node[],
  threshold: number
): MatchResult | null => {
  for (const peer of peers) {
    const match = checkVerticalMatch(dragBounds, getNodeBounds(peer), threshold);
    if (match) return match;
  }
  return null;
};

/**
 * Finds horizontal alignment match against peer canvas nodes.
 */
const findPeerHorizontalGuide = (
  dragBounds: NodeBounds,
  peers: Node[],
  threshold: number
): MatchResult | null => {
  for (const peer of peers) {
    const match = checkHorizontalMatch(dragBounds, getNodeBounds(peer), threshold);
    if (match) return match;
  }
  return null;
};

/**
 * Finds fallback alignment match against nearest canvas grid interval.
 */
const findGridGuide = (
  coord: number,
  gridGap: number,
  threshold: number
): MatchResult | null => {
  const nearestGrid = Math.round(coord / gridGap) * gridGap;
  if (Math.abs(coord - nearestGrid) <= Math.min(threshold, 4)) {
    return { line: nearestGrid, snap: nearestGrid };
  }
  return null;
};

/**
 * Calculates smart alignment guide lines by comparing dragging node coordinates
 * with peer nodes and canvas grid lines.
 */
export const calculateAlignmentGuides = (
  draggingNode: Node,
  allNodes: Node[],
  threshold: number = 8,
  gridGap: number = 24
): AlignmentGuideLines => {
  const dragBounds = getNodeBounds(draggingNode);
  const peers = allNodes.filter(
    (n) => n.id !== draggingNode.id && n.parentId === draggingNode.parentId
  );

  const vMatch = findPeerVerticalGuide(dragBounds, peers, threshold)
    ?? findGridGuide(dragBounds.left, gridGap, threshold);

  const hMatch = findPeerHorizontalGuide(dragBounds, peers, threshold)
    ?? findGridGuide(dragBounds.top, gridGap, threshold);

  return {
    vertical: vMatch?.line ?? null,
    horizontal: hMatch?.line ?? null,
    snapX: vMatch?.snap,
    snapY: hMatch?.snap,
  };
};

/**
 * Snaps all canvas nodes onto the nearest canvas grid intervals and resolves collisions.
 *
 * @param nodes Array of canvas nodes
 * @param gridGap Grid step size (default 24px)
 * @returns Updated array of nodes snapped cleanly to grid
 */
export const alignAllNodesToGrid = (nodes: Node[], gridGap: number = 24): Node[] => {
  const snappedNodes = nodes.map((node) => {
    const snappedX = Math.round(node.position.x / gridGap) * gridGap;
    const snappedY = Math.round(node.position.y / gridGap) * gridGap;

    return {
      ...node,
      position: {
        x: Math.max(0, snappedX),
        y: Math.max(0, snappedY),
      },
    };
  });

  // Resolve any collision overlaps after snapping top-level nodes
  return resolveGlobalCollisions(snappedNodes);
};
