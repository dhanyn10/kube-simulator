import { describe, it, expect } from 'vitest';
import { getRightSidebarTabClass, getRightSidebarDropdownToggleClass } from '@/activities/layout/rightSidebarHelpers';

describe('rightSidebarHelpers', () => {
  it('computes correct tab classes for dark and light active/inactive states', () => {
    expect(getRightSidebarTabClass('canvas', 'canvas', 'dark')).toBe('bg-slate-800 text-white');
    expect(getRightSidebarTabClass('canvas', 'canvas', 'light')).toBe('bg-white shadow-sm text-slate-900');
    expect(getRightSidebarTabClass('settings', 'canvas', 'dark')).toBe('text-slate-500 hover:text-slate-300');
    expect(getRightSidebarTabClass('settings', 'canvas', 'light')).toBe('text-slate-400 hover:text-slate-600');
  });

  it('computes correct dropdown toggle button classes', () => {
    expect(getRightSidebarDropdownToggleClass('canvas', 'dark')).toBe('bg-slate-800 border-slate-700 text-white');
    expect(getRightSidebarDropdownToggleClass('canvas', 'light')).toBe('bg-white border-slate-100 shadow-sm text-slate-900');
    expect(getRightSidebarDropdownToggleClass('settings', 'dark')).toBe('text-slate-500 hover:text-slate-300 border-transparent');
  });
});
