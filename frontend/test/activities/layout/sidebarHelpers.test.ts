import { describe, it, expect } from 'vitest';
import {
  toggleSidebarAccordionSection,
  filterSidebarItems
} from '@/activities/layout/sidebarHelpers';

describe('sidebarHelpers', () => {
  it('toggles sidebar accordion section correctly', () => {
    const initial = {
      'useful-resources': true,
      workloads: false,
      networking: false,
      configuration: false,
      scaling: false,
      others: false
    };

    const updated = toggleSidebarAccordionSection(initial, 'workloads');
    expect(updated['useful-resources']).toBe(false);
    expect(updated['workloads']).toBe(true);
  });

  it('filters sidebar items by search term', () => {
    const items = [
      { type: 'Pod', label: 'Pod' },
      { type: 'Service', label: 'Service' },
      { type: 'Deployment', label: 'Deployment' }
    ];

    expect(filterSidebarItems(items, '')).toHaveLength(3);
    expect(filterSidebarItems(items, 'pod')).toHaveLength(1);
    expect(filterSidebarItems(items, 'pod')[0].type).toBe('Pod');
    expect(filterSidebarItems(items, 'nonexistent')).toHaveLength(0);
  });
});
