import { describe, it, expect } from 'vitest';
import {
  KUBECTL_TOP_COMMANDS,
  GET_SUBCOMMANDS,
  ROLLOUT_SUBCOMMANDS,
  UTILITY_COMMANDS,
  getResourceSuggestions,
  getAutocompleteSuggestions
} from '@/activities/terminal/terminalAutocomplete';
import { Node } from '@xyflow/react';

describe('terminalAutocomplete', () => {
  it('returns general top subcommands when typing "kubectl"', () => {
    const suggestions = getAutocompleteSuggestions('kubectl', []);
    expect(suggestions).toHaveLength(8);
    expect(suggestions.some(s => s.value === 'kubectl get')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl config')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl logs')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl describe')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl scale')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl set image')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl rollout')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl delete')).toBe(true);
  });

  it('returns next keyword suggestions sequentially for kubectl scale sequence', () => {
    const mockNodes: Node[] = [
      { id: 'dep-web', type: 'Deployment', data: { label: 'web-deployment' }, position: { x: 0, y: 0 } },
    ];

    // Step 1: `kubectl scale` -> offers `deployment/`
    const scaleSugg = getAutocompleteSuggestions('kubectl scale', mockNodes);
    expect(scaleSugg[0].value).toBe('kubectl scale deployment/');

    // Step 2: `kubectl scale deployment/` -> offers canvas deployment name `web-deployment`
    const depSugg = getAutocompleteSuggestions('kubectl scale deployment/', mockNodes);
    expect(depSugg.some(s => s.label === 'web-deployment')).toBe(true);

    // Step 3: `kubectl scale deployment/web-deployment ` -> offers `--replicas=`
    const flagSugg = getAutocompleteSuggestions('kubectl scale deployment/web-deployment ', mockNodes);
    expect(flagSugg[0].label).toBe('--replicas=');

    // Step 4: `kubectl scale deployment/web-deployment --replicas=` -> offers replica number options
    const numSugg = getAutocompleteSuggestions('kubectl scale deployment/web-deployment --replicas=', mockNodes);
    expect(numSugg.some(s => s.label === '3')).toBe(true);
  });

  it('returns dynamic resource suggestions for deployments and pods', () => {
    const mockNodes: Node[] = [
      { id: 'pod-101', type: 'Pod', data: { label: 'my-custom-pod' }, position: { x: 0, y: 0 } },
      { id: 'dep-202', type: 'Deployment', data: { label: 'my-backend-app' }, position: { x: 0, y: 0 } }
    ];

    const logsSugg = getAutocompleteSuggestions('kubectl logs ', mockNodes);
    expect(logsSugg.some(s => s.label === 'my-custom-pod')).toBe(true);
    expect(logsSugg.some(s => s.label === 'my-backend-app')).toBe(true);
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

  it('handles autocomplete for rollout, set image, and describe commands with canvas resources', () => {
    const mockNodes: Node[] = [
      { id: 'dep-api', type: 'Deployment', data: { label: 'api-service' }, position: { x: 0, y: 0 } }
    ];

    const rolloutSuggestions = getAutocompleteSuggestions('kubectl rollout status deploy/', mockNodes);
    expect(rolloutSuggestions.some(s => s.label === 'api-service')).toBe(true);

    const describeSuggestions = getAutocompleteSuggestions('kubectl describe deploy ', mockNodes);
    expect(describeSuggestions.some(s => s.label === 'api-service')).toBe(true);
  });
});
