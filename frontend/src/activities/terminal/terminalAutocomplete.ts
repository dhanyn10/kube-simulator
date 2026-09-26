import { Node } from '@xyflow/react';

export interface SuggestionItem {
  value: string;
  label: string;
  category: 'Command' | 'Subcommand' | 'Pod' | 'Deployment' | 'Service' | 'Utility' | 'Admin';
  description?: string;
  subItems?: string[];
  disabled?: boolean;
  disabledReason?: string;
}

export interface CommandSpecNode {
  name: string;
  category?: SuggestionItem['category'];
  description?: string;
  requiresResourceReason?: (nodes: Node[]) => string | null;
  children?: CommandSpecNode[];
  dynamicChildren?: (nodes: Node[]) => CommandSpecNode[];
  subItemsResolver?: (nodes: Node[]) => string[];
}

const NO_DEPLOYMENT_REASON = '(no Deployment on canvas)';
const NO_POD_REASON = '(no Pod on canvas)';
const NO_ROLE_REASON = '(no Role on canvas)';
const NO_ROLEBINDING_REASON = '(no RoleBinding on canvas)';
const NO_CONFIGMAP_REASON = '(no ConfigMap on canvas)';
const NO_SECRET_REASON = '(no Secret on canvas)';

const createItem = (
  value: string,
  label: string,
  category: SuggestionItem['category'],
  description: string,
  disabled = false,
  disabledReason?: string
): SuggestionItem => ({
  value,
  label,
  category,
  description,
  disabled,
  disabledReason,
});

const createSuggestionMap = (
  tuples: [string, string, SuggestionItem['category'], string][]
): SuggestionItem[] => {
  return tuples.map(([value, label, category, description]) =>
    createItem(value, label, category, description)
  );
};

export const ADMIN_SUGGESTIONS: SuggestionItem[] = createSuggestionMap([
  ['try version update 0.5.0', 'try version update <version>', 'Admin', 'Simulate update notification badge button'],
  ['try version current 0.4.0', 'try version current <version>', 'Admin', 'Simulate current application version'],
  ['try version clear', 'try version clear', 'Admin', 'Clear simulated current version'],
  ['try clear', 'try clear', 'Admin', 'Clear all simulated version settings'],
  ['try status', 'try status', 'Admin', 'View secret mode status'],
  ['logout', 'logout', 'Admin', 'Exit Admin Mode and return to standard CLI'],
]);

export const KUBECTL_TOP_COMMANDS: SuggestionItem[] = createSuggestionMap([
  ['kubectl get', 'kubectl get', 'Subcommand', 'Display one or many resources'],
  ['kubectl config', 'kubectl config', 'Subcommand', 'Modify kubeconfig files and user contexts'],
  ['kubectl logs', 'kubectl logs', 'Subcommand', 'Print the logs for a container in a pod'],
  ['kubectl describe', 'kubectl describe', 'Subcommand', 'Show details of a specific resource'],
  ['kubectl scale', 'kubectl scale', 'Subcommand', 'Set a new size for a Deployment'],
  ['kubectl set image', 'kubectl set image', 'Subcommand', 'Update image of a Deployment'],
  ['kubectl rollout', 'kubectl rollout', 'Subcommand', 'Manage the rollout of a resource'],
  ['kubectl delete', 'kubectl delete', 'Subcommand', 'Delete resources by resource and name'],
]);

export const CONFIG_SUBCOMMANDS: SuggestionItem[] = createSuggestionMap([
  ['kubectl config get-contexts', 'kubectl config get-contexts', 'Command', 'List all available user contexts'],
  ['kubectl config current-context', 'kubectl config current-context', 'Command', 'Display the current user context'],
  ['kubectl config view', 'kubectl config view', 'Command', 'Display merged kubeconfig settings'],
  ['kubectl config use-context ', 'kubectl config use-context <user>', 'Command', 'Set the current-context in kubeconfig'],
]);

export const GET_SUBCOMMANDS: SuggestionItem[] = createSuggestionMap([
  ['kubectl get pods', 'kubectl get pods', 'Command', 'List all pods on canvas'],
  ['kubectl get deployments', 'kubectl get deployments', 'Command', 'List deployments on canvas'],
  ['kubectl get services', 'kubectl get services', 'Command', 'List services on canvas'],
  ['kubectl get roles', 'kubectl get roles', 'Command', 'List roles on canvas'],
  ['kubectl get rolebindings', 'kubectl get rolebindings', 'Command', 'List rolebindings on canvas'],
  ['kubectl get configmaps', 'kubectl get configmaps', 'Command', 'List configmaps on canvas'],
  ['kubectl get secrets', 'kubectl get secrets', 'Command', 'List secrets on canvas'],
  ['kubectl get all', 'kubectl get all', 'Command', 'List all resources on canvas'],
]);

