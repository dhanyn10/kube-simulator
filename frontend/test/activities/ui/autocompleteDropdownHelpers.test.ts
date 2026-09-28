import { describe, it, expect } from 'vitest';
import {
  checkMeaningfulDescription,
  getDropdownCategoryClass,
  getItemRowBgClass,
  getInfoBtnClass,
  getSubItemClass,
} from '@/activities/ui/autocompleteDropdownHelpers';

describe('autocompleteDropdownHelpers', () => {
  it('checks if description is meaningful', () => {
    expect(checkMeaningfulDescription({ label: 'kubectl get', value: 'kubectl get', description: 'Fetch K8s resources' })).toBe(true);
    expect(checkMeaningfulDescription({ label: 'kubectl get', value: 'kubectl get', description: 'kubectl get' })).toBe(false);
    expect(checkMeaningfulDescription({ label: 'kubectl get', value: 'kubectl get', description: '' })).toBe(false);
  });

  it('returns category class correctly', () => {
    expect(getDropdownCategoryClass({ label: 'Pod', value: 'Pod', category: 'add to canvas' }, false, true)).toContain('bg-amber-500/20');
    expect(getDropdownCategoryClass({ label: 'Pod', value: 'Pod', category: 'add to canvas' }, false, false)).toContain('bg-amber-100');
    expect(getDropdownCategoryClass({ label: 'Pod', value: 'Pod', category: 'CLI' }, true, true)).toContain('bg-indigo-600');
    expect(getDropdownCategoryClass({ label: 'Pod', value: 'Pod', category: 'CLI' }, false, true)).toContain('bg-slate-800');
  });

  it('returns row background, info button, and sub-item classes', () => {
    expect(getItemRowBgClass(true, true)).toContain('bg-indigo-600/30');
    expect(getItemRowBgClass(false, false)).toContain('hover:bg-slate-50');

    expect(getInfoBtnClass(true, true)).toContain('hover:bg-indigo-700');
    expect(getInfoBtnClass(false, false)).toContain('hover:bg-slate-200');

    expect(getSubItemClass(true, true)).toContain('bg-indigo-600');
    expect(getSubItemClass(false, false)).toContain('bg-white');
  });
});
