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

export const ADMIN_SUGGESTIONS: SuggestionItem[] = [
  { value: 'try version update 0.5.0', label: 'try version update <version>', category: 'Admin', description: 'Simulate update notification badge button' },
  { value: 'try version current 0.4.0', label: 'try version current <version>', category: 'Admin', description: 'Simulate current application version' },
  { value: 'try version clear', label: 'try version clear', category: 'Admin', description: 'Clear simulated current version' },
  { value: 'try clear', label: 'try clear', category: 'Admin', description: 'Clear all simulated version settings' },
  { value: 'try status', label: 'try status', category: 'Admin', description: 'View secret mode status' },
  { value: 'logout', label: 'logout', category: 'Admin', description: 'Exit Admin Mode and return to standard CLI' },
];

export const KUBECTL_TOP_COMMANDS: SuggestionItem[] = [
  { value: 'kubectl get', label: 'kubectl get', category: 'Subcommand', description: 'Display one or many resources' },
  { value: 'kubectl config', label: 'kubectl config', category: 'Subcommand', description: 'Modify kubeconfig files and user contexts' },
  { value: 'kubectl logs', label: 'kubectl logs', category: 'Subcommand', description: 'Print the logs for a container in a pod' },
  { value: 'kubectl describe', label: 'kubectl describe', category: 'Subcommand', description: 'Show details of a specific resource' },
  { value: 'kubectl scale', label: 'kubectl scale', category: 'Subcommand', description: 'Set a new size for a Deployment' },
  { value: 'kubectl set image', label: 'kubectl set image', category: 'Subcommand', description: 'Update image of a Deployment' },
  { value: 'kubectl rollout', label: 'kubectl rollout', category: 'Subcommand', description: 'Manage the rollout of a resource' },
  { value: 'kubectl delete', label: 'kubectl delete', category: 'Subcommand', description: 'Delete resources by resource and name' },
];

export const CONFIG_SUBCOMMANDS: SuggestionItem[] = [
  { value: 'kubectl config get-contexts', label: 'kubectl config get-contexts', category: 'Command', description: 'List all available user contexts' },
  { value: 'kubectl config current-context', label: 'kubectl config current-context', category: 'Command', description: 'Display the current user context' },
  { value: 'kubectl config view', label: 'kubectl config view', category: 'Command', description: 'Display merged kubeconfig settings' },
  { value: 'kubectl config use-context ', label: 'kubectl config use-context <user>', category: 'Command', description: 'Set the current-context in kubeconfig' },
];

export const GET_SUBCOMMANDS: SuggestionItem[] = [
  { value: 'kubectl get pods', label: 'get pods', category: 'Command', description: 'List all pods on canvas' },
  { value: 'kubectl get deployments', label: 'get deployments', category: 'Command', description: 'List deployments on canvas' },
  { value: 'kubectl get services', label: 'get services', category: 'Command', description: 'List services on canvas' },
  { value: 'kubectl get roles', label: 'get roles', category: 'Command', description: 'List roles on canvas' },
  { value: 'kubectl get rolebindings', label: 'get rolebindings', category: 'Command', description: 'List rolebindings on canvas' },
  { value: 'kubectl get configmaps', label: 'get configmaps', category: 'Command', description: 'List configmaps on canvas' },
  { value: 'kubectl get secrets', label: 'get secrets', category: 'Command', description: 'List secrets on canvas' },
  { value: 'kubectl get all', label: 'get all', category: 'Command', description: 'List all resources on canvas' },
];

export const UTILITY_COMMANDS: SuggestionItem[] = [
  { value: 'history', label: 'history', category: 'Utility', description: 'View command execution history' },
  { value: 'help', label: 'help', category: 'Utility', description: 'Show help and available commands' },
  { value: 'clear', label: 'clear', category: 'Utility', description: 'Clear terminal output' },
];

export const getDeploymentNames = (nodes: Node[]): string[] => {
  const deployments = nodes.filter(n => n.type === 'Deployment');
  return deployments.map(d => String(d.data?.label || d.id));
};

export const getPodNames = (nodes: Node[]): string[] => {
  const pods = nodes.filter(n => n.type === 'Pod' || n.type === 'Deployment' || n.type === 'ReplicaSet');
  return pods.map(p => String(p.data?.label || p.id));
};

