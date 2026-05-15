import { useFlowStore } from '../store';

export const useNodeStyles = (id: string) => {
  const draggedNodeId = useFlowStore((state) => state.draggedNodeId);

  const isSelfDragged = draggedNodeId === id;
  const isAnyNodeDragged = !!draggedNodeId;

  // CSS transition for soft movement.
  // We only want positional transitions if ANOTHER node is being dragged (pushed by collision).
  // If we are dragging ourselves, we want 0 transition for responsiveness.
  const transitionClasses = isAnyNodeDragged && !isSelfDragged
    ? "transition-[transform,left,top,width,height] duration-300 ease-out"
    : "transition-none";

  return {
    isSelfDragged,
    isAnyNodeDragged,
    transitionClasses
  };
};
