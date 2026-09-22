import { useState, useLayoutEffect, RefObject } from 'react';

export interface PositionInput {
  readonly x: number;
  readonly y: number;
}

export interface DimensionsInput {
  readonly width: number;
  readonly height: number;
}

export interface ViewportInput {
  readonly innerWidth: number;
  readonly innerHeight: number;
}

export interface AdjustedPosition {
  readonly left: number;
  readonly top: number;
}

/**
 * Calculates adjusted { left, top } screen coordinates for a context menu
 * based on cursor position (x, y), element dimensions, and viewport size.
 * If the menu overflows the right edge, it displays to the left of the cursor.
 * If the menu overflows the bottom edge, it displays above the cursor.
 */
export function adjustContextMenuPosition(
  pos: PositionInput,
  dim: DimensionsInput,
  viewport: ViewportInput = { innerWidth: globalThis.innerWidth || 1024, innerHeight: globalThis.innerHeight || 768 },
  padding: number = 8
): AdjustedPosition {
  let left = pos.x;
  let top = pos.y;

  const overflowRight = pos.x + dim.width > viewport.innerWidth - padding;
  const overflowBottom = pos.y + dim.height > viewport.innerHeight - padding;

  if (overflowRight) {
    left = pos.x - dim.width;
  }

  if (overflowBottom) {
    top = pos.y - dim.height;
  }

  // Ensure menu stays within safety margins of viewport
  const maxLeft = Math.max(padding, viewport.innerWidth - dim.width - padding);
  const maxTop = Math.max(padding, viewport.innerHeight - dim.height - padding);

  left = Math.max(padding, Math.min(left, maxLeft));
  top = Math.max(padding, Math.min(top, maxTop));

  return { left, top };
}

/**
 * React hook to dynamically measure context menu element dimensions
 * and adjust its absolute position ({ left, top }) away from screen edges.
 */
export function useContextMenuPosition(
  x: number,
  y: number,
  ref: RefObject<HTMLElement | null>,
  padding: number = 8
): AdjustedPosition {
  const [position, setPosition] = useState<AdjustedPosition>({ left: x, top: y });

  useLayoutEffect(() => {
    if (!ref.current) {
      setPosition({ left: x, top: y });
      return;
    }

    const rect = ref.current.getBoundingClientRect();
    const adjusted = adjustContextMenuPosition(
      { x, y },
      { width: rect.width, height: rect.height },
      { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
      padding
    );

    setPosition(adjusted);
  }, [x, y, ref, padding]);

  return position;
}
