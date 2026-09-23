import { Node } from '@xyflow/react';

export interface SuggestionItem {
  value: string;
  label: string;
  category: 'Command' | 'Subcommand' | 'Pod' | 'Deployment' | 'Service' | 'Utility' | 'Admin';
  description?: string;
  subItems?: string[];
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
  { value: 'kubectl get pods', label: 'kubectl get pods', category: 'Command', description: 'List all pods on canvas' },
  { value: 'kubectl get deployments', label: 'kubectl get deployments', category: 'Command', description: 'List deployments on canvas' },
  { value: 'kubectl get services', label: 'kubectl get services', category: 'Command', description: 'List services on canvas' },
  { value: 'kubectl get roles', label: 'kubectl get roles', category: 'Command', description: 'List roles on canvas' },
  { value: 'kubectl get rolebindings', label: 'kubectl get rolebindings', category: 'Command', description: 'List rolebindings on canvas' },
  { value: 'kubectl get configmaps', label: 'kubectl get configmaps', category: 'Command', description: 'List configmaps on canvas' },
  { value: 'kubectl get secrets', label: 'kubectl get secrets', category: 'Command', description: 'List secrets on canvas' },
  { value: 'kubectl get all', label: 'kubectl get all', category: 'Command', description: 'List all resources on canvas' },
];

