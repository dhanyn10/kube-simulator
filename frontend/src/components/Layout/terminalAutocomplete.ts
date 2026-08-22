import { Node } from '@xyflow/react';

export interface SuggestionItem {
  value: string;
  label: string;
  category: 'Command' | 'Subcommand' | 'Pod' | 'Deployment' | 'Service' | 'Utility';
  description?: string;
}

// Level 1: General subcommands when user types 'kubectl' or 'k'
export const KUBECTL_TOP_COMMANDS: SuggestionItem[] = [
  { value: 'kubectl get', label: 'kubectl get', category: 'Subcommand', description: 'Display one or many resources' },
  { value: 'kubectl logs', label: 'kubectl logs', category: 'Subcommand', description: 'Print the logs for a container in a pod' },
  { value: 'kubectl describe', label: 'kubectl describe', category: 'Subcommand', description: 'Show details of a specific resource' },
  { value: 'kubectl scale', label: 'kubectl scale', category: 'Subcommand', description: 'Set a new size for a Deployment' },
  { value: 'kubectl set image', label: 'kubectl set image', category: 'Subcommand', description: 'Update image of a Deployment' },
  { value: 'kubectl rollout', label: 'kubectl rollout', category: 'Subcommand', description: 'Manage the rollout of a resource' },
  { value: 'kubectl delete', label: 'kubectl delete', category: 'Subcommand', description: 'Delete resources by resource and name' },
];

// Level 2: Specific subcommands after typing 'kubectl get'
export const GET_SUBCOMMANDS: SuggestionItem[] = [
  { value: 'kubectl get pods', label: 'kubectl get pods', category: 'Command', description: 'List all pods on canvas' },
  { value: 'kubectl get deployments', label: 'kubectl get deployments', category: 'Command', description: 'List deployments on canvas' },
  { value: 'kubectl get services', label: 'kubectl get services', category: 'Command', description: 'List services on canvas' },
  { value: 'kubectl get all', label: 'kubectl get all', category: 'Command', description: 'List all resources on canvas' },
];

// Level 2: Subcommands after 'kubectl rollout'
export const ROLLOUT_SUBCOMMANDS: SuggestionItem[] = [
  { value: 'kubectl rollout status deploy/', label: 'kubectl rollout status deploy/<name>', category: 'Command', description: 'Check rolling update progress' },
  { value: 'kubectl rollout history deploy/', label: 'kubectl rollout history deploy/<name>', category: 'Command', description: 'View revision history' },
  { value: 'kubectl rollout undo deploy/', label: 'kubectl rollout undo deploy/<name>', category: 'Command', description: 'Rollback to previous revision' },
];

// Top level standalone utilities
export const UTILITY_COMMANDS: SuggestionItem[] = [
  { value: 'history', label: 'history', category: 'Utility', description: 'View command execution history' },
  { value: 'help', label: 'help', category: 'Utility', description: 'Show help and available commands' },
  { value: 'clear', label: 'clear', category: 'Utility', description: 'Clear terminal output' },
];

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
      { value: `kubectl describe deploy ${name}`, label: `kubectl describe deploy ${name}`, category: 'Deployment', description: `Describe deployment ${name}` },
      { value: `kubectl logs deployment/${name}`, label: `kubectl logs deployment/${name}`, category: 'Deployment', description: `Logs for deployment ${name}` }
    );
  });

  const pods = nodes.filter(n => n.type === 'Pod');
  pods.forEach(p => {
    const name = p.data.label || p.id;
    suggestions.push(
      { value: `kubectl delete pod ${name}`, label: `kubectl delete pod ${name}`, category: 'Pod', description: `Delete pod ${name}` },
      { value: `kubectl logs ${name}`, label: `kubectl logs ${name}`, category: 'Pod', description: `View logs for pod ${name}` },
      { value: `kubectl describe pod ${name}`, label: `kubectl describe pod ${name}`, category: 'Pod', description: `Describe pod ${name}` }
    );
  });

  return suggestions;
};

// Helper function to resolve subcommands for 'kubectl <subcommand>' inputs
export const getKubectlSubcommandCandidates = (sub: string): SuggestionItem[] => {
  const list: SuggestionItem[] = [];
  if (sub === 'get' || 'get'.startsWith(sub)) {
    list.push(...GET_SUBCOMMANDS);
  }
  if (sub === 'rollout' || 'rollout'.startsWith(sub)) {
    list.push(...ROLLOUT_SUBCOMMANDS);
  }
  if (sub === 'logs' || 'logs'.startsWith(sub)) {
    list.push({ value: 'kubectl logs ', label: 'kubectl logs <pod-name>', category: 'Subcommand', description: 'Stream container logs' });
  }
  if (sub === 'describe' || 'describe'.startsWith(sub)) {
    list.push(
      { value: 'kubectl describe deploy ', label: 'kubectl describe deploy <name>', category: 'Subcommand', description: 'Describe deployment specs' },
      { value: 'kubectl describe pod ', label: 'kubectl describe pod <name>', category: 'Subcommand', description: 'Describe pod specs & events' }
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

export const getAutocompleteSuggestions = (input: string, nodes: Node[]): SuggestionItem[] => {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const inputLower = trimmed.toLowerCase();
  const tokens = inputLower.split(/\s+/);

  let candidates: SuggestionItem[] = [];

  if (tokens[0] === 'kubectl' || 'kubectl'.startsWith(tokens[0])) {
    if (tokens.length === 1) {
      candidates = [...KUBECTL_TOP_COMMANDS];
    } else {
      candidates = getKubectlSubcommandCandidates(tokens[1]);
      candidates.push(...getResourceSuggestions(nodes));
    }
  } else {
    candidates = [...UTILITY_COMMANDS, ...KUBECTL_TOP_COMMANDS];
  }

  const matched = candidates.filter(item =>
    item.value.toLowerCase().includes(inputLower) ||
    item.label.toLowerCase().includes(inputLower)
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
