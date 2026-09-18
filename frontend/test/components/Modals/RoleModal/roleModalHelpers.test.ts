import { describe, it, expect } from 'vitest';
import { getContainerFocusBorderClass } from '@/components/Modals/RoleModal/roleModalHelpers';

describe('roleModalHelpers', () => {
  it('returns container border classes for active/focused and inactive states across dark and light modes', () => {
    // isActive = true, dark mode
    expect(getContainerFocusBorderClass(true, 'dark')).toBe('ring-2 ring-slate-400 border-slate-400');

    // isActive = true, light mode
    expect(getContainerFocusBorderClass(true, 'light')).toBe('ring-2 ring-slate-800 border-slate-800');

    // isActive = false, dark mode
    expect(getContainerFocusBorderClass(false, 'dark')).toBe('border-slate-700');

    // isActive = false, light mode
    expect(getContainerFocusBorderClass(false, 'light')).toBe('border-slate-300');
  });
});