export const UTILITY_COMMANDS: SuggestionItem[] = createSuggestionMap([
  ['history', 'history', 'Utility', 'View command execution history'],
  ['help', 'help', 'Utility', 'Show help and available commands'],
  ['clear', 'clear', 'Utility', 'Clear terminal output'],
]);

export const getDeploymentNames = (nodes: Node[]): string[] => {
  return nodes.filter(n => n.type === 'Deployment').map(d => String(d.data?.label ?? d.id));
};

export const getPodNames = (nodes: Node[]): string[] => {
  return nodes.filter(n => n.type === 'Pod').map(p => String(p.data?.label ?? p.id));
};

const extractCanvasFieldNames = (nodes: Node[], fieldKey: string, suffix = ''): string[] => {
  const names: string[] = [];
  nodes.forEach((n) => {
    const list = n.data?.[fieldKey];
    if (Array.isArray(list)) {
      list.forEach((item: any) => {
        if (item?.name) names.push(item.name + suffix);
      });
    }
  });
  return Array.from(new Set(names));
};

export const getRoleBindingNames = (nodes: Node[]): string[] => extractCanvasFieldNames(nodes, 'roles', '-binding');
export const getRoleNames = (nodes: Node[]): string[] => extractCanvasFieldNames(nodes, 'roles');
export const getConfigMapNames = (nodes: Node[]): string[] => extractCanvasFieldNames(nodes, 'configMaps');
export const getSecretNames = (nodes: Node[]): string[] => extractCanvasFieldNames(nodes, 'secrets');

