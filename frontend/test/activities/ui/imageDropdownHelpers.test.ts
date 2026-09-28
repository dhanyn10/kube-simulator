import { describe, it, expect } from 'vitest';
import { getOptionClasses, filterImageOptions } from '@/activities/ui/imageDropdownHelpers';

describe('imageDropdownHelpers', () => {
  it('returns appropriate CSS classes for image options', () => {
    expect(getOptionClasses('nginx:latest', 'nginx:latest', 'dark')).toContain('bg-slate-900 text-blue-400');
    expect(getOptionClasses('nginx:latest', 'nginx:latest', 'light')).toContain('bg-blue-50/50 text-blue-600');
    expect(getOptionClasses('redis:latest', 'nginx:latest', 'dark')).toContain('hover:bg-slate-900');
    expect(getOptionClasses('redis:latest', 'nginx:latest', 'light')).toContain('hover:bg-slate-50');
  });

  it('filters image options correctly for registry and local custom images', () => {
    const custom = ['my-custom-app:v1', 'redis:custom'];
    const filtered = filterImageOptions('redis', custom);

    expect(filtered.dockerHub.some((img) => img.name.includes('redis'))).toBe(true);
    expect(filtered.local).toEqual([{ name: 'redis:custom', source: 'local' }]);
  });
});
