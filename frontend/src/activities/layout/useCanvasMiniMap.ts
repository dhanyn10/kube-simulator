import { useFlowStore } from '@/store';
import type { MiniMapPosition } from '@/store/slices/createUiSlice';

/**
 * Custom hook providing state and position transition handlers for the canvas MiniMap component.
 *
 * @returns Object containing current minimapPosition, colorMode, and moveToPosition helper function.
 */
export function useCanvasMiniMap() {
  const minimapPosition = useFlowStore((state) => state.minimapPosition ?? 'bottom-right');
  const setMinimapPosition = useFlowStore((state) => state.setMinimapPosition);
  const colorMode = useFlowStore((state) => state.colorMode);

  const moveToPosition = (pos: MiniMapPosition) => {
    if (setMinimapPosition) {
      setMinimapPosition(pos);
    }
  };

  return {
    minimapPosition,
    colorMode,
    moveToPosition,
  };
}