export const COMMAND_SPEC_TREE: CommandSpecNode[] = [
  {
    name: 'kubectl',
    category: 'Subcommand',
    description: 'Kubernetes CLI Tool',
    children: [
      {
        name: 'get',
        category: 'Subcommand',
        description: 'Display one or many resources',
        children: [
          { name: 'pods', category: 'Command', description: 'List all pods on canvas' },
          { name: 'deployments', category: 'Command', description: 'List deployments on canvas' },
          { name: 'services', category: 'Command', description: 'List services on canvas' },
          { name: 'roles', category: 'Command', description: 'List roles on canvas' },
          { name: 'rolebindings', category: 'Command', description: 'List rolebindings on canvas' },
          { name: 'configmaps', category: 'Command', description: 'List configmaps on canvas' },
          { name: 'secrets', category: 'Command', description: 'List secrets on canvas' },
          { name: 'all', category: 'Command', description: 'List all resources on canvas' },
        ],
      },
      {
        name: 'config',
        category: 'Subcommand',
        description: 'Modify kubeconfig files and user contexts',
        children: [
          { name: 'get-contexts', category: 'Command', description: 'List all available user contexts' },
          { name: 'current-context', category: 'Command', description: 'Display the current user context' },
          { name: 'view', category: 'Command', description: 'Display merged kubeconfig settings' },
          { name: 'use-context ', category: 'Command', description: 'Set the current-context in kubeconfig' },
        ],
      },
      {
        name: 'logs ',
        category: 'Subcommand',
        description: 'Print the logs for a container in a pod',
        requiresResourceReason: (nodes) => getPodNames(nodes).length === 0 ? NO_POD_REASON : null,
        subItemsResolver: (nodes) => getPodNames(nodes),
      },
      {
        name: 'describe',
        category: 'Subcommand',
        description: 'Show details of a specific resource',
        children: [
          {
            name: 'deploy ',
            category: 'Subcommand',
            description: 'Describe deployment specs',
            requiresResourceReason: (nodes) => getDeploymentNames(nodes).length === 0 ? NO_DEPLOYMENT_REASON : null,
            dynamicChildren: (nodes) => getDeploymentNames(nodes).map(n => ({ name: n, category: 'Deployment', description: `Describe ${n}` })),
          },
          {
            name: 'pod ',
            category: 'Subcommand',
            description: 'Describe pod specs & events',
            requiresResourceReason: (nodes) => getPodNames(nodes).length === 0 ? NO_POD_REASON : null,
            dynamicChildren: (nodes) => getPodNames(nodes).map(n => ({ name: n, category: 'Pod', description: `Describe ${n}` })),
          },
          {
            name: 'role ',
            category: 'Subcommand',
            description: 'Describe role specs & rules',
            requiresResourceReason: (nodes) => getRoleNames(nodes).length === 0 ? NO_ROLE_REASON : null,
            dynamicChildren: (nodes) => getRoleNames(nodes).map(n => ({ name: n, category: 'Command', description: `Describe ${n}` })),
          },
          {
            name: 'rolebinding ',
            category: 'Subcommand',
            description: 'Describe rolebinding specs & subjects',
            requiresResourceReason: (nodes) => getRoleBindingNames(nodes).length === 0 ? NO_ROLEBINDING_REASON : null,
            dynamicChildren: (nodes) => getRoleBindingNames(nodes).map(n => ({ name: n, category: 'Command', description: `Describe ${n}` })),
          },
          {
            name: 'cm ',
            category: 'Subcommand',
            description: 'Describe configmap data',
            requiresResourceReason: (nodes) => getConfigMapNames(nodes).length === 0 ? NO_CONFIGMAP_REASON : null,
            dynamicChildren: (nodes) => getConfigMapNames(nodes).map(n => ({ name: n, category: 'Command', description: `Describe ${n}` })),
          },
          {
            name: 'secret ',
            category: 'Subcommand',
            description: 'Describe secret data',
            requiresResourceReason: (nodes) => getSecretNames(nodes).length === 0 ? NO_SECRET_REASON : null,
            dynamicChildren: (nodes) => getSecretNames(nodes).map(n => ({ name: n, category: 'Command', description: `Describe ${n}` })),
          },
        ],
      },
      {
        name: 'scale',
        category: 'Subcommand',
        description: 'Set a new size for a Deployment',
        requiresResourceReason: (nodes) => getDeploymentNames(nodes).length === 0 ? NO_DEPLOYMENT_REASON : null,
        children: [
          {
            name: 'deployment/',
            category: 'Subcommand',
            description: 'Scale deployment replicas',
            dynamicChildren: (nodes) => getDeploymentNames(nodes).map(n => ({
              name: `${n} --replicas=3`,
              category: 'Deployment',
              description: `Scale deployment ${n}`,
            })),
          },
        ],
      },
      {
        name: 'set',
        category: 'Subcommand',
        description: 'Update image of a Deployment',
        requiresResourceReason: (nodes) => getDeploymentNames(nodes).length === 0 ? NO_DEPLOYMENT_REASON : null,
        children: [
          {
            name: 'image deployment/',
            category: 'Subcommand',
            description: 'Set container image',
            dynamicChildren: (nodes) => getDeploymentNames(nodes).map(n => ({
              name: `${n} app-container=nginx:1.25`,
              category: 'Deployment',
              description: `Set image for ${n}`,
            })),
          },
        ],
      },
      {
        name: 'rollout',
        category: 'Subcommand',
        description: 'Manage the rollout of a resource',
        requiresResourceReason: (nodes) => getDeploymentNames(nodes).length === 0 ? NO_DEPLOYMENT_REASON : null,
        children: [
          {
            name: 'status deploy/',
            category: 'Subcommand',
            description: 'Check rolling update progress',
            dynamicChildren: (nodes) => getDeploymentNames(nodes).map(n => ({ name: n, category: 'Deployment', description: `Check rollout status for ${n}` })),
          },
          {
            name: 'history deploy/',
            category: 'Subcommand',
            description: 'View revision history',
            dynamicChildren: (nodes) => getDeploymentNames(nodes).map(n => ({ name: n, category: 'Deployment', description: `View revision history for ${n}` })),
          },
          {
            name: 'undo deploy/',
            category: 'Subcommand',
            description: 'Rollback to previous revision',
            dynamicChildren: (nodes) => getDeploymentNames(nodes).map(n => ({ name: n, category: 'Deployment', description: `Undo rollout for ${n}` })),
          },
        ],
      },
      {
        name: 'delete',
        category: 'Subcommand',
        description: 'Delete resources by resource and name',
        children: [
          {
            name: 'pod ',
            category: 'Subcommand',
            description: 'Delete pod',
            requiresResourceReason: (nodes) => getPodNames(nodes).length === 0 ? NO_POD_REASON : null,
            dynamicChildren: (nodes) => getPodNames(nodes).map(n => ({ name: n, category: 'Pod', description: `Delete pod ${n}` })),
          },
          {
            name: 'deployment ',
            category: 'Subcommand',
            description: 'Delete deployment',
            requiresResourceReason: (nodes) => getDeploymentNames(nodes).length === 0 ? NO_DEPLOYMENT_REASON : null,
            dynamicChildren: (nodes) => getDeploymentNames(nodes).map(n => ({ name: n, category: 'Deployment', description: `Delete deployment ${n}` })),
          },
          {
            name: 'service ',
            category: 'Subcommand',
            description: 'Delete service',
          },
        ],
      },
    ],
  },
  { name: 'history', category: 'Utility', description: 'View command execution history' },
  { name: 'help', category: 'Utility', description: 'Show help and available commands' },
  { name: 'clear', category: 'Utility', description: 'Clear terminal output' },
];

export const ADMIN_SPEC_TREE: CommandSpecNode[] = [
  {
    name: 'try',
    category: 'Admin',
    description: 'Admin Simulation Commands',
    children: [
      {
        name: 'version',
        category: 'Admin',
        description: 'Simulate application versions',
        children: [
          { name: 'update 0.5.0', category: 'Admin', description: 'Simulate update notification badge button' },
          { name: 'current 0.4.0', category: 'Admin', description: 'Simulate current application version' },
          { name: 'clear', category: 'Admin', description: 'Clear simulated current version' },
        ],
      },
      { name: 'clear', category: 'Admin', description: 'Clear all simulated version settings' },
      { name: 'status', category: 'Admin', description: 'View secret mode status' },
    ],
  },
  { name: 'logout', category: 'Admin', description: 'Exit Admin Mode and return to standard CLI' },
];

