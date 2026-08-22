import { describe, it, expect } from 'vitest';
import {
  KUBECTL_TOP_COMMANDS,
  GET_SUBCOMMANDS,
  ROLLOUT_SUBCOMMANDS,
  UTILITY_COMMANDS,
  getResourceSuggestions,
  getAutocompleteSuggestions
} from '../../../src/components/Layout/terminalAutocomplete';
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

  it('returns specific subcommands for get, rollout, logs, describe, scale, set, delete', () => {
    const getSugg = getAutocompleteSuggestions('kubectl get', []);
    expect(getSugg.some(s => s.value === 'kubectl get pods')).toBe(true);

    const rolloutSugg = getAutocompleteSuggestions('kubectl rollout', []);
    expect(rolloutSugg.some(s => s.value.includes('rollout status'))).toBe(true);

    const logsSugg = getAutocompleteSuggestions('kubectl logs', []);
    expect(logsSugg.some(s => s.value === 'kubectl logs ')).toBe(true);

    const describeSugg = getAutocompleteSuggestions('kubectl describe', []);
    expect(describeSugg.some(s => s.value.includes('describe deploy'))).toBe(true);

    const scaleSugg = getAutocompleteSuggestions('kubectl scale', []);
    expect(scaleSugg.some(s => s.value.includes('scale deployment'))).toBe(true);

    const setSugg = getAutocompleteSuggestions('kubectl set', []);
    expect(setSugg.some(s => s.value.includes('set image'))).toBe(true);

    const deleteSugg = getAutocompleteSuggestions('kubectl delete', []);
    expect(deleteSugg.some(s => s.value.includes('delete pod'))).toBe(true);
  });

  it('generates dynamic resource suggestions for deployments and pods', () => {
    const mockNodes: Node[] = [
      { id: 'pod-101', type: 'Pod', data: { label: 'my-custom-pod' }, position: { x: 0, y: 0 } },
      { id: 'dep-202', type: 'Deployment', data: { label: 'my-backend-app' }, position: { x: 0, y: 0 } }
    ];

    const resSuggestions = getResourceSuggestions(mockNodes);
    expect(resSuggestions.some(s => s.value.includes('my-custom-pod'))).toBe(true);
    expect(resSuggestions.some(s => s.value.includes('my-backend-app'))).toBe(true);

    const logsSugg = getAutocompleteSuggestions('kubectl logs', mockNodes);
    expect(logsSugg.some(s => s.value === 'kubectl logs my-custom-pod')).toBe(true);
    expect(logsSugg.some(s => s.value === 'kubectl logs my-backend-app')).toBe(true);
  });

  it('filters utility commands and handles empty input', () => {
    expect(getAutocompleteSuggestions('', [])).toEqual([]);
    expect(getAutocompleteSuggestions('   ', [])).toEqual([]);

    const clearMatch = getAutocompleteSuggestions('clea', []);
    expect(clearMatch).toHaveLength(1);
    expect(clearMatch[0].value).toBe('clear');

    const helpMatch = getAutocompleteSuggestions('hel', []);
    expect(helpMatch.some(s => s.value === 'help')).toBe(true);
  });
});
