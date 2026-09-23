import { describe, it, expect } from 'vitest';
import {
  KUBECTL_TOP_COMMANDS,
  GET_SUBCOMMANDS,
  UTILITY_COMMANDS,
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
  });

  it('disables scale command when no Deployment is on canvas', () => {
    const suggestions = getAutocompleteSuggestions('kubectl scale', []);
    expect(suggestions[0].disabled).toBe(true);
    expect(suggestions[0].disabledReason).toContain('no Deployment on canvas');
  });

  it('returns next keyword suggestions sequentially for kubectl scale when Deployment exists', () => {
    const mockNodes: Node[] = [
      { id: 'dep-web', type: 'Deployment', data: { label: 'web-deployment' }, position: { x: 0, y: 0 } },
    ];

    // Step 1: `kubectl scale` -> offers canvas deployment name `deployment/web-deployment`
    const scaleSugg = getAutocompleteSuggestions('kubectl scale', mockNodes);
    expect(scaleSugg[0].label).toBe('deployment/web-deployment');
    expect(scaleSugg[0].disabled).toBeFalsy();

    // Step 2: `kubectl scale deployment/` -> offers canvas deployment name `deployment/web-deployment`
    const depSugg = getAutocompleteSuggestions('kubectl scale deployment/', mockNodes);
    expect(depSugg.some(s => s.label === 'deployment/web-deployment')).toBe(true);

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