const mapResourceItems = (
  names: string[],
  valuePattern: (n: string) => string,
  labelPattern: (n: string) => string,
  cat: SuggestionItem['category'],
  descPattern: (n: string) => string
): SuggestionItem[] => {
  return names.map(n => createItem(valuePattern(n), labelPattern(n), cat, descPattern(n)));
};

const getRolloutCandidates = (sub: string, deployNames: string[]): SuggestionItem[] => {
  if (!('rollout'.startsWith(sub))) return [];
  if (deployNames.length === 0) {
    return [createItem('kubectl rollout status deploy/', 'kubectl rollout status deploy/', 'Command', 'Check rolling update progress', true, NO_DEPLOYMENT_REASON)];
  }
  const items: SuggestionItem[] = [];
  deployNames.forEach(n => {
    items.push(
      createItem(`kubectl rollout status deploy/${n}`, `kubectl rollout status deploy/${n}`, 'Command', 'Check rolling update progress'),
      createItem(`kubectl rollout history deploy/${n}`, `kubectl rollout history deploy/${n}`, 'Command', 'View revision history'),
      createItem(`kubectl rollout undo deploy/${n}`, `kubectl rollout undo deploy/${n}`, 'Command', 'Rollback to previous revision')
    );
  });
  return items;
};

const getLogsCandidates = (sub: string, hasPods: boolean, podNames: string[]): SuggestionItem[] => {
  if (!('logs'.startsWith(sub))) return [];
  return [{
    ...createItem('kubectl logs ', 'kubectl logs <pod-name>', 'Subcommand', 'Stream container logs', !hasPods, !hasPods ? NO_POD_REASON : undefined),
    subItems: podNames,
  }];
};

const getDescribeCandidates = (sub: string, deployNames: string[], podNames: string[], nodes: Node[]): SuggestionItem[] => {
  if (!('describe'.startsWith(sub))) return [];
  const hasDeploys = deployNames.length > 0;
  const hasPods = podNames.length > 0;
  const hasRbs = getRoleBindingNames(nodes).length > 0;
  const hasRoles = getRoleNames(nodes).length > 0;
  const hasCms = getConfigMapNames(nodes).length > 0;
  const hasSecrets = getSecretNames(nodes).length > 0;

  return [
    createItem('kubectl describe deploy ', 'kubectl describe deploy', 'Subcommand', 'Describe deployment specs', !hasDeploys, !hasDeploys ? NO_DEPLOYMENT_REASON : undefined),
    createItem('kubectl describe pod ', 'kubectl describe pod', 'Subcommand', 'Describe pod specs & events', !hasPods, !hasPods ? NO_POD_REASON : undefined),
    createItem('kubectl describe role ', 'kubectl describe role', 'Subcommand', 'Describe role specs & rules', !hasRoles, !hasRoles ? NO_ROLE_REASON : undefined),
    createItem('kubectl describe rolebinding ', 'kubectl describe rolebinding', 'Subcommand', 'Describe rolebinding specs & subjects', !hasRbs, !hasRbs ? NO_ROLEBINDING_REASON : undefined),
    createItem('kubectl describe cm ', 'kubectl describe cm', 'Subcommand', 'Describe configmap data', !hasCms, !hasCms ? NO_CONFIGMAP_REASON : undefined),
    createItem('kubectl describe secret ', 'kubectl describe secret', 'Subcommand', 'Describe secret data', !hasSecrets, !hasSecrets ? NO_SECRET_REASON : undefined)
  ];
};

const getScaleCandidates = (sub: string, deployNames: string[]): SuggestionItem[] => {
  if (!('scale'.startsWith(sub))) return [];
  if (deployNames.length === 0) {
    return [createItem('kubectl scale deployment/', 'kubectl scale deployment/', 'Subcommand', 'Scale deployment replicas', true, NO_DEPLOYMENT_REASON)];
  }
  return mapResourceItems(
    deployNames,
    n => `kubectl scale deployment/${n} --replicas=3`,
    n => `kubectl scale deployment/${n} --replicas=3`,
    'Subcommand',
    n => `Scale deployment ${n}`
  );
};

const getSetCandidates = (sub: string, deployNames: string[]): SuggestionItem[] => {
  if (!('set'.startsWith(sub))) return [];
  if (deployNames.length === 0) {
    return [createItem('kubectl set image deployment/', 'kubectl set image deployment/', 'Subcommand', 'Set container image', true, NO_DEPLOYMENT_REASON)];
  }
  return mapResourceItems(
    deployNames,
    n => `kubectl set image deployment/${n} app-container=nginx:1.25`,
    n => `kubectl set image deployment/${n} app-container=nginx:1.25`,
    'Subcommand',
    n => `Set image for ${n}`
  );
};

