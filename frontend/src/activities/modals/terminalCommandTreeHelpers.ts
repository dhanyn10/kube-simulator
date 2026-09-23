export interface CommandTreeNode {
  id: string;
  name: string;
  command?: string;
  description?: string;
  children?: CommandTreeNode[];
}

type LeafSpec = [string, string, string, string?];
type ParentSpec = [string, string, string, (LeafSpec | [string, string, string, undefined, LeafSpec[]])[]];

const makeLeaf = ([id, name, description, command]: LeafSpec): CommandTreeNode => ({
  id,
  name,
  description,
  ...(command ? { command } : {}),
});

const getLeafs = (items: LeafSpec[]): CommandTreeNode[] => items.map(makeLeaf);

const GET_LEAFS: LeafSpec[] = [
  ['kubectl-get-pods', 'pods', 'List all pods on canvas', 'kubectl get pods'],
  ['kubectl-get-deployments', 'deployments', 'List deployments on canvas', 'kubectl get deployments'],
  ['kubectl-get-services', 'services', 'List services on canvas', 'kubectl get services'],
  ['kubectl-get-roles', 'roles', 'List roles on canvas', 'kubectl get roles'],
  ['kubectl-get-rolebindings', 'rolebindings', 'List rolebindings on canvas', 'kubectl get rolebindings'],
  ['kubectl-get-configmaps', 'configmaps', 'List configmaps on canvas', 'kubectl get configmaps'],
  ['kubectl-get-secrets', 'secrets', 'List secrets on canvas', 'kubectl get secrets'],
  ['kubectl-get-all', 'all', 'List all resources on canvas', 'kubectl get all'],
];

const DESCRIBE_LEAFS: LeafSpec[] = [
  ['kubectl-describe-deploy', 'deploy', 'Describe deployment specs', 'kubectl describe deploy '],
  ['kubectl-describe-pod', 'pod', 'Describe pod specs & events', 'kubectl describe pod '],
  ['kubectl-describe-role', 'role', 'Describe role specs & rules', 'kubectl describe role '],
  ['kubectl-describe-rolebinding', 'rolebinding', 'Describe rolebinding specs & subjects', 'kubectl describe rolebinding '],
  ['kubectl-describe-cm', 'cm', 'Describe configmap data', 'kubectl describe cm '],
  ['kubectl-describe-secret', 'secret', 'Describe secret data', 'kubectl describe secret '],
];

const CONFIG_LEAFS: LeafSpec[] = [
  ['kubectl-config-get-contexts', 'get-contexts', 'List all available user contexts', 'kubectl config get-contexts'],
  ['kubectl-config-current-context', 'current-context', 'Display current user context', 'kubectl config current-context'],
  ['kubectl-config-view', 'view', 'Display merged kubeconfig settings', 'kubectl config view'],
  ['kubectl-config-use-context', 'use-context', 'Set current-context in kubeconfig', 'kubectl config use-context '],
];

const ROLLOUT_LEAFS: LeafSpec[] = [
  ['kubectl-rollout-status', 'status', 'Check rolling update progress', 'kubectl rollout status deploy/'],
  ['kubectl-rollout-history', 'history', 'View revision history', 'kubectl rollout history deploy/'],
  ['kubectl-rollout-undo', 'undo', 'Rollback to previous revision', 'kubectl rollout undo deploy/'],
];

const DELETE_LEAFS: LeafSpec[] = [
  ['kubectl-delete-pod', 'pod', 'Delete a pod', 'kubectl delete pod '],
  ['kubectl-delete-deployment', 'deployment', 'Delete a deployment', 'kubectl delete deployment '],
  ['kubectl-delete-service', 'service', 'Delete a service', 'kubectl delete service '],
];

export const COMMAND_TREE_DATA: CommandTreeNode[] = [
  {
    id: 'kubectl',
    name: 'kubectl',
    description: 'Kubernetes command-line tool',
    children: [
      { id: 'kubectl-get', name: 'get', description: 'Display one or many resources', children: getLeafs(GET_LEAFS) },
      { id: 'kubectl-describe', name: 'describe', description: 'Show details of a specific resource', children: getLeafs(DESCRIBE_LEAFS) },
      { id: 'kubectl-logs', name: 'logs', description: 'Print logs for a container in a pod', children: getLeafs([['kubectl-logs-pod', '<pod-name>', 'Stream container logs for a pod', 'kubectl logs ']]) },
      { id: 'kubectl-config', name: 'config', description: 'Modify kubeconfig files and user contexts', children: getLeafs(CONFIG_LEAFS) },
      { id: 'kubectl-scale', name: 'scale', description: 'Set a new size for a deployment', children: getLeafs([['kubectl-scale-deployment', 'deployment/', 'Scale deployment replicas', 'kubectl scale deployment/ --replicas=3']]) },
      {
        id: 'kubectl-set',
        name: 'set',
        description: 'Configure application resources',
        children: [
          {
            id: 'kubectl-set-image',
            name: 'image',
            description: 'Update image of a deployment',
            children: getLeafs([['kubectl-set-image-deployment', 'deployment/', 'Set container image for deployment', 'kubectl set image deployment/ app-container=nginx:1.25']])
          }
        ]
      },
      { id: 'kubectl-rollout', name: 'rollout', description: 'Manage the rollout of a resource', children: getLeafs(ROLLOUT_LEAFS) },
      { id: 'kubectl-delete', name: 'delete', description: 'Delete resources by resource and name', children: getLeafs(DELETE_LEAFS) },
      { id: 'kubectl-apply', name: 'apply', description: 'Apply configuration from a manifest file', children: getLeafs([['kubectl-apply-f', '-f k8s-manifest.yaml', 'Apply all resources defined in manifest', 'kubectl apply -f k8s-manifest.yaml']]) },
    ]
  },
  ...getLeafs([
    ['util-help', 'help', 'Show help and available commands', 'help'],
    ['util-history', 'history', 'View command execution history', 'history'],
    ['util-clear', 'clear', 'Clear terminal output', 'clear'],
  ])
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
