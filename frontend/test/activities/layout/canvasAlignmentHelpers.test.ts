import { describe, it, expect } from 'vitest';
import { Node } from '@xyflow/react';
import {
  getNodeBounds,
  checkVerticalMatch,
  checkHorizontalMatch,
  calculateAlignmentGuides,
  alignAllNodesToGrid,
} from '@/activities/layout/canvasAlignmentHelpers';

describe('canvasAlignmentHelpers', () => {
  it('getNodeBounds calculates correct bounding boxes', () => {
    const node: Node = {
      id: 'node-1',
      position: { x: 100, y: 50 },
      width: 200,
      height: 100,
      data: {},
    };

    const bounds = getNodeBounds(node);
    expect(bounds.left).toBe(100);
    expect(bounds.right).toBe(300);
    expect(bounds.centerX).toBe(200);
    expect(bounds.top).toBe(50);
    expect(bounds.bottom).toBe(150);
    expect(bounds.centerY).toBe(100);
  });

  it('checkVerticalMatch identifies left, center, right, and adjacent vertical alignments', () => {
    const drag = getNodeBounds({ id: 'd', position: { x: 100, y: 0 }, width: 200, height: 100, data: {} });

    // Align left edge
    const tLeft = getNodeBounds({ id: 't', position: { x: 102, y: 300 }, width: 100, height: 100, data: {} });
    expect(checkVerticalMatch(drag, tLeft, 4)).toEqual({ line: 102, snap: 102 });

    // Align center X (drag.centerX = 200, target.centerX = 202)
    const tCenter = getNodeBounds({ id: 't', position: { x: 152, y: 300 }, width: 100, height: 100, data: {} });
    expect(checkVerticalMatch(drag, tCenter, 4)).toEqual({ line: 202, snap: 102 });

    // Align right edge (drag.right = 300, target.right = 303)
    const tRight = getNodeBounds({ id: 't', position: { x: 223, y: 300 }, width: 80, height: 100, data: {} });
    expect(checkVerticalMatch(drag, tRight, 4)).toEqual({ line: 303, snap: 103 });

    // Adjacent right to left (target.left is 302, near drag.right 300)
    const tAdjRight = getNodeBounds({ id: 't', position: { x: 302, y: 300 }, width: 100, height: 100, data: {} });
    expect(checkVerticalMatch(drag, tAdjRight, 4)).toEqual({ line: 302, snap: 102 });

    // Adjacent left to right (target.right is 98, near drag.left 100)
    const tAdjLeft = getNodeBounds({ id: 't', position: { x: -2, y: 300 }, width: 100, height: 100, data: {} });
    expect(checkVerticalMatch(drag, tAdjLeft, 4)).toEqual({ line: 98, snap: 98 });

    // No match
    const tFar = getNodeBounds({ id: 't', position: { x: 600, y: 300 }, width: 100, height: 100, data: {} });
    expect(checkVerticalMatch(drag, tFar, 4)).toBeNull();
  });

  it('checkHorizontalMatch identifies top, center, bottom, and adjacent horizontal alignments', () => {
    const drag = getNodeBounds({ id: 'd', position: { x: 0, y: 100 }, width: 100, height: 100, data: {} });

    // Align top edge (drag.top = 100, target.top = 102)
    const tTop = getNodeBounds({ id: 't', position: { x: 300, y: 102 }, width: 100, height: 80, data: {} });
    expect(checkHorizontalMatch(drag, tTop, 4)).toEqual({ line: 102, snap: 102 });

    // Align center Y (drag.centerY = 150, target.centerY = 152)
    const tCenter = getNodeBounds({ id: 't', position: { x: 300, y: 112 }, width: 100, height: 80, data: {} });
    expect(checkHorizontalMatch(drag, tCenter, 4)).toEqual({ line: 152, snap: 102 });

    // Align bottom edge (drag.bottom = 200, target.bottom = 203)
    const tBottom = getNodeBounds({ id: 't', position: { x: 300, y: 123 }, width: 100, height: 80, data: {} });
    expect(checkHorizontalMatch(drag, tBottom, 4)).toEqual({ line: 203, snap: 103 });

    // Adjacent bottom to top (target.top is 202, near drag.bottom 200)
    const tAdjBottom = getNodeBounds({ id: 't', position: { x: 300, y: 202 }, width: 100, height: 80, data: {} });
    expect(checkHorizontalMatch(drag, tAdjBottom, 4)).toEqual({ line: 202, snap: 102 });

    // Adjacent top to bottom (target.bottom is 98, near drag.top 100)
    const tAdjTop = getNodeBounds({ id: 't', position: { x: 300, y: 18 }, width: 100, height: 80, data: {} });
    expect(checkHorizontalMatch(drag, tAdjTop, 4)).toEqual({ line: 98, snap: 98 });

    // No match
    const tFar = getNodeBounds({ id: 't', position: { x: 300, y: 600 }, width: 100, height: 80, data: {} });
    expect(checkHorizontalMatch(drag, tFar, 4)).toBeNull();
  });

  it('calculateAlignmentGuides returns peer matches when within threshold', () => {
    const draggingNode: Node = {
      id: 'd1',
      position: { x: 102, y: 198 },
      width: 200,
      height: 100,
      data: {},
    };

    const peerNode: Node = {
      id: 'p1',
      position: { x: 100, y: 200 },
      width: 200,
      height: 100,
      data: {},
    };

    const guides = calculateAlignmentGuides(draggingNode, [draggingNode, peerNode], 8);
    expect(guides.vertical).toBe(100);
    expect(guides.horizontal).toBe(200);
    expect(guides.snapX).toBe(100);
    expect(guides.snapY).toBe(200);
  });

  it('calculateAlignmentGuides falls back to grid lines when no peer matches', () => {
    const draggingNode: Node = {
      id: 'd1',
      position: { x: 26, y: 49 },
      width: 200,
      height: 100,
      data: {},
    };

    const guides = calculateAlignmentGuides(draggingNode, [draggingNode], 8, 24);
    expect(guides.vertical).toBe(24);
    expect(guides.horizontal).toBe(48);
  });

  it('alignAllNodesToGrid rounds node positions to grid multiples and resolves collisions', () => {
    const nodes: Node[] = [
      { id: 'n1', position: { x: 25, y: 50 }, width: 100, height: 100, data: {} },
      { id: 'n2', position: { x: 98, y: 193 }, width: 100, height: 100, data: {} },
    ];

    const result = alignAllNodesToGrid(nodes, 24);
    expect(result[0].position.x % 24).toBe(0);
    expect(result[0].position.y % 24).toBe(0);
  });
});