const getDeleteCandidates = (sub: string, hasPods: boolean): SuggestionItem[] => {
  if (!('delete'.startsWith(sub))) return [];
  return [createItem('kubectl delete pod ', 'kubectl delete pod', 'Subcommand', 'Delete pod', !hasPods, !hasPods ? NO_POD_REASON : undefined)];
};

export const getKubectlSubcommandCandidates = (sub: string, nodes: Node[] = []): SuggestionItem[] => {
  const list: SuggestionItem[] = [];
  const deployNames = getDeploymentNames(nodes);
  const podNames = getPodNames(nodes);

  if ('get'.startsWith(sub)) list.push(...GET_SUBCOMMANDS);
  if ('config'.startsWith(sub)) list.push(...CONFIG_SUBCOMMANDS);

  list.push(
    ...getRolloutCandidates(sub, deployNames),
    ...getLogsCandidates(sub, podNames.length > 0, podNames),
    ...getDescribeCandidates(sub, deployNames, podNames, nodes),
    ...getScaleCandidates(sub, deployNames),
    ...getSetCandidates(sub, deployNames),
    ...getDeleteCandidates(sub, podNames.length > 0)
  );

  return list;
};

const parseScaleReplicas = (afterDep: string, depName: string): SuggestionItem[] => {
  if (afterDep.startsWith('--replicas=')) {
    const numPart = afterDep.slice('--replicas='.length);
    return ['1', '2', '3', '5', '10']
      .filter(n => n.startsWith(numPart))
      .map(n => createItem(`kubectl scale deployment/${depName} --replicas=${n}`, n, 'Subcommand', `Set replica count to ${n}`));
  }

  if (!afterDep || '--replicas='.startsWith(afterDep)) {
    return [createItem(`kubectl scale deployment/${depName} --replicas=`, '--replicas=', 'Subcommand', 'Specify replica count')];
  }
  return [];
};

const parseScaleWithDeployment = (restTrim: string, rest: string, deployNames: string[]): SuggestionItem[] => {
  if (!restTrim.startsWith('deployment/')) return [];

  const depPart = restTrim.slice('deployment/'.length);
  const spaceIdx = depPart.indexOf(' ');

  if (spaceIdx !== -1 || rest.endsWith(' ')) {
    const depName = spaceIdx !== -1 ? depPart.slice(0, spaceIdx) : depPart;
    const afterDep = spaceIdx !== -1 ? depPart.slice(spaceIdx + 1).trim() : '';
    return parseScaleReplicas(afterDep, depName);
  }

  const matched = deployNames.filter(n => n.toLowerCase().startsWith(depPart));
  return mapResourceItems(matched, n => `kubectl scale deployment/${n} `, n => `deployment/${n}`, 'Deployment', n => `Deployment ${n}`);
};

const handleScaleSequence = (input: string, deployNames: string[]): SuggestionItem[] => {
  if (deployNames.length === 0) {
    return [createItem('kubectl scale deployment/', 'kubectl scale deployment/', 'Subcommand', 'Scale a deployment resource', true, NO_DEPLOYMENT_REASON)];
  }

  const rest = input.startsWith('kubectl scale') ? input.slice('kubectl scale'.length) : '';
  const restTrim = rest.trim();

  if (!restTrim) {
    return mapResourceItems(deployNames, n => `kubectl scale deployment/${n} `, n => `deployment/${n}`, 'Deployment', n => `Deployment ${n}`);
  }

  return parseScaleWithDeployment(restTrim, rest, deployNames);
};

const handleSetImageSequence = (input: string, deployNames: string[]): SuggestionItem[] => {
  if (deployNames.length === 0) {
    return [createItem('kubectl set image deployment/', 'kubectl set image deployment/', 'Subcommand', 'Update deployment container image', true, NO_DEPLOYMENT_REASON)];
  }
  if (input === 'kubectl set' || input.startsWith('kubectl set ')) {
    let rest = input.slice('kubectl set'.length).trimStart();
    if (rest.startsWith('image')) {
      rest = rest.slice('image'.length).trimStart();
    }
    if (rest.startsWith('deployment/')) {
      rest = rest.slice('deployment/'.length).trimStart();
    }

    if (!rest.includes(' ')) {
      const matched = deployNames.filter(n => n.toLowerCase().startsWith(rest));
      return mapResourceItems(matched, n => `kubectl set image deployment/${n} `, n => `deployment/${n}`, 'Deployment', n => `Deployment ${n}`);
    }
    const [depName] = rest.split(/\s+/);
    return [createItem(`kubectl set image deployment/${depName} app-container=nginx:1.25`, 'app-container=nginx:1.25', 'Subcommand', 'Set container image version')];
  }
  return [];
};

