import { useCallback } from 'react';
import { Node } from '@xyflow/react';
import { useFlowStore } from '../store';
import { POD_MIN_DIMENSIONS } from '../lib/podSizing';
import { K8sResourceType } from '../types';

const CENTER_OFFSETS: Record<K8sResourceType, { x: number; y: number }> = {
  Pod: { x: POD_MIN_DIMENSIONS.width / 2, y: POD_MIN_DIMENSIONS.height / 2 },
  Deployment: { x: 160, y: 80 },
  Service: { x: 90, y: 60 },
  Namespace: { x: 300, y: 200 },
  Internet: { x: 90, y: 60 },
  Ingress: { x: 100, y: 60 },
  HPA: { x: 90, y: 70 },
  PVC: { x: 90, y: 60 },
  ConfigMap: { x: 80, y: 50 },
  Secret: { x: 80, y: 50 },
  IAM: { x: 80, y: 50 },
};

const isChildTypeAllowed = (nodeType: string | undefined, childType: K8sResourceType): boolean => {
  if (childType === 'Pod') return nodeType === 'Deployment' || nodeType === 'Namespace';
  if (['Deployment', 'Service', 'Internet', 'Ingress', 'HPA', 'Role', 'ConfigMap', 'Secret'].includes(childType)) return nodeType === 'Namespace';
  return false;
};

const isPositionInsideNode = (position: { x: number; y: number }, n: Node, nodes: Node[]): boolean => {
  const w = n.width || n.measured?.width || (n.type === 'Deployment' ? 320 : 600);
  const h = n.height || n.measured?.height || (n.type === 'Deployment' ? 160 : 400);

  let absX = n.position.x;
  let absY = n.position.y;
  const parent = n.parentId ? nodes.find((p) => p.id === n.parentId) : undefined;
  if (parent) {
    absX += parent.position.x;
    absY += parent.position.y;
  }

  return position.x >= absX && position.x <= absX + w && position.y >= absY && position.y <= absY + h;
};

const WORKLOAD_ATTACHMENT_TARGETS = new Set(['Deployment', 'ReplicaSet', 'Pod']);

const findRoleTargetNode = (
  roleCenter: { x: number; y: number },
  nodes: Node[],
  itemType?: K8sResourceType | null
): Node | undefined => {
  const candidates = nodes.filter((n) => {
    if (!isPositionInsideNode(roleCenter, n, nodes)) return false;
    if (itemType === 'HPA') {
      return WORKLOAD_ATTACHMENT_TARGETS.has(n.type || '');
    }
    return true;
  });

  const sortedCandidates = [...candidates].sort((a, b) => {
    const areaA = (a.width || a.measured?.width || 200) * (a.height || a.measured?.height || 100);
    const areaB = (b.width || b.measured?.width || 200) * (b.height || b.measured?.height || 100);
    return areaA - areaB;
  });

  let targetNode = sortedCandidates[0];

  if (targetNode?.type === 'Pod' && targetNode.parentId) {
    const parentDep = nodes.find((p) => p.id === targetNode.parentId && (p.type === 'Deployment' || p.type === 'ReplicaSet'));
    if (parentDep) {
      targetNode = parentDep;
    }
  }

  return targetNode;
};

const computeFinalDropPosition = (
  centeredPosition: { x: number; y: number },
  targetContainer: Node | undefined,
  nodes: Node[]
): { x: number; y: number } => {
  if (!targetContainer) return centeredPosition;

  let absX = targetContainer.position.x;
  let absY = targetContainer.position.y;
  const p = targetContainer.parentId ? nodes.find((n) => n.id === targetContainer.parentId) : undefined;
  if (p) {
    absX += p.position.x;
    absY += p.position.y;
  }
  return { x: centeredPosition.x - absX, y: centeredPosition.y - absY };
};

