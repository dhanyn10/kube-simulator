import { Node } from '@xyflow/react';

/**
 * Resolves the Kubernetes namespace for a given node, either from `node.data.namespace`
 * or by traversing parent hierarchy until reaching a Namespace container node.
 * Checks both `node.parentId` and `node.data?.parentId`.
 * Defaults to 'default' if no namespace is specified.
 */
export const resolveNodeNamespace = (node?: Node | null, nodes: Node[] = []): string => {
  if (!node) return 'default';
  if (node.data?.namespace) {
    return String(node.data.namespace);
  }
  let curr: Node | undefined = node;
  let currParentId = curr.parentId || curr.data?.parentId;
  while (currParentId) {
    const parent = nodes.find((n) => n.id === currParentId);
    if (!parent) {
      return String(currParentId);
    }
    if (parent.type === 'Namespace') {
      return String(parent.data?.label || parent.data?.name || parent.id);
    }
    curr = parent;
    currParentId = curr.parentId || curr.data?.parentId;
  }
  return 'default';
};