export const ROLLOUT_SUBCOMMANDS: SuggestionItem[] = [
  { value: 'kubectl rollout status deploy/', label: 'kubectl rollout status deploy/<name>', category: 'Command', description: 'Check rolling update progress' },
  { value: 'kubectl rollout history deploy/', label: 'kubectl rollout history deploy/<name>', category: 'Command', description: 'View revision history' },
  { value: 'kubectl rollout undo deploy/', label: 'kubectl rollout undo deploy/<name>', category: 'Command', description: 'Rollback to previous revision' },
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

export const getResourceNamesByType = (nodes: Node[], nodeType: string): string[] => {
  const matching = nodes.filter(n => n.type === nodeType);
  return matching.map(m => String(m.data?.label || m.id));
};

export const getResourceSuggestions = (nodes: Node[]): SuggestionItem[] => {
  const suggestions: SuggestionItem[] = [];

  const deployments = nodes.filter(n => n.type === 'Deployment');
  deployments.forEach(d => {
    const name = d.data.label || d.id;
    suggestions.push(
      { value: `kubectl scale deployment/${name} --replicas=3`, label: `kubectl scale deployment/${name} --replicas=3`, category: 'Deployment', description: `Scale deployment ${name}` },
      { value: `kubectl set image deployment/${name} app-container=nginx:1.25`, label: `kubectl set image deployment/${name} app-container=nginx:1.25`, category: 'Deployment', description: `Update image for ${name}` },
      { value: `kubectl rollout status deploy/${name}`, label: `kubectl rollout status deploy/${name}`, category: 'Deployment', description: `Rollout status for ${name}` },
      { value: `kubectl rollout history deploy/${name}`, label: `kubectl rollout history deploy/${name}`, category: 'Deployment', description: `Rollout history for ${name}` },
      { value: `kubectl rollout undo deploy/${name}`, label: `kubectl rollout undo deploy/${name}`, category: 'Deployment', description: `Rollback deployment ${name}` },
      { value: `kubectl describe deploy ${name}`, label: `kubectl describe deploy ${name}`, category: 'Deployment', description: `Describe deployment ${name}` }
    );
  });

  const pods = nodes.filter(n => n.type === 'Pod');
  pods.forEach(p => {
    const name = p.data.label || p.id;
    suggestions.push(
      { value: `kubectl delete pod ${name}`, label: `kubectl delete pod ${name}`, category: 'Pod', description: `Delete pod ${name}` },
      { value: `kubectl describe pod ${name}`, label: `kubectl describe pod ${name}`, category: 'Pod', description: `Describe pod ${name}` }
    );
  });

  return suggestions;
};

export const getKubectlSubcommandCandidates = (sub: string, nodes: Node[] = []): SuggestionItem[] => {
  const list: SuggestionItem[] = [];
  if (sub === 'get' || 'get'.startsWith(sub)) {
    list.push(...GET_SUBCOMMANDS);
  }
  if (sub === 'config' || 'config'.startsWith(sub)) {
    list.push(...CONFIG_SUBCOMMANDS);
  }
  if (sub === 'rollout' || 'rollout'.startsWith(sub)) {
    list.push(...ROLLOUT_SUBCOMMANDS);
  }
  if (sub === 'logs' || 'logs'.startsWith(sub)) {
    const podNames = getPodNames(nodes);
    list.push({
      value: 'kubectl logs ',
      label: 'kubectl logs <pod-name>',
      category: 'Subcommand',
      description: 'Stream container logs',
      subItems: podNames,
    });
  }
  if (sub === 'describe' || 'describe'.startsWith(sub)) {
    list.push(
      { value: 'kubectl describe deploy ', label: 'kubectl describe deploy <name>', category: 'Subcommand', description: 'Describe deployment specs' },
      { value: 'kubectl describe pod ', label: 'kubectl describe pod <name>', category: 'Subcommand', description: 'Describe pod specs & events' },
      { value: 'kubectl describe role ', label: 'kubectl describe role <name>', category: 'Subcommand', description: 'Describe role specs & rules' },
      { value: 'kubectl describe rolebinding ', label: 'kubectl describe rolebinding <name>', category: 'Subcommand', description: 'Describe rolebinding specs & subjects' },
      { value: 'kubectl describe cm ', label: 'kubectl describe cm <name>', category: 'Subcommand', description: 'Describe configmap data' },
      { value: 'kubectl describe secret ', label: 'kubectl describe secret <name>', category: 'Subcommand', description: 'Describe secret data' }
    );
  }
  if (sub === 'scale' || 'scale'.startsWith(sub)) {
    list.push({ value: 'kubectl scale deployment/', label: 'kubectl scale deployment/<name> --replicas=<num>', category: 'Subcommand', description: 'Scale deployment replicas' });
  }
  if (sub === 'set' || 'set'.startsWith(sub)) {
    list.push({ value: 'kubectl set image deployment/', label: 'kubectl set image deployment/<name> container=<image>', category: 'Subcommand', description: 'Set container image' });
  }
  if (sub === 'delete' || 'delete'.startsWith(sub)) {
    list.push({ value: 'kubectl delete pod ', label: 'kubectl delete pod <name>', category: 'Subcommand', description: 'Delete pod' });
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

  // 1. `kubectl scale ...` sequence
  if (/^kubectl\s+scale(?:\s+.*)?$/.test(normalizedInput)) {
    const scaleMatch = normalizedInput.match(/^kubectl\s+scale(?:\s+(.*))?$/);
    const rest = scaleMatch ? (scaleMatch[1] || '').trim() : '';

    if (!rest) {
      return [
        {
          value: 'kubectl scale deployment/',
          label: 'deployment/',
          category: 'Subcommand',
          description: 'Scale a deployment resource',
        },
      ];
    }

    if (rest.startsWith('deployment/')) {
      const depNamePart = rest.slice('deployment/'.length);

      // Sub-case: user typed `kubectl scale deployment/<depName>` or `kubectl scale deployment/<depName> `
      if (depNamePart.includes(' ')) {
        const [depName, afterDep] = depNamePart.split(/\s+/, 2);
        const afterDepTrimmed = (afterDep || '').trim();

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
      } else {
        // User is typing deployment name e.g. `deployment/front`
        const deployNames = getDeploymentNames(nodes);
        const candidates = deployNames.length > 0 ? deployNames : ['my-deployment'];
        const matchedDeploys = candidates.filter(name => name.toLowerCase().startsWith(depNamePart));

        return matchedDeploys.map(name => ({
          value: `kubectl scale deployment/${name} `,
          label: name,
          category: 'Deployment',
          description: `Deployment ${name}`,
        }));
      }
    }
  }

  // 2. `kubectl set image ...` sequence
  if (/^kubectl\s+set(?:\s+.*)?$/.test(normalizedInput)) {
    if (/^kubectl\s+set(?:\s+i|\s+im|\s+ima|\s+imag|\s+image)?\s*$/.test(normalizedInput)) {
      return [{ value: 'kubectl set image deployment/', label: 'image deployment/', category: 'Subcommand', description: 'Update deployment container image' }];
    }
    if (normalizedInput.startsWith('kubectl set image deployment/')) {
      const rest = normalizedInput.slice('kubectl set image deployment/'.length);
      if (!rest.includes(' ')) {
        const deployNames = getDeploymentNames(nodes);
        const candidates = deployNames.length > 0 ? deployNames : ['my-deployment'];
        const matched = candidates.filter(name => name.toLowerCase().startsWith(rest));
        return matched.map(name => ({
          value: `kubectl set image deployment/${name} `,
          label: name,
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
    if (/^kubectl\s+rollout\s*$/.test(normalizedInput)) {
      return [
        { value: 'kubectl rollout status deploy/', label: 'status deploy/', category: 'Subcommand', description: 'Show rollout status' },
        { value: 'kubectl rollout history deploy/', label: 'history deploy/', category: 'Subcommand', description: 'Show rollout history' },
        { value: 'kubectl rollout undo deploy/', label: 'undo deploy/', category: 'Subcommand', description: 'Undo previous rollout' },
      ];
    }
    const rolloutMatch = normalizedInput.match(/^kubectl\s+rollout\s+(status|history|undo)\s+deploy\/(.*)$/);
    if (rolloutMatch) {
      const action = rolloutMatch[1];
      const depNamePart = rolloutMatch[2];
      const deployNames = getDeploymentNames(nodes);
      const candidates = deployNames.length > 0 ? deployNames : ['my-deployment'];
      const matched = candidates.filter(name => name.toLowerCase().startsWith(depNamePart));
      return matched.map(name => ({
        value: `kubectl rollout ${action} deploy/${name}`,
        label: name,
        category: 'Deployment',
        description: `Deployment ${name}`,
      }));
    }
  }

  // 4. `kubectl describe ...` sequence
  if (/^kubectl\s+describe(?:\s+.*)?$/.test(normalizedInput)) {
    if (/^kubectl\s+describe\s*$/.test(normalizedInput)) {
      return [
        { value: 'kubectl describe deploy ', label: 'deploy', category: 'Subcommand', description: 'Describe deployment' },
        { value: 'kubectl describe pod ', label: 'pod', category: 'Subcommand', description: 'Describe pod' },
        { value: 'kubectl describe role ', label: 'role', category: 'Subcommand', description: 'Describe role' },
        { value: 'kubectl describe rolebinding ', label: 'rolebinding', category: 'Subcommand', description: 'Describe rolebinding' },
        { value: 'kubectl describe cm ', label: 'cm', category: 'Subcommand', description: 'Describe configmap' },
        { value: 'kubectl describe secret ', label: 'secret', category: 'Subcommand', description: 'Describe secret' },
      ];
    }
    if (normalizedInput.startsWith('kubectl describe deploy ')) {
      const rest = normalizedInput.slice('kubectl describe deploy '.length).trim();
      const deployNames = getDeploymentNames(nodes);
      const matched = deployNames.filter(n => n.toLowerCase().startsWith(rest));
      return matched.map(name => ({
        value: `kubectl describe deploy ${name}`,
        label: name,
        category: 'Deployment',
        description: `Describe deployment ${name}`,
      }));
    }
    if (normalizedInput.startsWith('kubectl describe pod ')) {
      const rest = normalizedInput.slice('kubectl describe pod '.length).trim();
      const podNames = getPodNames(nodes);
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
        { value: 'kubectl delete pod ', label: 'pod', category: 'Subcommand', description: 'Delete pod' },
        { value: 'kubectl delete deployment ', label: 'deployment', category: 'Subcommand', description: 'Delete deployment' },
        { value: 'kubectl delete service ', label: 'service', category: 'Subcommand', description: 'Delete service' },
      ];
    }
    if (normalizedInput.startsWith('kubectl delete pod ')) {
      const rest = normalizedInput.slice('kubectl delete pod '.length).trim();
      const podNames = getPodNames(nodes);
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
    if (/^kubectl\s+logs\s*$/.test(normalizedInput) || normalizedInput.startsWith('kubectl logs ')) {
      const rest = normalizedInput.replace(/^kubectl\s+logs\s*/, '').trim();
      const podNames = getPodNames(nodes);
      const matched = podNames.filter(n => n.toLowerCase().startsWith(rest));
      return matched.map(name => ({
        value: `kubectl logs ${name}`,
        label: name,
        category: 'Pod',
        description: `Stream logs for ${name}`,
      }));
    }
  }

  // 7. Standard prefix-matching fallback for top-level commands & subcommands
  const trimmedLower = input.trim().toLowerCase();
  const tokens = trimmedLower.split(/\s+/);

  let candidates: SuggestionItem[] = [];

  if (tokens[0] === 'kubectl' || 'kubectl'.startsWith(tokens[0])) {
    if (tokens.length === 1) {
      candidates = [...KUBECTL_TOP_COMMANDS];
    } else {
      candidates = getKubectlSubcommandCandidates(tokens[1], nodes);
      candidates.push(...getResourceSuggestions(nodes));
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
