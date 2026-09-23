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
  ['kubectl get pods', 'get pods', 'Command', 'List all pods on canvas'],
  ['kubectl get deployments', 'get deployments', 'Command', 'List deployments on canvas'],
  ['kubectl get services', 'get services', 'Command', 'List services on canvas'],
  ['kubectl get roles', 'get roles', 'Command', 'List roles on canvas'],
  ['kubectl get rolebindings', 'get rolebindings', 'Command', 'List rolebindings on canvas'],
  ['kubectl get configmaps', 'get configmaps', 'Command', 'List configmaps on canvas'],
  ['kubectl get secrets', 'get secrets', 'Command', 'List secrets on canvas'],
  ['kubectl get all', 'get all', 'Command', 'List all resources on canvas'],
]);

export const UTILITY_COMMANDS: SuggestionItem[] = createSuggestionMap([
  ['history', 'history', 'Utility', 'View command execution history'],
  ['help', 'help', 'Utility', 'Show help and available commands'],
  ['clear', 'clear', 'Utility', 'Clear terminal output'],
]);

export const getDeploymentNames = (nodes: Node[]): string[] => {
  return nodes.filter(n => n.type === 'Deployment').map(d => String(d.data?.label || d.id));
};

export const getPodNames = (nodes: Node[]): string[] => {
  return nodes.filter(n => n.type === 'Pod' || n.type === 'Deployment' || n.type === 'ReplicaSet').map(p => String(p.data?.label || p.id));
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

const mapResourceItems = (
  names: string[],
  valuePattern: (n: string) => string,
  labelPattern: (n: string) => string,
  cat: SuggestionItem['category'],
  descPattern: (n: string) => string
): SuggestionItem[] => {
  return names.map(n => createItem(valuePattern(n), labelPattern(n), cat, descPattern(n)));
};

export const getKubectlSubcommandCandidates = (sub: string, nodes: Node[] = []): SuggestionItem[] => {
  const list: SuggestionItem[] = [];
  const deployNames = getDeploymentNames(nodes);
  const podNames = getPodNames(nodes);
  const rbNames = getRoleBindingNames(nodes);
  const rNames = getRoleNames(nodes);
  const cmNames = getConfigMapNames(nodes);
  const secNames = getSecretNames(nodes);

  const hasDeploys = deployNames.length > 0;
  const hasPods = podNames.length > 0;
  const hasRbs = rbNames.length > 0;
  const hasRoles = rNames.length > 0;
  const hasCms = cmNames.length > 0;
  const hasSecrets = secNames.length > 0;

  if (sub === 'get' || 'get'.startsWith(sub)) list.push(...GET_SUBCOMMANDS);
  if (sub === 'config' || 'config'.startsWith(sub)) list.push(...CONFIG_SUBCOMMANDS);

  if (sub === 'rollout' || 'rollout'.startsWith(sub)) {
    if (hasDeploys) {
      deployNames.forEach(n => {
        list.push(
          createItem(`kubectl rollout status deploy/${n}`, `rollout status deploy/${n}`, 'Command', 'Check rolling update progress'),
          createItem(`kubectl rollout history deploy/${n}`, `rollout history deploy/${n}`, 'Command', 'View revision history'),
          createItem(`kubectl rollout undo deploy/${n}`, `rollout undo deploy/${n}`, 'Command', 'Rollback to previous revision')
        );
      });
    } else {
      list.push(createItem('kubectl rollout status deploy/', 'rollout status deploy/', 'Command', 'Check rolling update progress', true, NO_DEPLOYMENT_REASON));
    }
  }

  if (sub === 'logs' || 'logs'.startsWith(sub)) {
    list.push({
      ...createItem('kubectl logs ', 'logs <pod-name>', 'Subcommand', 'Stream container logs', !hasPods, !hasPods ? NO_POD_REASON : undefined),
      subItems: podNames,
    });
  }

  if (sub === 'describe' || 'describe'.startsWith(sub)) {
    list.push(
      createItem('kubectl describe deploy ', 'describe deploy', 'Subcommand', 'Describe deployment specs', !hasDeploys, !hasDeploys ? NO_DEPLOYMENT_REASON : undefined),
      createItem('kubectl describe pod ', 'describe pod', 'Subcommand', 'Describe pod specs & events', !hasPods, !hasPods ? NO_POD_REASON : undefined),
      createItem('kubectl describe role ', 'describe role', 'Subcommand', 'Describe role specs & rules', !hasRoles, !hasRoles ? NO_ROLE_REASON : undefined),
      createItem('kubectl describe rolebinding ', 'describe rolebinding', 'Subcommand', 'Describe rolebinding specs & subjects', !hasRbs, !hasRbs ? NO_ROLEBINDING_REASON : undefined),
      createItem('kubectl describe cm ', 'describe cm', 'Subcommand', 'Describe configmap data', !hasCms, !hasCms ? NO_CONFIGMAP_REASON : undefined),
      createItem('kubectl describe secret ', 'describe secret', 'Subcommand', 'Describe secret data', !hasSecrets, !hasSecrets ? NO_SECRET_REASON : undefined)
    );
  }

  if (sub === 'scale' || 'scale'.startsWith(sub)) {
    if (hasDeploys) {
      list.push(...mapResourceItems(deployNames, n => `kubectl scale deployment/${n} --replicas=3`, n => `scale deployment/${n} --replicas=3`, 'Subcommand', n => `Scale deployment ${n}`));
    } else {
      list.push(createItem('kubectl scale deployment/', 'scale deployment/', 'Subcommand', 'Scale deployment replicas', true, NO_DEPLOYMENT_REASON));
    }
  }

  if (sub === 'set' || 'set'.startsWith(sub)) {
    if (hasDeploys) {
      list.push(...mapResourceItems(deployNames, n => `kubectl set image deployment/${n} app-container=nginx:1.25`, n => `set image deployment/${n} app-container=nginx:1.25`, 'Subcommand', n => `Set image for ${n}`));
    } else {
      list.push(createItem('kubectl set image deployment/', 'set image deployment/', 'Subcommand', 'Set container image', true, NO_DEPLOYMENT_REASON));
    }
  }

  if (sub === 'delete' || 'delete'.startsWith(sub)) {
    list.push(createItem('kubectl delete pod ', 'delete pod', 'Subcommand', 'Delete pod', !hasPods, !hasPods ? NO_POD_REASON : undefined));
  }

  return list;
};

const handleScaleSequence = (input: string, deployNames: string[]): SuggestionItem[] => {
  if (deployNames.length === 0) {
    return [createItem('kubectl scale deployment/', 'scale deployment/', 'Subcommand', 'Scale a deployment resource', true, NO_DEPLOYMENT_REASON)];
  }

  const match = /^kubectl\s+scale(?:\s+(.*))?$/.exec(input);
  const rest = match ? (match[1] || '') : '';

  if (!rest.trim()) {
    return mapResourceItems(deployNames, n => `kubectl scale deployment/${n} `, n => `deployment/${n}`, 'Deployment', n => `Deployment ${n}`);
  }

  const restTrim = rest.trim();
  if (!restTrim.startsWith('deployment/')) return [];

  const depPart = restTrim.slice('deployment/'.length);
  const spaceIdx = depPart.indexOf(' ');

  if (spaceIdx !== -1 || rest.endsWith(' ')) {
    const depName = spaceIdx !== -1 ? depPart.slice(0, spaceIdx) : depPart;
    const afterDep = spaceIdx !== -1 ? depPart.slice(spaceIdx + 1).trim() : '';

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
  }

  const matched = deployNames.filter(n => n.toLowerCase().startsWith(depPart));
  return mapResourceItems(matched, n => `kubectl scale deployment/${n} `, n => `deployment/${n}`, 'Deployment', n => `Deployment ${n}`);
};

const handleSetImageSequence = (input: string, deployNames: string[]): SuggestionItem[] => {
  if (deployNames.length === 0) {
    return [createItem('kubectl set image deployment/', 'set image deployment/', 'Subcommand', 'Update deployment container image', true, NO_DEPLOYMENT_REASON)];
  }
  if (input === 'kubectl set' || input.startsWith('kubectl set ')) {
    const rest = input.replace(/^kubectl\s+set(?:\s+image)?(?:\s+deployment\/)?\s*/, '');
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
    return [createItem('kubectl rollout status deploy/', 'rollout status deploy/', 'Subcommand', 'Show rollout status', true, NO_DEPLOYMENT_REASON)];
  }
  if (input === 'kubectl rollout' || input === 'kubectl rollout ') {
    const items: SuggestionItem[] = [];
    deployNames.forEach(n => {
      items.push(
        createItem(`kubectl rollout status deploy/${n}`, `rollout status deploy/${n}`, 'Subcommand', 'Show rollout status'),
        createItem(`kubectl rollout history deploy/${n}`, `rollout history deploy/${n}`, 'Subcommand', 'Show rollout history'),
        createItem(`kubectl rollout undo deploy/${n}`, `rollout undo deploy/${n}`, 'Subcommand', 'Undo previous rollout')
      );
    });
    return items;
  }
  const match = /^kubectl\s+rollout\s+(status|history|undo)\s+deploy\/(.*)$/.exec(input);
  if (match) {
    const [, action, depPart] = match;
    const matched = deployNames.filter(n => n.toLowerCase().startsWith(depPart));
    return mapResourceItems(matched, n => `kubectl rollout ${action} deploy/${n}`, n => `deploy/${n}`, 'Deployment', n => `Deployment ${n}`);
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
      createItem('kubectl describe deploy ', 'describe deploy', 'Subcommand', 'Describe deployment specs', deployNames.length === 0, deployNames.length === 0 ? NO_DEPLOYMENT_REASON : undefined),
      createItem('kubectl describe pod ', 'describe pod', 'Subcommand', 'Describe pod specs & events', podNames.length === 0, podNames.length === 0 ? NO_POD_REASON : undefined),
      createItem('kubectl describe role ', 'describe role', 'Subcommand', 'Describe role specs & rules', rNames.length === 0, rNames.length === 0 ? NO_ROLE_REASON : undefined),
      createItem('kubectl describe rolebinding ', 'describe rolebinding', 'Subcommand', 'Describe rolebinding specs & subjects', rbNames.length === 0, rbNames.length === 0 ? NO_ROLEBINDING_REASON : undefined),
      createItem('kubectl describe cm ', 'describe cm', 'Subcommand', 'Describe configmap data', cmNames.length === 0, cmNames.length === 0 ? NO_CONFIGMAP_REASON : undefined),
      createItem('kubectl describe secret ', 'describe secret', 'Subcommand', 'Describe secret data', secNames.length === 0, secNames.length === 0 ? NO_SECRET_REASON : undefined)
    ];
  }

  if (input.startsWith('kubectl describe rolebinding ')) return handleDescribePrefix('kubectl describe rolebinding ', input, rbNames, NO_ROLEBINDING_REASON);
  if (input.startsWith('kubectl describe role ')) return handleDescribePrefix('kubectl describe role ', input, rNames, NO_ROLE_REASON);
  if (input.startsWith('kubectl describe cm ')) return handleDescribePrefix('kubectl describe cm ', input, cmNames, NO_CONFIGMAP_REASON);
  if (input.startsWith('kubectl describe configmap ')) return handleDescribePrefix('kubectl describe configmap ', input, cmNames, NO_CONFIGMAP_REASON);
  if (input.startsWith('kubectl describe secret ')) return handleDescribePrefix('kubectl describe secret ', input, secNames, NO_SECRET_REASON);
  if (input.startsWith('kubectl describe deploy ')) return handleDescribePrefix('kubectl describe deploy ', input, deployNames, NO_DEPLOYMENT_REASON, 'Deployment');
  if (input.startsWith('kubectl describe pod ')) return handleDescribePrefix('kubectl describe pod ', input, podNames, NO_POD_REASON, 'Pod');

  return [];
};