export function useDropHandler(screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number }) {
  const nodes = useFlowStore((state) => state.nodes);
  const addNode = useFlowStore((state) => state.addNode);
  const setHoveredDeploymentId = useFlowStore((state) => state.setHoveredDeploymentId);
  const draggingSidebarItem = useFlowStore((state) => state.draggingSidebarItem);

  const getTargetContainer = useCallback(
    (clientX: number, clientY: number, childType: K8sResourceType): Node | undefined => {
      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const candidates = nodes.filter((n) => isChildTypeAllowed(n.type, childType));

      const sorted = [...candidates].sort(
        (a, b) => (a.width || 0) * (a.height || 0) - (b.width || 0) * (b.height || 0)
      );

      return sorted.find((n) => isPositionInsideNode(position, n, nodes));
    },
    [nodes, screenToFlowPosition]
  );

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';

      if (!draggingSidebarItem) return;

      if (draggingSidebarItem === 'Role' || draggingSidebarItem === 'ConfigMap' || draggingSidebarItem === 'Secret' || draggingSidebarItem === 'HPA') {
        const itemCenter = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const targetNode = findRoleTargetNode(itemCenter, nodes, draggingSidebarItem);

        setHoveredDeploymentId(targetNode?.id || null);
        useFlowStore.setState((state) => ({
          nodes: state.nodes.map((n) => ({
            ...n,
            data: { ...n.data, isHovered: n.id === targetNode?.id },
          })),
        }));
        return;
      }

      const target = getTargetContainer(event.clientX, event.clientY, draggingSidebarItem);
      setHoveredDeploymentId(target?.id || null);

      useFlowStore.setState((state) => ({
        nodes: state.nodes.map((n) => ({
          ...n,
          data: { ...n.data, isHovered: n.id === target?.id },
        })),
      }));
    },
    [getTargetContainer, setHoveredDeploymentId, draggingSidebarItem, screenToFlowPosition, nodes]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as K8sResourceType;
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      // Handle Role, ConfigMap, Secret, or HPA drop onto existing canvas card
      if (type === 'Role' || type === 'ConfigMap' || type === 'Secret' || type === 'HPA') {
        const itemCenter = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const targetNode = findRoleTargetNode(itemCenter, nodes, type);

        if (!targetNode) {
          const targetCardText = type === 'HPA' ? 'Deployment or ReplicaSet' : 'Deployment, Pod, Service';
          useFlowStore.getState().addLog('warn', `[Canvas Action] ${type} must be dropped onto an existing card (e.g. ${targetCardText}) to attach ${type.toLowerCase()}s!`, 'UI');
        } else if (type === 'Role') {
          useFlowStore.setState({
            roleModalTargetNode: { id: targetNode.id, label: targetNode.data?.label || targetNode.id }
          });
        } else if (type === 'ConfigMap') {
          useFlowStore.setState({
            configMapModalTargetNode: { id: targetNode.id, label: targetNode.data?.label || targetNode.id }
          });
        } else if (type === 'Secret') {
          useFlowStore.setState({
            secretModalTargetNode: { id: targetNode.id, label: targetNode.data?.label || targetNode.id }
          });
        } else {
          useFlowStore.setState({
            hpaModalTargetNode: { id: targetNode.id, label: targetNode.data?.label || targetNode.id }
          });
        }
        setHoveredDeploymentId(null);
        useFlowStore.setState((state) => ({
          nodes: state.nodes.map((n) => ({ ...n, data: { ...n.data, isHovered: false } })),
        }));
        return;
      }

      const offset = CENTER_OFFSETS[type] || { x: 0, y: 0 };
      const centeredPosition = { x: position.x - offset.x, y: position.y - offset.y };
      const targetContainer = getTargetContainer(event.clientX, event.clientY, type);

      const finalPosition = computeFinalDropPosition(centeredPosition, targetContainer, nodes);

      setHoveredDeploymentId(null);
      useFlowStore.setState((state) => ({
        nodes: state.nodes.map((n) => ({ ...n, data: { ...n.data, isHovered: false } })),
      }));

      addNode(type, finalPosition, targetContainer?.id);
    },
    [screenToFlowPosition, addNode, getTargetContainer, setHoveredDeploymentId, nodes]
  );

  const onDragLeave = useCallback(
    (event: React.DragEvent) => {
      if (event.currentTarget && !event.currentTarget.contains(event.relatedTarget as Node)) {
        setHoveredDeploymentId(null);
        useFlowStore.setState((state) => ({
          nodes: state.nodes.map((n) => (n.data?.isHovered ? { ...n, data: { ...n.data, isHovered: false } } : n)),
        }));
      }
    },
    [setHoveredDeploymentId]
  );

  return { onDragOver, onDragLeave, onDrop };
}