const handleRolloutSequence = (input: string, deployNames: string[]): SuggestionItem[] => {
  if (deployNames.length === 0) {
    return [createItem('kubectl rollout status deploy/', 'kubectl rollout status deploy/', 'Subcommand', 'Show rollout status', true, NO_DEPLOYMENT_REASON)];
  }
  if (input === 'kubectl rollout' || input === 'kubectl rollout ') {
    const items: SuggestionItem[] = [];
    deployNames.forEach(n => {
      items.push(
        createItem(`kubectl rollout status deploy/${n}`, `status deploy/${n}`, 'Subcommand', 'Show rollout status'),
        createItem(`kubectl rollout history deploy/${n}`, `history deploy/${n}`, 'Subcommand', 'Show rollout history'),
        createItem(`kubectl rollout undo deploy/${n}`, `undo deploy/${n}`, 'Subcommand', 'Undo previous rollout')
      );
    });
    return items;
  }
  if (input.startsWith('kubectl rollout ')) {
    const rest = input.slice('kubectl rollout '.length).trim();
    for (const action of ['status', 'history', 'undo']) {
      const prefix = `${action} deploy/`;
      if (rest.startsWith(prefix)) {
        const depPart = rest.slice(prefix.length);
        const matched = deployNames.filter(n => n.toLowerCase().startsWith(depPart));
        return mapResourceItems(matched, n => `kubectl rollout ${action} deploy/${n}`, n => `deploy/${n}`, 'Deployment', n => `Deployment ${n}`);
      }
    }
  }
  return [];
};

const handleDescribePrefix = (
  prefix: string,
  input: string,
  resourceNames: string[],
  noReason: string,
  category: SuggestionItem['category'] = 'Command'
): SuggestionItem[] => {
  if (resourceNames.length === 0) {
    return [createItem(prefix, prefix.trim(), category, `Describe ${prefix.trim()} specs`, true, noReason)];
  }
  const rest = input.slice(prefix.length).trim();
  const matched = resourceNames.filter(n => n.toLowerCase().startsWith(rest));
  return mapResourceItems(matched, n => `${prefix}${n}`, n => n, category, n => `Describe ${n}`);
};

const DESCRIBE_CONFIGS: Array<{
  prefix: string;
  getNames: (nodes: Node[], deployNames: string[], podNames: string[]) => string[];
  noReason: string;
  category?: SuggestionItem['category'];
}> = [
  { prefix: 'kubectl describe rolebinding ', getNames: (nodes) => getRoleBindingNames(nodes), noReason: NO_ROLEBINDING_REASON },
  { prefix: 'kubectl describe role ', getNames: (nodes) => getRoleNames(nodes), noReason: NO_ROLE_REASON },
  { prefix: 'kubectl describe cm ', getNames: (nodes) => getConfigMapNames(nodes), noReason: NO_CONFIGMAP_REASON },
  { prefix: 'kubectl describe configmap ', getNames: (nodes) => getConfigMapNames(nodes), noReason: NO_CONFIGMAP_REASON },
  { prefix: 'kubectl describe secret ', getNames: (nodes) => getSecretNames(nodes), noReason: NO_SECRET_REASON },
  { prefix: 'kubectl describe deploy ', getNames: (_, deployNames) => deployNames, noReason: NO_DEPLOYMENT_REASON, category: 'Deployment' },
  { prefix: 'kubectl describe pod ', getNames: (_, __, podNames) => podNames, noReason: NO_POD_REASON, category: 'Pod' },
];

const handleDescribeSequence = (
  input: string,
  deployNames: string[],
  podNames: string[],
  nodes: Node[] = []
): SuggestionItem[] => {
  const rbNames = getRoleBindingNames(nodes);
  const rNames = getRoleNames(nodes);
  const cmNames = getConfigMapNames(nodes);
  const secNames = getSecretNames(nodes);

  if (input === 'kubectl describe' || input === 'kubectl describe ') {
    return [
      createItem('kubectl describe deploy ', 'deploy', 'Subcommand', 'Describe deployment specs', deployNames.length === 0, deployNames.length === 0 ? NO_DEPLOYMENT_REASON : undefined),
      createItem('kubectl describe pod ', 'pod', 'Subcommand', 'Describe pod specs & events', podNames.length === 0, podNames.length === 0 ? NO_POD_REASON : undefined),
      createItem('kubectl describe role ', 'role', 'Subcommand', 'Describe role specs & rules', rNames.length === 0, rNames.length === 0 ? NO_ROLE_REASON : undefined),
      createItem('kubectl describe rolebinding ', 'rolebinding', 'Subcommand', 'Describe rolebinding specs & subjects', rbNames.length === 0, rbNames.length === 0 ? NO_ROLEBINDING_REASON : undefined),
      createItem('kubectl describe cm ', 'cm', 'Subcommand', 'Describe configmap data', cmNames.length === 0, cmNames.length === 0 ? NO_CONFIGMAP_REASON : undefined),
      createItem('kubectl describe secret ', 'secret', 'Subcommand', 'Describe secret data', secNames.length === 0, secNames.length === 0 ? NO_SECRET_REASON : undefined)
    ];
  }

  const matchedConfig = DESCRIBE_CONFIGS.find(cfg => input.startsWith(cfg.prefix));
  if (matchedConfig) {
    const names = matchedConfig.getNames(nodes, deployNames, podNames);
    return handleDescribePrefix(matchedConfig.prefix, input, names, matchedConfig.noReason, matchedConfig.category);
  }

  return [];
};

