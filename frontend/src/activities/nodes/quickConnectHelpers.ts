import { Node, Edge } from '@xyflow/react';
import { getAbsPos } from '@/lib/utils';
import { resolveNodeNamespace } from '@/lib/namespaceUtils';
import { getConnectionError } from '@/constants/connections';

export type QuickConnectDirection = 'top' | 'bottom' | 'left' | 'right';

export interface QuickConnectCandidateResult {
  targetNode: Node;
  edgeSource: Node;
  edgeTarget: Node;
}

export const getNodeAbsCenter = (node: Node, nodes: Node[]) => {
  const absPos = getAbsPos(node.id, nodes);
  return {
    x: absPos.x + (node.measured?.width || node.width || 150) / 2,
    y: absPos.y + (node.measured?.height || node.height || 100) / 2,
  };
};

export const isDirectionMatch = (
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
  direction: QuickConnectDirection
): boolean => {
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (direction === 'right') return angle >= -60 && angle <= 60;
  if (direction === 'bottom') return angle >= 30 && angle <= 150;
  if (direction === 'left') return angle >= 120 || angle <= -120;
  if (direction === 'top') return angle >= -150 && angle <= -30;
  return false;
};

export const canConnectRule = (
  sourceNode: Node,
  targetNode: Node,
  nodes: Node[]
): boolean => {
  if (!sourceNode.type || !targetNode.type) return false;
  if (targetNode.id === sourceNode.id) return false;
  if (targetNode.type === 'Namespace' || sourceNode.type === 'Namespace') return false;

  const sourceNamespace = resolveNodeNamespace(sourceNode, nodes);
  const targetNamespace = resolveNodeNamespace(targetNode, nodes);

  // Internet can connect to Service (even if default ClusterIP, it will be promoted to LoadBalancer)
  if (sourceNode.type === 'Internet' && targetNode.type === 'Service') {
    return true;
  }

  return (
    getConnectionError(
      sourceNode.type,
      targetNode.type,
      sourceNode.data,
      targetNode.data,
      sourceNamespace,
      targetNamespace
    ) === null
  );
};

export const checkValidConnectionDirection = (
  nodeA: Node,
  nodeB: Node,
  nodes: Node[]
): { edgeSource: Node; edgeTarget: Node } | null => {
  if (canConnectRule(nodeA, nodeB, nodes)) {
    return { edgeSource: nodeA, edgeTarget: nodeB };
  }
  if (canConnectRule(nodeB, nodeA, nodes)) {
    return { edgeSource: nodeB, edgeTarget: nodeA };
  }
  return null;
};

export const isNodeInDirection = (
  sourceNode: Node,
  targetNode: Node,
  direction: QuickConnectDirection,
  nodes: Node[]
): boolean => {
  if (!sourceNode.type || !targetNode.type) return false;
  if (targetNode.id === sourceNode.id) return false;
  if (targetNode.type === 'Namespace') return false;
  if (targetNode.parentId && targetNode.type === 'Pod') return false;

  const sourceCenter = getNodeAbsCenter(sourceNode, nodes);
  const targetCenter = getNodeAbsCenter(targetNode, nodes);

  if (!isDirectionMatch(sourceCenter, targetCenter, direction)) {
    return false;
  }

  return checkValidConnectionDirection(sourceNode, targetNode, nodes) !== null;
};

export const getQuickConnectHandles = (direction: QuickConnectDirection) => {
  if (direction === 'right') return { sourceHandle: 'right-s', targetHandle: 'left-t' };
  if (direction === 'left') return { sourceHandle: 'left-s', targetHandle: 'right-t' };
  if (direction === 'top') return { sourceHandle: 'top-s', targetHandle: 'bottom-t' };
  return { sourceHandle: 'bottom-s', targetHandle: 'top-t' };
};

export const resolveEdgeHandlesByPosition = (
  sourceNode?: Node,
  targetNode?: Node,
  nodes: Node[] = []
): { sourceHandle: string; targetHandle: string } => {
  if (!sourceNode || !targetNode) {
    return { sourceHandle: 'right-s', targetHandle: 'left-t' };
  }
  const sourceCenter = getNodeAbsCenter(sourceNode, nodes);
  const targetCenter = getNodeAbsCenter(targetNode, nodes);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (angle >= -45 && angle <= 45) return { sourceHandle: 'right-s', targetHandle: 'left-t' };
  if (angle > 45 && angle <= 135) return { sourceHandle: 'bottom-s', targetHandle: 'top-t' };
  if (angle > 135 || angle <= -135) return { sourceHandle: 'left-s', targetHandle: 'right-t' };
  return { sourceHandle: 'top-s', targetHandle: 'bottom-t' };
};

export const findBestCandidateInDirection = (
  sourceNode: Node,
  direction: QuickConnectDirection,
  nodes: Node[],
  edges: Edge[] = []
): QuickConnectCandidateResult | null => {
  const candidates = nodes.filter((n) => isNodeInDirection(sourceNode, n, direction, nodes));
  if (candidates.length === 0) return null;

  const sourceCenter = getNodeAbsCenter(sourceNode, nodes);

  const getDistanceSq = (n: Node) => {
    const center = getNodeAbsCenter(n, nodes);
    return Math.pow(center.x - sourceCenter.x, 2) + Math.pow(center.y - sourceCenter.y, 2);
  };

  const sorted = [...candidates].sort((a, b) => getDistanceSq(a) - getDistanceSq(b));

  const isConnectedWithSource = (candidateId: string) =>
    edges.some(
      (e) =>
        (e.source === sourceNode.id && e.target === candidateId) ||
        (e.source === candidateId && e.target === sourceNode.id)
    );

  const bestNode = sorted.find((n) => !isConnectedWithSource(n.id)) || sorted[0];
  const validDirection = checkValidConnectionDirection(sourceNode, bestNode, nodes);
  if (!validDirection) return null;

  return {
    targetNode: bestNode,
    edgeSource: validDirection.edgeSource,
    edgeTarget: validDirection.edgeTarget,
  };
};
