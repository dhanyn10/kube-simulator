import { useReactFlow, getBezierPath } from '@xyflow/react';
import { useFlowStore } from '@/store';

/**
 * Helper function to check if a node or its children are not ready.
 */
export const checkNodeUnready = (node: any, nodes: any[]): boolean => {
  if (!node) return false;
  const isWorkload = node.type === 'Pod' || node.type === 'Deployment';
  if (isWorkload && node.data?.status !== 'ready') return true;

  if (node.type === 'Deployment') {
    const childPods = nodes.filter((n: any) => String(n.parentId) === String(node.id) && n.type === 'Pod');
    if (childPods.some((p: any) => p.data?.status !== 'ready')) return true;
  }
  return false;
};

/**
 * Checks downstream error state recursively along active simulation edges.
 */
export const checkDownstreamErrorState = (
  isSimulating: boolean,
  validationError: any,
  target: string,
  nodes: any[],
  edges: any[],
  activeSimulationEdges: string[]
): boolean => {
  if (!isSimulating || validationError) return false;

  const visited = new Set<string>();
  const queue = [target];

  while (queue.length > 0) {
    const currentId = String(queue.shift()!);
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = nodes.find((n: any) => String(n.id) === currentId);
    if (checkNodeUnready(node, nodes)) return true;

    const outgoingEdges = edges.filter((e: any) =>
      String(e.source) === currentId && activeSimulationEdges.some((eid) => String(eid) === String(e.id))
    );

    for (const edge of outgoingEdges) {
      queue.push(String(edge.target));
    }
  }
  return false;
};

/**
 * Finds the first downstream node that is unready.
 */
export const findDownstreamUnreadyNode = (
  targetId: string,
  nodes: any[],
  edges: any[],
  activeSimulationEdges: string[]
): any => {
  const visited = new Set<string>();
  const queue = [targetId];

  while (queue.length > 0) {
    const currentId = String(queue.shift()!);
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = nodes.find((n: any) => String(n.id) === currentId);
    if (node && checkNodeUnready(node, nodes)) {
      return node;
    }

    const outgoingEdges = edges.filter((e: any) =>
      String(e.source) === currentId && activeSimulationEdges.some((eid) => String(eid) === String(e.id))
    );

    for (const edge of outgoingEdges) {
      queue.push(String(edge.target));
    }
  }
  return nodes.find((n: any) => String(n.id) === targetId) || null;
};

/**
 * Resolves the target node for log viewing in Kube Console.
 */
export const getTargetLoggableNode = (
  targetId: string,
  isTargetError: boolean,
  nodes: any[],
  edges: any[],
  activeSimulationEdges: string[]
): any => {
  const targetNode = nodes.find((n: any) => String(n.id) === targetId);
  const unreadyNode = isTargetError
    ? findDownstreamUnreadyNode(targetId, nodes, edges, activeSimulationEdges)
    : targetNode;

  if (unreadyNode && ['Pod', 'Deployment', 'ReplicaSet'].includes(unreadyNode.type)) {
    return unreadyNode;
  }
  if (targetNode && ['Pod', 'Deployment', 'ReplicaSet'].includes(targetNode.type)) {
    return targetNode;
  }
  return null;
};

/**
 * Custom hook encapsulating state and business logic for CustomEdge.
 */
export const useCustomEdge = (props: {
  id: string;
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: any;
  targetPosition: any;
  data?: any;
}) => {
  const { setEdges } = useReactFlow();
  const toggleEdgeSettings = useFlowStore((state: any) => state.toggleEdgeSettings);
  const setConfiguringEdgeId = useFlowStore((state: any) => state.setConfiguringEdgeId);
  const configuringEdgeId = useFlowStore((state: any) => state.configuringEdgeId);
  const activeSimulationEdges = useFlowStore((state: any) => state.activeSimulationEdges);
  const nodes = useFlowStore((state: any) => state.nodes);
  const edges = useFlowStore((state: any) => state.edges);
  const globalEdgeColor = useFlowStore((state: any) => state.globalEdgeColor);
  const globalEdgeErrorColor = useFlowStore((state: any) => state.globalEdgeErrorColor);
  const setTerminalOpen = useFlowStore((state: any) => state.setTerminalOpen);
  const setTerminalActiveTab = useFlowStore((state: any) => state.setTerminalActiveTab);
  const setTerminalSelectedResourceId = useFlowStore((state: any) => state.setTerminalSelectedResourceId);
  const addActivityLog = useFlowStore((state: any) => state.addActivityLog);

  const isConfiguring = String(configuringEdgeId) === String(props.id);
  const isSimulating = activeSimulationEdges.some((eid: any) => String(eid) === String(props.id));
  const validationError = props.data?.validationError;

  const isTargetError = checkDownstreamErrorState(
    isSimulating,
    validationError,
    props.target,
    nodes,
    edges,
    activeSimulationEdges
  );

  const getStrokeColor = () => {
    if (validationError || isTargetError) return globalEdgeErrorColor;
    return globalEdgeColor;
  };

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  const edgeWidth = props.data?.width || 2;

  const onRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((prev) => prev.filter((edge) => edge.id !== props.id));
    if (isConfiguring) setConfiguringEdgeId(null);
  };

  const onSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleEdgeSettings(props.id);
  };

  const hasAlert = Boolean(validationError || isTargetError);
  const alertTooltip = validationError || 'Downstream target error / workload not ready';

  const onAlertClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTerminalOpen(true);

    const loggableNode = getTargetLoggableNode(props.target, isTargetError, nodes, edges, activeSimulationEdges);

    if (loggableNode) {
      setTerminalSelectedResourceId(loggableNode.id);
      setTerminalActiveTab('logs');
    } else {
      setTerminalActiveTab('activity');
    }

    const targetNode = nodes.find((n: any) => String(n.id) === props.target);
    const sourceNode = nodes.find((n: any) => String(n.id) === props.source);
    const sLabel = sourceNode?.data?.label || props.source;
    const tLabel = targetNode?.data?.label || props.target;

    if (validationError) {
      addActivityLog(`[Connection Alert] ${sLabel} -> ${tLabel}: ${validationError}`);
    } else if (isTargetError) {
      const unreadyNode = findDownstreamUnreadyNode(props.target, nodes, edges, activeSimulationEdges);
      const uLabel = unreadyNode?.data?.label || unreadyNode?.id || props.target;
      addActivityLog(`[Connection Alert] Downstream workload ${unreadyNode?.type?.toLowerCase() || 'resource'}/${uLabel} is not in ready state.`);
    }
  };

  return {
    isConfiguring,
    isSimulating,
    validationError,
    isTargetError,
    getStrokeColor,
    edgePath,
    labelX,
    labelY,
    edgeWidth,
    hasAlert,
    alertTooltip,
    onRemove,
    onSettings,
    onAlertClick,
  };
};
