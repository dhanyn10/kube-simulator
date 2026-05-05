import { useCallback } from 'react';
import { Node } from '@xyflow/react';
import { useFlowStore } from '../store';
import { POD_MIN_DIMENSIONS } from '../store/helpers';
import { K8sResourceType } from '../types';

const CENTER_OFFSETS: Record<K8sResourceType, { x: number; y: number }> = {
  Pod: { x: POD_MIN_DIMENSIONS.width / 2, y: POD_MIN_DIMENSIONS.height / 2 },
  Deployment: { x: 160, y: 80 },
  Service: { x: 90, y: 60 },
  Namespace: { x: 300, y: 200 },
  Internet: { x: 90, y: 60 },
  Ingress: { x: 100, y: 60 },
  HPA: { x: 90, y: 70 },
};

export function useDropHandler(screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number }) {
  const nodes = useFlowStore((state) => state.nodes);
  const addNode = useFlowStore((state) => state.addNode);
  const setHoveredDeploymentId = useFlowStore((state) => state.setHoveredDeploymentId);
  const draggingSidebarItem = useFlowStore((state) => state.draggingSidebarItem);

  const getTargetContainer = useCallback(
    (clientX: number, clientY: number, childType: K8sResourceType): Node | undefined => {
      const position = screenToFlowPosition({ x: clientX, y: clientY });

      const candidates = nodes.filter((n) => {
        if (childType === 'Pod') return n.type === 'Deployment' || n.type === 'Namespace';
        if (['Deployment', 'Service', 'Internet', 'Ingress', 'HPA'].includes(childType)) return n.type === 'Namespace';
        return false;
      });

      const sorted = [...candidates].sort(
        (a, b) => (a.width || 0) * (a.height || 0) - (b.width || 0) * (b.height || 0)
      );

      return sorted.find((n) => {
        const w = n.width || n.measured?.width || (n.type === 'Deployment' ? 320 : 600);
        const h = n.height || n.measured?.height || (n.type === 'Deployment' ? 160 : 400);

        let absX = n.position.x;
        let absY = n.position.y;
        if (n.parentId) {
          const parent = nodes.find((p) => p.id === n.parentId);
          if (parent) {
            absX += parent.position.x;
            absY += parent.position.y;
          }
        }

        return position.x >= absX && position.x <= absX + w && position.y >= absY && position.y <= absY + h;
      });
    },
    [nodes, screenToFlowPosition]
  );

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';

      if (draggingSidebarItem) {
        const target = getTargetContainer(event.clientX, event.clientY, draggingSidebarItem);
        setHoveredDeploymentId(target?.id || null);

        useFlowStore.setState((state: any) => ({
          nodes: state.nodes.map((n: any) =>
            n.id === target?.id
              ? { ...n, data: { ...n.data, isHovered: true } }
              : { ...n, data: { ...n.data, isHovered: false } }
          ),
        }));
      }
    },
    [getTargetContainer, setHoveredDeploymentId, draggingSidebarItem]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as K8sResourceType;
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const offset = CENTER_OFFSETS[type] || { x: 0, y: 0 };
      const centeredPosition = { x: position.x - offset.x, y: position.y - offset.y };

      const targetContainer = getTargetContainer(event.clientX, event.clientY, type);
      let finalPosition = centeredPosition;

      if (targetContainer) {
        let absX = targetContainer.position.x;
        let absY = targetContainer.position.y;
        if (targetContainer.parentId) {
          const p = nodes.find((n) => n.id === targetContainer.parentId);
          if (p) {
            absX += p.position.x;
            absY += p.position.y;
          }
        }
        finalPosition = { x: centeredPosition.x - absX, y: centeredPosition.y - absY };
      }

      setHoveredDeploymentId(null);
      useFlowStore.setState((state: any) => ({
        nodes: state.nodes.map((n: any) => ({ ...n, data: { ...n.data, isHovered: false } })),
      }));

      addNode(type, finalPosition, targetContainer?.id);
    },
    [screenToFlowPosition, addNode, getTargetContainer, setHoveredDeploymentId, nodes]
  );

  return { onDragOver, onDrop };
}