const handleDeleteSequence = (input: string, deployNames: string[], podNames: string[]): SuggestionItem[] => {
  const hasDeploys = deployNames.length > 0;
  const hasPods = podNames.length > 0;

  if (input === 'kubectl delete' || input === 'kubectl delete ') {
    return [
      createItem('kubectl delete pod ', 'pod', 'Subcommand', 'Delete pod', !hasPods, !hasPods ? NO_POD_REASON : undefined),
      createItem('kubectl delete deployment ', 'deployment', 'Subcommand', 'Delete deployment', !hasDeploys, !hasDeploys ? NO_DEPLOYMENT_REASON : undefined),
      createItem('kubectl delete service ', 'service', 'Subcommand', 'Delete service'),
    ];
  }

  if (input.startsWith('kubectl delete pod ')) {
    if (!hasPods) return [createItem('kubectl delete pod ', 'pod', 'Pod', 'Delete pod', true, NO_POD_REASON)];
    const rest = input.slice('kubectl delete pod '.length).trim();
    const matched = podNames.filter(n => n.toLowerCase().startsWith(rest));
    return mapResourceItems(matched, n => `kubectl delete pod ${n}`, n => n, 'Pod', n => `Delete pod ${n}`);
  }

  return [];
};

const handleLogsSequence = (input: string, podNames: string[]): SuggestionItem[] => {
  if (podNames.length === 0) {
    return [createItem('kubectl logs ', 'logs', 'Pod', 'Stream container logs', true, NO_POD_REASON)];
  }
  const rest = input.slice('kubectl logs'.length).trim();
  const matched = podNames.filter(n => n.toLowerCase().startsWith(rest));
  return mapResourceItems(matched, n => `kubectl logs ${n}`, n => n, 'Pod', n => `Stream logs for ${n}`);
};

const matchSequenceCandidates = (
  norm: string,
  deployNames: string[],
  podNames: string[],
  nodes: Node[]
): SuggestionItem[] | null => {
  if (norm.startsWith('kubectl scale')) return handleScaleSequence(norm, deployNames);
  if (norm.startsWith('kubectl set')) return handleSetImageSequence(norm, deployNames);
  if (norm.startsWith('kubectl rollout')) return handleRolloutSequence(norm, deployNames);
  if (norm.startsWith('kubectl describe')) return handleDescribeSequence(norm, deployNames, podNames, nodes);
  if (norm.startsWith('kubectl delete')) return handleDeleteSequence(norm, deployNames, podNames);
  if (norm.startsWith('kubectl logs')) return handleLogsSequence(norm, podNames);
  return null;
};

const getTopLevelKubectlCommands = (deployNames: string[], podNames: string[]): SuggestionItem[] => {
  return KUBECTL_TOP_COMMANDS.map(c => {
    if (['kubectl scale', 'kubectl set image', 'kubectl rollout'].includes(c.value)) {
      return { ...c, disabled: deployNames.length === 0, disabledReason: deployNames.length === 0 ? NO_DEPLOYMENT_REASON : undefined };
    }
    if (c.value === 'kubectl logs') {
      return { ...c, disabled: podNames.length === 0, disabledReason: podNames.length === 0 ? NO_POD_REASON : undefined };
    }
    return c;
  });
};

const trimByDirectPrefix = (item: SuggestionItem, rawInput: string): string | null => {
  if (!rawInput.includes(' ') && !rawInput.includes('=')) return null;
  if (!item.value.toLowerCase().startsWith(rawInput.toLowerCase())) return null;

  const valRest = item.value.slice(rawInput.length).trim();
  if (!valRest) return null;

  if (item.label.toLowerCase().startsWith(rawInput.toLowerCase())) {
    const labelRest = item.label.slice(rawInput.length).trim();
    if (labelRest) return labelRest;
  }
  return valRest;
};

const countWordMatches = (
  labelWords: string[],
  targetWords: string[],
  strictIndex = false
): number => {
  let count = 0;
  while (count < labelWords.length && count < targetWords.length) {
    const wordLower = labelWords[count]?.toLowerCase();
    const isMatch = strictIndex
      ? wordLower === targetWords[count]
      : targetWords.includes(wordLower ?? '');
    if (!isMatch) break;
    count++;
  }
  return count;
};