const handleDeleteSequence = (input: string, deployNames: string[], podNames: string[]): SuggestionItem[] => {
  const hasDeploys = deployNames.length > 0;
  const hasPods = podNames.length > 0;

  if (input === 'kubectl delete' || input === 'kubectl delete ') {
    return [
      createItem('kubectl delete pod ', 'delete pod', 'Subcommand', 'Delete pod', !hasPods, !hasPods ? NO_POD_REASON : undefined),
      createItem('kubectl delete deployment ', 'delete deployment', 'Subcommand', 'Delete deployment', !hasDeploys, !hasDeploys ? NO_DEPLOYMENT_REASON : undefined),
      createItem('kubectl delete service ', 'delete service', 'Subcommand', 'Delete service'),
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

export const getAutocompleteSuggestions = (
  input: string,
  nodes: Node[],
  isAdminAuthenticated = false,
  isAwaitingAdminPassword = false
): SuggestionItem[] => {
  if (isAwaitingAdminPassword || !input || !input.trim()) return [];

  if (isAdminAuthenticated) {
    const inputLower = input.trim().toLowerCase();
    return ADMIN_SUGGESTIONS.filter(item =>
      item.value.toLowerCase().includes(inputLower) ||
      item.label.toLowerCase().includes(inputLower)
    );
  }

  const norm = input.toLowerCase();
  const deployNames = getDeploymentNames(nodes);
  const podNames = getPodNames(nodes);

  const seqResult = matchSequenceCandidates(norm, deployNames, podNames, nodes);
  if (seqResult) return seqResult;

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
      uniqueSuggestions.push(item);
    }
  });

  return uniqueSuggestions.slice(0, 10);
};
