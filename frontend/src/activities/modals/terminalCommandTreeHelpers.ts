export interface CommandTreeNode {
  id: string;
  name: string;
  command?: string;
  description?: string;
  children?: CommandTreeNode[];
}

const createNode = (
  id: string,
  name: string,
  description?: string,
  command?: string,
  children?: CommandTreeNode[]
): CommandTreeNode => ({
  id,
  name,
  ...(description ? { description } : {}),
  ...(command ? { command } : {}),
  ...(children ? { children } : {}),
});

export const COMMAND_TREE_DATA: CommandTreeNode[] = [
  createNode('kubectl', 'kubectl', 'Kubernetes command-line tool', undefined, [
    createNode('kubectl-get', 'get', 'Display one or many resources', undefined, [
      createNode('kubectl-get-pods', 'pods', 'List all pods on canvas', 'kubectl get pods'),
      createNode('kubectl-get-deployments', 'deployments', 'List deployments on canvas', 'kubectl get deployments'),
      createNode('kubectl-get-services', 'services', 'List services on canvas', 'kubectl get services'),
      createNode('kubectl-get-roles', 'roles', 'List roles on canvas', 'kubectl get roles'),
      createNode('kubectl-get-rolebindings', 'rolebindings', 'List rolebindings on canvas', 'kubectl get rolebindings'),
      createNode('kubectl-get-configmaps', 'configmaps', 'List configmaps on canvas', 'kubectl get configmaps'),
      createNode('kubectl-get-secrets', 'secrets', 'List secrets on canvas', 'kubectl get secrets'),
      createNode('kubectl-get-all', 'all', 'List all resources on canvas', 'kubectl get all'),
    ]),
    createNode('kubectl-describe', 'describe', 'Show details of a specific resource', undefined, [
      createNode('kubectl-describe-deploy', 'deploy', 'Describe deployment specs', 'kubectl describe deploy '),
      createNode('kubectl-describe-pod', 'pod', 'Describe pod specs & events', 'kubectl describe pod '),
      createNode('kubectl-describe-role', 'role', 'Describe role specs & rules', 'kubectl describe role '),
      createNode('kubectl-describe-rolebinding', 'rolebinding', 'Describe rolebinding specs & subjects', 'kubectl describe rolebinding '),
      createNode('kubectl-describe-cm', 'cm', 'Describe configmap data', 'kubectl describe cm '),
      createNode('kubectl-describe-secret', 'secret', 'Describe secret data', 'kubectl describe secret '),
    ]),
    createNode('kubectl-logs', 'logs', 'Print logs for a container in a pod', undefined, [
      createNode('kubectl-logs-pod', '<pod-name>', 'Stream container logs for a pod', 'kubectl logs '),
    ]),
    createNode('kubectl-config', 'config', 'Modify kubeconfig files and user contexts', undefined, [
      createNode('kubectl-config-get-contexts', 'get-contexts', 'List all available user contexts', 'kubectl config get-contexts'),
      createNode('kubectl-config-current-context', 'current-context', 'Display current user context', 'kubectl config current-context'),
      createNode('kubectl-config-view', 'view', 'Display merged kubeconfig settings', 'kubectl config view'),
      createNode('kubectl-config-use-context', 'use-context', 'Set current-context in kubeconfig', 'kubectl config use-context '),
    ]),
    createNode('kubectl-scale', 'scale', 'Set a new size for a deployment', undefined, [
      createNode('kubectl-scale-deployment', 'deployment/', 'Scale deployment replicas', 'kubectl scale deployment/ --replicas=3'),
    ]),
    createNode('kubectl-set', 'set', 'Configure application resources', undefined, [
      createNode('kubectl-set-image', 'image', 'Update image of a deployment', undefined, [
        createNode('kubectl-set-image-deployment', 'deployment/', 'Set container image for deployment', 'kubectl set image deployment/ app-container=nginx:1.25'),
      ]),
    ]),
    createNode('kubectl-rollout', 'rollout', 'Manage the rollout of a resource', undefined, [
      createNode('kubectl-rollout-status', 'status', 'Check rolling update progress', 'kubectl rollout status deploy/'),
      createNode('kubectl-rollout-history', 'history', 'View revision history', 'kubectl rollout history deploy/'),
      createNode('kubectl-rollout-undo', 'undo', 'Rollback to previous revision', 'kubectl rollout undo deploy/'),
    ]),
    createNode('kubectl-delete', 'delete', 'Delete resources by resource and name', undefined, [
      createNode('kubectl-delete-pod', 'pod', 'Delete a pod', 'kubectl delete pod '),
      createNode('kubectl-delete-deployment', 'deployment', 'Delete a deployment', 'kubectl delete deployment '),
      createNode('kubectl-delete-service', 'service', 'Delete a service', 'kubectl delete service '),
    ]),
    createNode('kubectl-apply', 'apply', 'Apply configuration from a manifest file', undefined, [
      createNode('kubectl-apply-f', '-f k8s-manifest.yaml', 'Apply all resources defined in manifest', 'kubectl apply -f k8s-manifest.yaml'),
    ]),
  ]),
  createNode('util-help', 'help', 'Show help and available commands', 'help'),
  createNode('util-history', 'history', 'View command execution history', 'history'),
  createNode('util-clear', 'clear', 'Clear terminal output', 'clear'),
];

export const filterCommandTree = (nodes: CommandTreeNode[], search: string): CommandTreeNode[] => {
  if (!search.trim()) return nodes;
  const term = search.toLowerCase();

  return nodes.reduce<CommandTreeNode[]>((acc, node) => {
    const isNameMatch = node.name.toLowerCase().includes(term);
    const isCommandMatch = node.command ? node.command.toLowerCase().includes(term) : false;
    const isDescMatch = node.description ? node.description.toLowerCase().includes(term) : false;

    const filteredChildren = node.children ? filterCommandTree(node.children, term) : [];

    if (isNameMatch || isCommandMatch || isDescMatch || filteredChildren.length > 0) {
      acc.push({
        ...node,
        ...(filteredChildren.length > 0 ? { children: filteredChildren } : {})
      });
    }
    return acc;
  }, []);
};

export const getAllNodeIds = (nodes: CommandTreeNode[]): string[] => {
  let ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children) {
      ids = ids.concat(getAllNodeIds(node.children));
    }
  }
  return ids;
};
