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
  ['kubectl get', 'get', 'Subcommand', 'Display one or many resources'],
  ['kubectl config', 'config', 'Subcommand', 'Modify kubeconfig files and user contexts'],
  ['kubectl logs', 'logs', 'Subcommand', 'Print the logs for a container in a pod'],
  ['kubectl describe', 'describe', 'Subcommand', 'Show details of a specific resource'],
  ['kubectl scale', 'scale', 'Subcommand', 'Set a new size for a Deployment'],
  ['kubectl set image', 'set image', 'Subcommand', 'Update image of a Deployment'],
  ['kubectl rollout', 'rollout', 'Subcommand', 'Manage the rollout of a resource'],
  ['kubectl delete', 'delete', 'Subcommand', 'Delete resources by resource and name'],
]);

export const CONFIG_SUBCOMMANDS: SuggestionItem[] = createSuggestionMap([
  ['kubectl config get-contexts', 'get-contexts', 'Command', 'List all available user contexts'],
  ['kubectl config current-context', 'current-context', 'Command', 'Display the current user context'],
  ['kubectl config view', 'view', 'Command', 'Display merged kubeconfig settings'],
  ['kubectl config use-context ', 'use-context <user>', 'Command', 'Set the current-context in kubeconfig'],
]);

export const GET_SUBCOMMANDS: SuggestionItem[] = createSuggestionMap([
  ['kubectl get pods', 'pods', 'Command', 'List all pods on canvas'],
  ['kubectl get deployments', 'deployments', 'Command', 'List deployments on canvas'],
  ['kubectl get services', 'services', 'Command', 'List services on canvas'],
  ['kubectl get roles', 'roles', 'Command', 'List roles on canvas'],
  ['kubectl get rolebindings', 'rolebindings', 'Command', 'List rolebindings on canvas'],
  ['kubectl get configmaps', 'configmaps', 'Command', 'List configmaps on canvas'],
  ['kubectl get secrets', 'secrets', 'Command', 'List secrets on canvas'],
  ['kubectl get all', 'all', 'Command', 'List all resources on canvas'],
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
    return [createItem('kubectl rollout status deploy/', 'status deploy/', 'Command', 'Check rolling update progress', true, NO_DEPLOYMENT_REASON)];
  }
  const items: SuggestionItem[] = [];
  deployNames.forEach(n => {
    items.push(
      createItem(`kubectl rollout status deploy/${n}`, `status deploy/${n}`, 'Command', 'Check rolling update progress'),
      createItem(`kubectl rollout history deploy/${n}`, `history deploy/${n}`, 'Command', 'View revision history'),
      createItem(`kubectl rollout undo deploy/${n}`, `undo deploy/${n}`, 'Command', 'Rollback to previous revision')
    );
  });
  return items;
};