const trimByFullWords = (item: SuggestionItem, trimmedInput: string): string | null => {
  const prefixSpace = `${trimmedInput} `;
  if (item.label.toLowerCase().startsWith(prefixSpace)) {
    const rest = item.label.slice(trimmedInput.length + 1).trim();
    if (rest) return rest;
  }

  if (item.value.toLowerCase().startsWith(prefixSpace)) {
    const valRest = item.value.slice(trimmedInput.length + 1).trim();
    if (!valRest) return null;

    const labelWords = item.label.split(/\s+/);
    const matchCount = countWordMatches(labelWords, trimmedInput.split(/\s+/));
    if (matchCount > 0 && matchCount < labelWords.length) {
      const labelRest = labelWords.slice(matchCount).join(' ').trim();
      if (labelRest) return labelRest;
    }
    return valRest;
  }

  return null;
};

const getCompletedPrefix = (rawInput: string): string => {
  if (rawInput.endsWith(' ')) return rawInput;
  const lastSpaceIdx = rawInput.lastIndexOf(' ');
  return lastSpaceIdx !== -1 ? rawInput.slice(0, lastSpaceIdx + 1) : '';
};

const trimByPartialWord = (item: SuggestionItem, completedPrefix: string): string | null => {
  const completedPrefixLower = completedPrefix.toLowerCase();
  const completedTrimmedLower = completedPrefix.trim().toLowerCase();

  if (item.label.toLowerCase().startsWith(completedPrefixLower)) {
    const rest = item.label.slice(completedPrefix.length).trim();
    if (rest) return rest;
  } else if (item.label.toLowerCase().startsWith(`${completedTrimmedLower} `)) {
    const rest = item.label.slice(completedTrimmedLower.length + 1).trim();
    if (rest) return rest;
  }

  if (item.value.toLowerCase().startsWith(completedPrefixLower)) {
    const valRest = item.value.slice(completedPrefix.length).trim();
    if (!valRest) return null;

    const labelWords = item.label.split(/\s+/);
    const compWords = completedTrimmedLower.split(/\s+/);
    const matchCount = countWordMatches(labelWords, compWords, true);

    if (matchCount > 0 && matchCount < labelWords.length) {
      const labelRest = labelWords.slice(matchCount).join(' ').trim();
      if (labelRest) return labelRest;
    }
    return valRest;
  }

  return null;
};

export const trimSuggestionLabel = (item: SuggestionItem, input: string): SuggestionItem => {
  const trimmed = input?.trim();
  if (!trimmed) return item;

  const directMatch = trimByDirectPrefix(item, input);
  if (directMatch) return { ...item, label: directMatch };

  const fullWordMatch = trimByFullWords(item, trimmed.toLowerCase());
  if (fullWordMatch) return { ...item, label: fullWordMatch };

  const completedPrefix = getCompletedPrefix(input);
  if (completedPrefix) {
    const partialMatch = trimByPartialWord(item, completedPrefix);
    if (partialMatch) return { ...item, label: partialMatch };
  }

  return item;
};

export const getAutocompleteSuggestions = (
  input: string,
  nodes: Node[],
  isAdminAuthenticated = false,
  isAwaitingAdminPassword = false
): SuggestionItem[] => {
  if (isAwaitingAdminPassword || !input?.trim()) return [];

  if (isAdminAuthenticated) {
    const inputLower = input.trim().toLowerCase();
    return ADMIN_SUGGESTIONS.filter(item =>
      item.value.toLowerCase().includes(inputLower) ||
      item.label.toLowerCase().includes(inputLower)
    ).map(item => trimSuggestionLabel(item, input));
  }

  const norm = input.toLowerCase();
  const deployNames = getDeploymentNames(nodes);
  const podNames = getPodNames(nodes);

  const seqResult = matchSequenceCandidates(norm, deployNames, podNames, nodes);
  if (seqResult) {
    return seqResult.map(item => trimSuggestionLabel(item, input));
  }

  const trimmedLower = input.trim().toLowerCase();
  const tokens = trimmedLower.split(/\s+/);
  let candidates: SuggestionItem[] = [];

  if (tokens[0] === 'kubectl' || 'kubectl'.startsWith(tokens[0])) {
    candidates = tokens.length === 1
      ? getTopLevelKubectlCommands(deployNames, podNames)
      : getKubectlSubcommandCandidates(tokens[1], nodes);
  } else {
    candidates = [...UTILITY_COMMANDS, ...KUBECTL_TOP_COMMANDS];
  }

  const matched = candidates.filter(item =>
    item.value.toLowerCase().includes(trimmedLower) ||
    item.label.toLowerCase().includes(trimmedLower)
  );

  const seen = new Set<string>();
  const uniqueSuggestions: SuggestionItem[] = [];

  matched.forEach(item => {
    if (!seen.has(item.value)) {
      seen.add(item.value);
      uniqueSuggestions.push(trimSuggestionLabel(item, input));
    }
  });

  return uniqueSuggestions.slice(0, 10);
};
