import { describe, it, expect } from 'vitest';
import { BASE_SUGGESTIONS, getResourceSuggestions, getAutocompleteSuggestions } from '../../../src/components/Layout/terminalAutocomplete';
import { Node } from '@xyflow/react';

describe('terminalAutocomplete', () => {
  it('returns base suggestions matching input', () => {
    const suggestions = getAutocompleteSuggestions('kubectl get', []);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some(s => s.value === 'kubectl get pods')).toBe(true);
    expect(suggestions.some(s => s.value === 'kubectl get deployments')).toBe(true);
  });

  it('generates dynamic resource suggestions based on canvas nodes', () => {
    const mockNodes: Node[] = [
      { id: 'pod-101', type: 'Pod', data: { label: 'my-custom-pod' }, position: { x: 0, y: 0 } },
      { id: 'dep-202', type: 'Deployment', data: { label: 'my-backend-app' }, position: { x: 0, y: 0 } }
    ];

    const resSuggestions = getResourceSuggestions(mockNodes);
    expect(resSuggestions.some(s => s.value.includes('my-custom-pod'))).toBe(true);
    expect(resSuggestions.some(s => s.value.includes('my-backend-app'))).toBe(true);
  });

  it('filters suggestions and handles empty string', () => {
    expect(getAutocompleteSuggestions('', [])).toEqual([]);
    expect(getAutocompleteSuggestions('   ', [])).toEqual([]);

    const clearMatch = getAutocompleteSuggestions('clea', []);
    expect(clearMatch).toHaveLength(1);
    expect(clearMatch[0].value).toBe('clear');
  });
});
