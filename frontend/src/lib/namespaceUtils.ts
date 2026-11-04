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
  let currentNode: Node | undefined = node;
  let currentParentId = currentNode.parentId || currentNode.data?.parentId;
  while (currentParentId) {
    const parentNode = nodes.find((candidateNode) => candidateNode.id === currentParentId);
    if (!parentNode) {
      return String(currentParentId);
    }
    if (parentNode.type === 'Namespace') {
      return String(parentNode.data?.label || parentNode.data?.name || parentNode.id);
    }
    currentNode = parentNode;
    currentParentId = currentNode.parentId || currentNode.data?.parentId;
  }
  return 'default';
};
