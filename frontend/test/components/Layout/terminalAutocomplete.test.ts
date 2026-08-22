import { describe, it, expect } from 'vitest';
import { KUBECTL_TOP_COMMANDS, getResourceSuggestions, getAutocompleteSuggestions } from '../../../src/components/Layout/terminalAutocomplete';
import { Node } from '@xyflow/react';

describe('terminalAutocomplete', () => {
  it('returns general top subcommands when typing "kubectl"', () => {
    const suggestions = getAutocompleteSuggestions('kubectl', []);
    expect(suggestions).toHaveLength(7);
    expect(suggestions.some(s => s.value === 'kubectl get')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl logs')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl describe')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl scale')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl set image')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl rollout')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl delete')).toBe(true);
  });

  it('returns specific subcommands when typing "kubectl get"', () => {
    const suggestions = getAutocompleteSuggestions('kubectl get', []);
    expect(suggestions.some(s => s.value === 'kubectl get pods')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl get deployments')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl get services')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl get all')).toBe(true);
  });

  it('generates dynamic resource suggestions based on canvas nodes when typing deeper commands', () => {
    const mockNodes: Node[] = [
      { id: 'pod-101', type: 'Pod', data: { label: 'my-custom-pod' }, position: { x: 0, y: 0 } },
      { id: 'dep-202', type: 'Deployment', data: { label: 'my-backend-app' }, position: { x: 0, y: 0 } }
    ];

    const suggestions = getAutocompleteSuggestions('kubectl logs', mockNodes);
    expect(suggestions.some(s => s.value.includes('my-custom-pod'))).toBe(true);
    expect(suggestions.some(s => s.value.includes('my-backend-app'))).toBe(true);
  });

  it('filters suggestions and handles empty input', () => {
    expect(getAutocompleteSuggestions('', [])).toEqual([]);
    expect(getAutocompleteSuggestions('   ', [])).toEqual([]);

    const clearMatch = getAutocompleteSuggestions('clea', []);
    expect(clearMatch).toHaveLength(1);
    expect(clearMatch[0].value).toBe('clear');
  });
});
