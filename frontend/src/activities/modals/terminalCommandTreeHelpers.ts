export interface CommandTreeNode {
  id: string;
  name: string;
  command?: string;
  description?: string;
  children?: CommandTreeNode[];
}

export const COMMAND_TREE_DATA: CommandTreeNode[] = [
  {
    id: 'kubectl',
    name: 'kubectl',
    description: 'Kubernetes command-line tool',
    children: [
      {
        id: 'kubectl-get',
        name: 'get',
        description: 'Display one or many resources',
        children: [
          { id: 'kubectl-get-pods', name: 'pods', command: 'kubectl get pods', description: 'List all pods on canvas' },
          { id: 'kubectl-get-deployments', name: 'deployments', command: 'kubectl get deployments', description: 'List deployments on canvas' },
          { id: 'kubectl-get-services', name: 'services', command: 'kubectl get services', description: 'List services on canvas' },
          { id: 'kubectl-get-roles', name: 'roles', command: 'kubectl get roles', description: 'List roles on canvas' },
          { id: 'kubectl-get-rolebindings', name: 'rolebindings', command: 'kubectl get rolebindings', description: 'List rolebindings on canvas' },
          { id: 'kubectl-get-configmaps', name: 'configmaps', command: 'kubectl get configmaps', description: 'List configmaps on canvas' },
          { id: 'kubectl-get-secrets', name: 'secrets', command: 'kubectl get secrets', description: 'List secrets on canvas' },
          { id: 'kubectl-get-all', name: 'all', command: 'kubectl get all', description: 'List all resources on canvas' },
        ]
      },
      {
        id: 'kubectl-describe',
        name: 'describe',
        description: 'Show details of a specific resource',
        children: [
          { id: 'kubectl-describe-deploy', name: 'deploy', command: 'kubectl describe deploy ', description: 'Describe deployment specs' },
          { id: 'kubectl-describe-pod', name: 'pod', command: 'kubectl describe pod ', description: 'Describe pod specs & events' },
          { id: 'kubectl-describe-role', name: 'role', command: 'kubectl describe role ', description: 'Describe role specs & rules' },
          { id: 'kubectl-describe-rolebinding', name: 'rolebinding', command: 'kubectl describe rolebinding ', description: 'Describe rolebinding specs & subjects' },
          { id: 'kubectl-describe-cm', name: 'cm', command: 'kubectl describe cm ', description: 'Describe configmap data' },
          { id: 'kubectl-describe-secret', name: 'secret', command: 'kubectl describe secret ', description: 'Describe secret data' },
        ]
      },
      {
        id: 'kubectl-logs',
        name: 'logs',
        description: 'Print logs for a container in a pod',
        children: [
          { id: 'kubectl-logs-pod', name: '<pod-name>', command: 'kubectl logs ', description: 'Stream container logs for a pod' },
        ]
      },
      {
        id: 'kubectl-config',
        name: 'config',
        description: 'Modify kubeconfig files and user contexts',
        children: [
          { id: 'kubectl-config-get-contexts', name: 'get-contexts', command: 'kubectl config get-contexts', description: 'List all available user contexts' },
          { id: 'kubectl-config-current-context', name: 'current-context', command: 'kubectl config current-context', description: 'Display current user context' },
          { id: 'kubectl-config-view', name: 'view', command: 'kubectl config view', description: 'Display merged kubeconfig settings' },
          { id: 'kubectl-config-use-context', name: 'use-context', command: 'kubectl config use-context ', description: 'Set current-context in kubeconfig' },
        ]
      },
      {
        id: 'kubectl-scale',
        name: 'scale',
        description: 'Set a new size for a deployment',
        children: [
          { id: 'kubectl-scale-deployment', name: 'deployment/', command: 'kubectl scale deployment/ --replicas=3', description: 'Scale deployment replicas' },
        ]
      },
      {
        id: 'kubectl-set',
        name: 'set',
        description: 'Configure application resources',
        children: [
          {
            id: 'kubectl-set-image',
            name: 'image',
            description: 'Update image of a deployment',
            children: [
              { id: 'kubectl-set-image-deployment', name: 'deployment/', command: 'kubectl set image deployment/ app-container=nginx:1.25', description: 'Set container image for deployment' }
            ]
          }
        ]
      },
      {
        id: 'kubectl-rollout',
        name: 'rollout',
        description: 'Manage the rollout of a resource',
        children: [
          { id: 'kubectl-rollout-status', name: 'status', command: 'kubectl rollout status deploy/', description: 'Check rolling update progress' },
          { id: 'kubectl-rollout-history', name: 'history', command: 'kubectl rollout history deploy/', description: 'View revision history' },
          { id: 'kubectl-rollout-undo', name: 'undo', command: 'kubectl rollout undo deploy/', description: 'Rollback to previous revision' },
        ]
      },
      {
        id: 'kubectl-delete',
        name: 'delete',
        description: 'Delete resources by resource and name',
        children: [
          { id: 'kubectl-delete-pod', name: 'pod', command: 'kubectl delete pod ', description: 'Delete a pod' },
          { id: 'kubectl-delete-deployment', name: 'deployment', command: 'kubectl delete deployment ', description: 'Delete a deployment' },
          { id: 'kubectl-delete-service', name: 'service', command: 'kubectl delete service ', description: 'Delete a service' },
        ]
      },
      {
        id: 'kubectl-apply',
        name: 'apply',
        description: 'Apply configuration from a manifest file',
        children: [
          { id: 'kubectl-apply-f', name: '-f k8s-manifest.yaml', command: 'kubectl apply -f k8s-manifest.yaml', description: 'Apply all resources defined in manifest' },
        ]
      }
    ]
  },
  { id: 'util-help', name: 'help', command: 'help', description: 'Show help and available commands' },
  { id: 'util-history', name: 'history', command: 'history', description: 'View command execution history' },
  { id: 'util-clear', name: 'clear', command: 'clear', description: 'Clear terminal output' },
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