export const getKubectlSubcommandCandidates = (sub: string, nodes: Node[] = []): SuggestionItem[] => {
  const list: SuggestionItem[] = [];
  const deployNames = getDeploymentNames(nodes);
  const podNames = getPodNames(nodes);

  const hasDeployments = deployNames.length > 0;
  const hasPods = podNames.length > 0;

  if (sub === 'get' || 'get'.startsWith(sub)) {
    list.push(...GET_SUBCOMMANDS);
  }
  if (sub === 'config' || 'config'.startsWith(sub)) {
    list.push(...CONFIG_SUBCOMMANDS);
  }
  if (sub === 'rollout' || 'rollout'.startsWith(sub)) {
    if (hasDeployments) {
      deployNames.forEach(name => {
        list.push(
          { value: `kubectl rollout status deploy/${name}`, label: `rollout status deploy/${name}`, category: 'Command', description: 'Check rolling update progress' },
          { value: `kubectl rollout history deploy/${name}`, label: `rollout history deploy/${name}`, category: 'Command', description: 'View revision history' },
          { value: `kubectl rollout undo deploy/${name}`, label: `rollout undo deploy/${name}`, category: 'Command', description: 'Rollback to previous revision' }
        );
      });
    } else {
      list.push({
        value: 'kubectl rollout status deploy/',
        label: 'rollout status deploy/',
        category: 'Command',
        description: 'Check rolling update progress',
        disabled: true,
        disabledReason: '(no Deployment on canvas)',
      });
    }
  }
  if (sub === 'logs' || 'logs'.startsWith(sub)) {
    list.push({
      value: 'kubectl logs ',
      label: 'logs <pod-name>',
      category: 'Subcommand',
      description: 'Stream container logs',
      subItems: podNames,
      disabled: !hasPods,
      disabledReason: !hasPods ? '(no Pod on canvas)' : undefined,
    });
  }
  if (sub === 'describe' || 'describe'.startsWith(sub)) {
    list.push(
      { value: 'kubectl describe deploy ', label: 'describe deploy', category: 'Subcommand', description: 'Describe deployment specs', disabled: !hasDeployments, disabledReason: !hasDeployments ? '(no Deployment on canvas)' : undefined },
      { value: 'kubectl describe pod ', label: 'describe pod', category: 'Subcommand', description: 'Describe pod specs & events', disabled: !hasPods, disabledReason: !hasPods ? '(no Pod on canvas)' : undefined },
      { value: 'kubectl describe role ', label: 'describe role', category: 'Subcommand', description: 'Describe role specs & rules' },
      { value: 'kubectl describe rolebinding ', label: 'describe rolebinding', category: 'Subcommand', description: 'Describe rolebinding specs & subjects' },
      { value: 'kubectl describe cm ', label: 'describe cm', category: 'Subcommand', description: 'Describe configmap data' },
      { value: 'kubectl describe secret ', label: 'describe secret', category: 'Subcommand', description: 'Describe secret data' }
    );
  }
  if (sub === 'scale' || 'scale'.startsWith(sub)) {
    if (hasDeployments) {
      deployNames.forEach(name => {
        list.push({
          value: `kubectl scale deployment/${name} --replicas=3`,
          label: `scale deployment/${name} --replicas=3`,
          category: 'Subcommand',
          description: `Scale deployment ${name}`,
        });
      });
    } else {
      list.push({
        value: 'kubectl scale deployment/',
        label: 'scale deployment/',
        category: 'Subcommand',
        description: 'Scale deployment replicas',
        disabled: true,
        disabledReason: '(no Deployment on canvas)',
      });
    }
  }
  if (sub === 'set' || 'set'.startsWith(sub)) {
    if (hasDeployments) {
      deployNames.forEach(name => {
        list.push({
          value: `kubectl set image deployment/${name} app-container=nginx:1.25`,
          label: `set image deployment/${name} app-container=nginx:1.25`,
          category: 'Subcommand',
          description: `Set image for ${name}`,
        });
      });
    } else {
      list.push({
        value: 'kubectl set image deployment/',
        label: 'set image deployment/',
        category: 'Subcommand',
        description: 'Set container image',
        disabled: true,
        disabledReason: '(no Deployment on canvas)',
      });
    }
  }
  if (sub === 'delete' || 'delete'.startsWith(sub)) {
    list.push({
      value: 'kubectl delete pod ',
      label: 'delete pod',
      category: 'Subcommand',
      description: 'Delete pod',
      disabled: !hasPods,
      disabledReason: !hasPods ? '(no Pod on canvas)' : undefined,
    });
  }
  return list;
};

