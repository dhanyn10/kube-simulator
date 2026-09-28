import { Node, Edge } from '@xyflow/react';

/**
 * Checks whether a target node has a Resource Limit attached, connected, or defined.
 *
 * @param targetNode The canvas node to inspect.
 * @param nodes List of canvas nodes.
 * @param edges List of canvas edges.
 * @returns boolean True if target node has a Resource Limit.
 */
export function hasResourceLimitAttachedOrConnected(
  targetNode: Node | undefined | null,
  nodes: Node[],
  edges: Edge[]
): boolean {
  if (!targetNode) return false;

  const data = targetNode.data as any;
  if (!data) return false;

  // Check 1: Attached Resource Limits array in data
  if (Array.isArray(data.resourceLimits) && data.resourceLimits.length > 0) {
    return true;
  }

  // Check 2: Explicit cpuLimit/cpuRequest properties set on data
  if (data.cpuLimit || data.cpuRequest || data.memoryLimit || data.memoryRequest) {
    return true;
  }

  // Check 3: Connected ResourceLimit node via edge
  const hasConnectedResourceLimitNode = edges.some(
    (e) => e.target === targetNode.id && nodes.find((n) => n.id === e.source)?.type === 'ResourceLimit'
  );
  if (hasConnectedResourceLimitNode) {
    return true;
  }

  return false;
}
