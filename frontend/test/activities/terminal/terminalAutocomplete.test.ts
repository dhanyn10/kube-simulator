import { describe, it, expect } from 'vitest';
import {
  getAutocompleteSuggestions,
  trimSuggestionLabel
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

    const scaleSugg = getAutocompleteSuggestions('kubectl scale', mockNodes);
    expect(scaleSugg[0].label).toBe('deployment/web-deployment');
    expect(scaleSugg[0].value).toBe('kubectl scale deployment/web-deployment ');
    expect(scaleSugg[0].disabled).toBeFalsy();

    const depSugg = getAutocompleteSuggestions('kubectl scale deployment/web-deployment ', mockNodes);
    expect(depSugg[0].label).toBe('--replicas=');
    expect(depSugg[0].value).toBe('kubectl scale deployment/web-deployment --replicas=');

    const numSugg = getAutocompleteSuggestions('kubectl scale deployment/web-deployment --replicas=', mockNodes);
    expect(numSugg.some(s => s.label === '3')).toBe(true);
    expect(numSugg.find(s => s.label === '3')?.value).toBe('kubectl scale deployment/web-deployment --replicas=3');
  });

  it('trims completed keywords from label for "kubectl get" while keeping full value and description', () => {
    const suggestions = getAutocompleteSuggestions('kubectl get ', []);
    const podSugg = suggestions.find(s => s.value === 'kubectl get pods');

    expect(podSugg).toBeDefined();
    expect(podSugg?.label).toBe('pods');
    expect(podSugg?.value).toBe('kubectl get pods');
    expect(podSugg?.description).toBe('List all pods on canvas');
  });

  it('trims completed keywords from label for "kubectl config"', () => {
    const suggestions = getAutocompleteSuggestions('kubectl config ', []);
    const ctxSugg = suggestions.find(s => s.value === 'kubectl config get-contexts');

    expect(ctxSugg).toBeDefined();
    expect(ctxSugg?.label).toBe('get-contexts');
    expect(ctxSugg?.value).toBe('kubectl config get-contexts');
    expect(ctxSugg?.description).toBe('List all available user contexts');
  });

  it('trims completed keywords for admin command sequence (try -> try version -> try version update)', () => {
    const trySugg = getAutocompleteSuggestions('try ', [], true);
    const verSugg = trySugg.find(s => s.value === 'try version update 0.5.0');
    expect(verSugg?.label).toBe('version update <version>');
    expect(verSugg?.value).toBe('try version update 0.5.0');
    expect(verSugg?.description).toBe('Simulate update notification badge button');

    const tryVerSugg = getAutocompleteSuggestions('try version ', [], true);
    const updSugg = tryVerSugg.find(s => s.value === 'try version update 0.5.0');
    expect(updSugg?.label).toBe('update <version>');
    expect(updSugg?.value).toBe('try version update 0.5.0');
    expect(updSugg?.description).toBe('Simulate update notification badge button');
  });

  it('returns dynamic resource suggestions for deployments and pods, excluding Deployment labels from pod suggestions', () => {
    const mockNodes: Node[] = [
      { id: 'pod-101', type: 'Pod', data: { label: 'my-custom-pod-x8k2p' }, position: { x: 0, y: 0 } },
      { id: 'dep-202', type: 'Deployment', data: { label: 'my-backend-app' }, position: { x: 0, y: 0 } }
    ];

    const logsSugg = getAutocompleteSuggestions('kubectl logs ', mockNodes);
    expect(logsSugg.some(s => s.label === 'my-custom-pod-x8k2p')).toBe(true);
    expect(logsSugg.some(s => s.label === 'my-backend-app')).toBe(false);

    const descSugg = getAutocompleteSuggestions('kubectl describe pod ', mockNodes);
    expect(descSugg.some(s => s.label === 'my-custom-pod-x8k2p')).toBe(true);
    expect(descSugg.some(s => s.label === 'my-backend-app')).toBe(false);
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

  it('trimSuggestionLabel handles custom multi-token command sequences correctly', () => {
    const item = {
      value: 'a b c d e',
      label: 'a b c d e',
      category: 'Command' as const,
      description: 'Full description for a b c d e'
    };

    expect(trimSuggestionLabel(item, 'a ').label).toBe('b c d e');
    expect(trimSuggestionLabel(item, 'a b ').label).toBe('c d e');
    expect(trimSuggestionLabel(item, 'a b c ').label).toBe('d e');
    expect(trimSuggestionLabel(item, 'a b c d ').label).toBe('e');

    expect(trimSuggestionLabel(item, 'a b c d ').value).toBe('a b c d e');
    expect(trimSuggestionLabel(item, 'a b c d ').description).toBe('Full description for a b c d e');
  });
});
