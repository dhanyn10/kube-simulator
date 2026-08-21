import { Node } from '@xyflow/react';

export interface SuggestionItem {
  value: string;
  label: string;
  category: 'Command' | 'Pod' | 'Deployment' | 'Service' | 'Utility';
  description?: string;
}

export const BASE_SUGGESTIONS: SuggestionItem[] = [
  { value: 'kubectl get pods', label: 'kubectl get pods', category: 'Command', description: 'List all pods on canvas' },
  { value: 'kubectl get deployments', label: 'kubectl get deployments', category: 'Command', description: 'List deployments on canvas' },
  { value: 'kubectl get services', label: 'kubectl get services', category: 'Command', description: 'List services on canvas' },
  { value: 'kubectl get all', label: 'kubectl get all', category: 'Command', description: 'List all resources on canvas' },
  { value: 'kubectl scale deployment/', label: 'kubectl scale deployment/<name> --replicas=<num>', category: 'Command', description: 'Scale deployment replicas' },
  { value: 'kubectl set image deployment/', label: 'kubectl set image deployment/<name> container=<image>', category: 'Command', description: 'Set container image (triggers update)' },
  { value: 'kubectl rollout status deploy/', label: 'kubectl rollout status deploy/<name>', category: 'Command', description: 'Check rolling update progress' },
  { value: 'kubectl rollout history deploy/', label: 'kubectl rollout history deploy/<name>', category: 'Command', description: 'View revision history' },
  { value: 'kubectl rollout undo deploy/', label: 'kubectl rollout undo deploy/<name>', category: 'Command', description: 'Rollback to previous revision' },
  { value: 'kubectl delete pod ', label: 'kubectl delete pod <name>', category: 'Command', description: 'Delete pod (triggers self-healing)' },
  { value: 'kubectl logs ', label: 'kubectl logs <pod-name>', category: 'Command', description: 'Stream container logs' },
  { value: 'kubectl describe deploy ', label: 'kubectl describe deploy <name>', category: 'Command', description: 'Describe deployment specs' },
  { value: 'kubectl describe pod ', label: 'kubectl describe pod <name>', category: 'Command', description: 'Describe pod specs & events' },
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

export const getAutocompleteSuggestions = (input: string, nodes: Node[]): SuggestionItem[] => {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const inputLower = input.toLowerCase();
  const allCandidates = [...BASE_SUGGESTIONS, ...getResourceSuggestions(nodes)];

  // Deduplicate and filter candidates by matching input string
  const matched = allCandidates.filter(item => item.value.toLowerCase().includes(inputLower) || item.label.toLowerCase().includes(inputLower));

  const seen = new Set<string>();
  const uniqueSuggestions: SuggestionItem[] = [];

  matched.forEach(item => {
    if (!seen.has(item.value)) {
      seen.add(item.value);
      uniqueSuggestions.push(item);
    }
  });

  return uniqueSuggestions.slice(0, 8);
};