export const getAutocompleteSuggestions = (
  input: string,
  nodes: Node[],
  isAdminAuthenticated = false,
  isAwaitingAdminPassword = false
): SuggestionItem[] => {
  if (isAwaitingAdminPassword) return [];

  if (!input || input.trim().length === 0) return [];

  if (isAdminAuthenticated) {
    const inputLower = input.trim().toLowerCase();
    return ADMIN_SUGGESTIONS.filter(item =>
      item.value.toLowerCase().includes(inputLower) ||
      item.label.toLowerCase().includes(inputLower)
    );
  }

  const normalizedInput = input.toLowerCase();
  const deployNames = getDeploymentNames(nodes);
  const podNames = getPodNames(nodes);
  const hasDeployments = deployNames.length > 0;
  const hasPods = podNames.length > 0;

  // 1. `kubectl scale ...` sequence
  if (/^kubectl\s+scale(?:\s+.*)?$/.test(normalizedInput)) {
    const scaleMatch = normalizedInput.match(/^kubectl\s+scale(?:\s+(.*))?$/);
    const rest = scaleMatch ? (scaleMatch[1] || '') : '';

    if (!hasDeployments) {
      return [
        {
          value: 'kubectl scale deployment/',
          label: 'scale deployment/',
          category: 'Subcommand',
          description: 'Scale a deployment resource',
          disabled: true,
          disabledReason: '(no Deployment on canvas)',
        },
      ];
    }

    if (!rest || !rest.trim()) {
      return deployNames.map(name => ({
        value: `kubectl scale deployment/${name} `,
        label: `deployment/${name}`,
        category: 'Deployment',
        description: `Deployment ${name}`,
      }));
    }

    const restTrimmed = rest.trim();
    if (restTrimmed.startsWith('deployment/')) {
      const depNamePart = restTrimmed.slice('deployment/'.length);

      const spaceIdx = depNamePart.indexOf(' ');
      if (spaceIdx !== -1 || rest.endsWith(' ')) {
        const depName = spaceIdx !== -1 ? depNamePart.slice(0, spaceIdx) : depNamePart;
        const afterDep = spaceIdx !== -1 ? depNamePart.slice(spaceIdx + 1) : '';
        const afterDepTrimmed = afterDep.trim();

        if (afterDepTrimmed.startsWith('--replicas=')) {
          const numPart = afterDepTrimmed.slice('--replicas='.length);
          const replicaNumbers = ['1', '2', '3', '5', '10'];
          const filteredNums = replicaNumbers.filter(n => n.startsWith(numPart));

          return filteredNums.map(n => ({
            value: `kubectl scale deployment/${depName} --replicas=${n}`,
            label: `${n}`,
            category: 'Subcommand',
            description: `Set replica count to ${n}`,
          }));
        }

        if (!afterDepTrimmed || '--replicas='.startsWith(afterDepTrimmed)) {
          return [
            {
              value: `kubectl scale deployment/${depName} --replicas=`,
              label: '--replicas=',
              category: 'Subcommand',
              description: 'Specify replica count',
            },
          ];
        }
      } else {
        const matchedDeploys = deployNames.filter(name => name.toLowerCase().startsWith(depNamePart));
        return matchedDeploys.map(name => ({
          value: `kubectl scale deployment/${name} `,
          label: `deployment/${name}`,
          category: 'Deployment',
          description: `Deployment ${name}`,
        }));
      }
    }
  }

  // 2. `kubectl set image ...` sequence
  if (/^kubectl\s+set(?:\s+.*)?$/.test(normalizedInput)) {
    if (!hasDeployments) {
      return [
        {
          value: 'kubectl set image deployment/',
          label: 'set image deployment/',
          category: 'Subcommand',
          description: 'Update deployment container image',
          disabled: true,
          disabledReason: '(no Deployment on canvas)',
        },
      ];
    }
    if (/^kubectl\s+set(?:\s+i|\s+im|\s+ima|\s+imag|\s+image)?\s*$/.test(normalizedInput)) {
      return deployNames.map(name => ({
        value: `kubectl set image deployment/${name} `,
        label: `deployment/${name}`,
        category: 'Deployment',
        description: `Deployment ${name}`,
      }));
    }
    if (normalizedInput.startsWith('kubectl set image deployment/')) {
      const rest = normalizedInput.slice('kubectl set image deployment/'.length);
      if (!rest.includes(' ')) {
        const matched = deployNames.filter(name => name.toLowerCase().startsWith(rest));
        return matched.map(name => ({
          value: `kubectl set image deployment/${name} `,
          label: `deployment/${name}`,
          category: 'Deployment',
          description: `Deployment ${name}`,
        }));
      } else {
        const [depName] = rest.split(/\s+/);
        return [{
          value: `kubectl set image deployment/${depName} app-container=nginx:1.25`,
          label: 'app-container=nginx:1.25',
          category: 'Subcommand',
          description: 'Set container image version',
        }];
      }
    }
  }

  // 3. `kubectl rollout ...` sequence
  if (/^kubectl\s+rollout(?:\s+.*)?$/.test(normalizedInput)) {
    if (!hasDeployments) {
      return [
        {
          value: 'kubectl rollout status deploy/',
          label: 'rollout status deploy/',
          category: 'Subcommand',
          description: 'Show rollout status',
          disabled: true,
          disabledReason: '(no Deployment on canvas)',
        },
      ];
    }
    if (/^kubectl\s+rollout\s*$/.test(normalizedInput)) {
      const items: SuggestionItem[] = [];
      deployNames.forEach(name => {
        items.push(
          { value: `kubectl rollout status deploy/${name}`, label: `rollout status deploy/${name}`, category: 'Subcommand', description: 'Show rollout status' },
          { value: `kubectl rollout history deploy/${name}`, label: `rollout history deploy/${name}`, category: 'Subcommand', description: 'Show rollout history' },
          { value: `kubectl rollout undo deploy/${name}`, label: `rollout undo deploy/${name}`, category: 'Subcommand', description: 'Undo previous rollout' }
        );
      });
      return items;
    }
    const rolloutMatch = normalizedInput.match(/^kubectl\s+rollout\s+(status|history|undo)\s+deploy\/(.*)$/);
    if (rolloutMatch) {
      const action = rolloutMatch[1];
      const depNamePart = rolloutMatch[2];
      const matched = deployNames.filter(name => name.toLowerCase().startsWith(depNamePart));
      return matched.map(name => ({
        value: `kubectl rollout ${action} deploy/${name}`,
        label: `deploy/${name}`,
        category: 'Deployment',
        description: `Deployment ${name}`,
      }));
    }
  }

  // 4. `kubectl describe ...` sequence
  if (/^kubectl\s+describe(?:\s+.*)?$/.test(normalizedInput)) {
    if (/^kubectl\s+describe\s*$/.test(normalizedInput)) {
      return [
        { value: 'kubectl describe deploy ', label: 'describe deploy', category: 'Subcommand', description: 'Describe deployment', disabled: !hasDeployments, disabledReason: !hasDeployments ? '(no Deployment on canvas)' : undefined },
        { value: 'kubectl describe pod ', label: 'describe pod', category: 'Subcommand', description: 'Describe pod', disabled: !hasPods, disabledReason: !hasPods ? '(no Pod on canvas)' : undefined },
        { value: 'kubectl describe role ', label: 'describe role', category: 'Subcommand', description: 'Describe role' },
        { value: 'kubectl describe rolebinding ', label: 'describe rolebinding', category: 'Subcommand', description: 'Describe rolebinding' },
        { value: 'kubectl describe cm ', label: 'describe cm', category: 'Subcommand', description: 'Describe configmap' },
        { value: 'kubectl describe secret ', label: 'describe secret', category: 'Subcommand', description: 'Describe secret' },
      ];
    }
    if (normalizedInput.startsWith('kubectl describe deploy ')) {
      if (!hasDeployments) {
        return [{ value: 'kubectl describe deploy ', label: 'deploy', category: 'Deployment', description: 'Describe deployment', disabled: true, disabledReason: '(no Deployment on canvas)' }];
      }
      const rest = normalizedInput.slice('kubectl describe deploy '.length).trim();
      const matched = deployNames.filter(n => n.toLowerCase().startsWith(rest));
      return matched.map(name => ({
        value: `kubectl describe deploy ${name}`,
        label: name,
        category: 'Deployment',
        description: `Describe deployment ${name}`,
      }));
    }
    if (normalizedInput.startsWith('kubectl describe pod ')) {
      if (!hasPods) {
        return [{ value: 'kubectl describe pod ', label: 'pod', category: 'Pod', description: 'Describe pod', disabled: true, disabledReason: '(no Pod on canvas)' }];
      }
      const rest = normalizedInput.slice('kubectl describe pod '.length).trim();
      const matched = podNames.filter(n => n.toLowerCase().startsWith(rest));
      return matched.map(name => ({
        value: `kubectl describe pod ${name}`,
        label: name,
        category: 'Pod',
        description: `Describe pod ${name}`,
      }));
    }
  }

  // 5. `kubectl delete ...` sequence
  if (/^kubectl\s+delete(?:\s+.*)?$/.test(normalizedInput)) {
    if (/^kubectl\s+delete\s*$/.test(normalizedInput)) {
      return [
        { value: 'kubectl delete pod ', label: 'delete pod', category: 'Subcommand', description: 'Delete pod', disabled: !hasPods, disabledReason: !hasPods ? '(no Pod on canvas)' : undefined },
        { value: 'kubectl delete deployment ', label: 'delete deployment', category: 'Subcommand', description: 'Delete deployment', disabled: !hasDeployments, disabledReason: !hasDeployments ? '(no Deployment on canvas)' : undefined },
        { value: 'kubectl delete service ', label: 'delete service', category: 'Subcommand', description: 'Delete service' },
      ];
    }
    if (normalizedInput.startsWith('kubectl delete pod ')) {
      if (!hasPods) {
        return [{ value: 'kubectl delete pod ', label: 'pod', category: 'Pod', description: 'Delete pod', disabled: true, disabledReason: '(no Pod on canvas)' }];
      }
      const rest = normalizedInput.slice('kubectl delete pod '.length).trim();
      const matched = podNames.filter(n => n.toLowerCase().startsWith(rest));
      return matched.map(name => ({
        value: `kubectl delete pod ${name}`,
        label: name,
        category: 'Pod',
        description: `Delete pod ${name}`,
      }));
    }
  }

  // 6. `kubectl logs ...` sequence
  if (/^kubectl\s+logs(?:\s+.*)?$/.test(normalizedInput)) {
    if (!hasPods) {
      return [{ value: 'kubectl logs ', label: 'logs', category: 'Pod', description: 'Stream container logs', disabled: true, disabledReason: '(no Pod on canvas)' }];
    }
    if (/^kubectl\s+logs\s*$/.test(normalizedInput) || normalizedInput.startsWith('kubectl logs ')) {
      const rest = normalizedInput.replace(/^kubectl\s+logs\s*/, '').trim();
      const matched = podNames.filter(n => n.toLowerCase().startsWith(rest));
      return matched.map(name => ({
        value: `kubectl logs ${name}`,
        label: name,
        category: 'Pod',
        description: `Stream logs for ${name}`,
      }));
    }
  }

  // 7. Standard prefix-matching fallback
  const trimmedLower = input.trim().toLowerCase();
  const tokens = trimmedLower.split(/\s+/);

  let candidates: SuggestionItem[] = [];

  if (tokens[0] === 'kubectl' || 'kubectl'.startsWith(tokens[0])) {
    if (tokens.length === 1) {
      candidates = KUBECTL_TOP_COMMANDS.map(c => {
        if (c.value === 'kubectl scale' || c.value === 'kubectl set image' || c.value === 'kubectl rollout') {
          return { ...c, disabled: !hasDeployments, disabledReason: !hasDeployments ? '(no Deployment on canvas)' : undefined };
        }
        if (c.value === 'kubectl logs') {
          return { ...c, disabled: !hasPods, disabledReason: !hasPods ? '(no Pod on canvas)' : undefined };
        }
        return c;
      });
    } else {
      candidates = getKubectlSubcommandCandidates(tokens[1], nodes);
    }
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