const getLogsCandidates = (sub: string, hasPods: boolean, podNames: string[]): SuggestionItem[] => {
  if (!('logs'.startsWith(sub))) return [];
  return [{
    ...createItem('kubectl logs ', 'logs <pod-name>', 'Subcommand', 'Stream container logs', !hasPods, !hasPods ? NO_POD_REASON : undefined),
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
    createItem('kubectl describe deploy ', 'deploy', 'Subcommand', 'Describe deployment specs', !hasDeploys, !hasDeploys ? NO_DEPLOYMENT_REASON : undefined),
    createItem('kubectl describe pod ', 'pod', 'Subcommand', 'Describe pod specs & events', !hasPods, !hasPods ? NO_POD_REASON : undefined),
    createItem('kubectl describe role ', 'role', 'Subcommand', 'Describe role specs & rules', !hasRoles, !hasRoles ? NO_ROLE_REASON : undefined),
    createItem('kubectl describe rolebinding ', 'rolebinding', 'Subcommand', 'Describe rolebinding specs & subjects', !hasRbs, !hasRbs ? NO_ROLEBINDING_REASON : undefined),
    createItem('kubectl describe cm ', 'cm', 'Subcommand', 'Describe configmap data', !hasCms, !hasCms ? NO_CONFIGMAP_REASON : undefined),
    createItem('kubectl describe secret ', 'secret', 'Subcommand', 'Describe secret data', !hasSecrets, !hasSecrets ? NO_SECRET_REASON : undefined)
  ];
};

const getScaleCandidates = (sub: string, deployNames: string[]): SuggestionItem[] => {
  if (!('scale'.startsWith(sub))) return [];
  if (deployNames.length === 0) {
    return [createItem('kubectl scale deployment/', 'deployment/', 'Subcommand', 'Scale deployment replicas', true, NO_DEPLOYMENT_REASON)];
  }
  return mapResourceItems(
    deployNames,
    n => `kubectl scale deployment/${n} --replicas=3`,
    n => `deployment/${n} --replicas=3`,
    'Subcommand',
    n => `Scale deployment ${n}`
  );
};

const getSetCandidates = (sub: string, deployNames: string[]): SuggestionItem[] => {
  if (!('set'.startsWith(sub))) return [];
  if (deployNames.length === 0) {
    return [createItem('kubectl set image deployment/', 'image deployment/', 'Subcommand', 'Set container image', true, NO_DEPLOYMENT_REASON)];
  }
  return mapResourceItems(
    deployNames,
    n => `kubectl set image deployment/${n} app-container=nginx:1.25`,
    n => `image deployment/${n} app-container=nginx:1.25`,
    'Subcommand',
    n => `Set image for ${n}`
  );
};

const getDeleteCandidates = (sub: string, hasPods: boolean): SuggestionItem[] => {
  if (!('delete'.startsWith(sub))) return [];
  return [createItem('kubectl delete pod ', 'pod', 'Subcommand', 'Delete pod', !hasPods, !hasPods ? NO_POD_REASON : undefined)];
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
    return [createItem('kubectl scale deployment/', 'deployment/', 'Subcommand', 'Scale a deployment resource', true, NO_DEPLOYMENT_REASON)];
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
    return [createItem('kubectl set image deployment/', 'image deployment/', 'Subcommand', 'Update deployment container image', true, NO_DEPLOYMENT_REASON)];
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
    return [createItem('kubectl rollout status deploy/', 'status deploy/', 'Subcommand', 'Show rollout status', true, NO_DEPLOYMENT_REASON)];
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

export const trimSuggestionLabel = (item: SuggestionItem, input: string): SuggestionItem => {
  if (!input || !input.trim()) return item;

  const trimmedInput = input.trim().toLowerCase();
  const trimmedWords = trimmedInput.split(/\s+/);

  let newLabel = item.label;

  if (newLabel.toLowerCase().startsWith(trimmedInput + ' ')) {
    const rest = newLabel.slice(trimmedInput.length + 1).trim();
    if (rest) return { ...item, label: rest };
  } else if (newLabel.toLowerCase() === trimmedInput) {
    return item;
  }

  if (item.value.toLowerCase().startsWith(trimmedInput + ' ')) {
    const valRest = item.value.slice(trimmedInput.length + 1).trim();
    if (valRest) {
      let labelWords = newLabel.split(/\s+/);
      let matchCount = 0;
      while (matchCount < labelWords.length && matchCount < trimmedWords.length) {
        const wordInTrimmed = trimmedWords[trimmedWords.length - labelWords.length + matchCount] || trimmedWords[matchCount];
        if (labelWords[matchCount].toLowerCase() === wordInTrimmed) {
          matchCount++;
        } else {
          break;
        }
      }
      if (matchCount > 0) {
        const labelRest = labelWords.slice(matchCount).join(' ').trim();
        if (labelRest) {
          return { ...item, label: labelRest };
        }
      }
      return { ...item, label: valRest };
    }
  }

  let labelWords = newLabel.split(/\s+/);
  let matchedCount = 0;
  for (let i = 0; i < labelWords.length; i++) {
    const labelWordLower = labelWords[i].toLowerCase();
    if (trimmedWords.includes(labelWordLower)) {
      matchedCount = i + 1;
    } else {
      break;
    }
  }

  if (matchedCount > 0 && matchedCount < labelWords.length) {
    const rest = labelWords.slice(matchedCount).join(' ').trim();
    if (rest) {
      return { ...item, label: rest };
    }
  }

  return { ...item, label: newLabel };
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
