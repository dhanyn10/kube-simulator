import { describe, it, expect, vi } from 'vitest';
import {
  hasIconsOrCheckmarks,
  getDropdownTriggerClasses,
  resolveNextActiveMenu,
  executeMenuItemClick,
  MenuItem,
} from '@/activities/menubar/menuBarDropdownHelpers';

describe('menuBarDropdownHelpers', () => {
  describe('hasIconsOrCheckmarks', () => {
    it('returns true if any item has checked boolean', () => {
      const items: MenuItem[] = [
        { label: 'Item 1', onClick: vi.fn() },
        { label: 'Item 2', onClick: vi.fn(), checked: false },
      ];
      expect(hasIconsOrCheckmarks(items)).toBe(true);
    });

    it('returns true if any item has icon', () => {
      const FakeIcon = () => null;
      const items: MenuItem[] = [
        { label: 'Item 1', onClick: vi.fn() },
        { label: 'Item 2', onClick: vi.fn(), icon: FakeIcon },
      ];
      expect(hasIconsOrCheckmarks(items)).toBe(true);
    });

    it('returns false if no items have icons or checked states', () => {
      const items: MenuItem[] = [
        { label: 'Item 1', onClick: vi.fn() },
        { label: 'Item 2', onClick: vi.fn() },
      ];
      expect(hasIconsOrCheckmarks(items)).toBe(false);
    });
  });

  describe('getDropdownTriggerClasses', () => {
    it('returns active classes for dark and light modes when open', () => {
      expect(getDropdownTriggerClasses(true, true)).toContain('bg-slate-800 text-white');
      expect(getDropdownTriggerClasses(true, false)).toContain('bg-slate-200 text-slate-900');
    });

    it('returns inactive classes for dark and light modes when closed', () => {
      expect(getDropdownTriggerClasses(false, true)).toContain('hover:bg-slate-800');
      expect(getDropdownTriggerClasses(false, false)).toContain('hover:bg-slate-200');
    });
  });

  describe('resolveNextActiveMenu', () => {
    it('calls onMenuClick if provided', () => {
      const onMenuClick = vi.fn();
      resolveNextActiveMenu('Edit', 'File', onMenuClick);
      expect(onMenuClick).toHaveBeenCalledWith('Edit');
    });

    it('returns null for File menu label', () => {
      expect(resolveNextActiveMenu('File', 'File')).toBeNull();
      expect(resolveNextActiveMenu('File', null)).toBeNull();
    });

    it('toggles menu closed if currently open', () => {
      expect(resolveNextActiveMenu('Edit', 'Edit')).toBeNull();
    });

    it('opens target menu if currently closed or another menu was open', () => {
      expect(resolveNextActiveMenu('Edit', null)).toBe('Edit');
      expect(resolveNextActiveMenu('Edit', 'View')).toBe('Edit');
    });
  });

  describe('executeMenuItemClick', () => {
    it('calls item.onClick and closeMenu when item is not a toggle checkbox', () => {
      const onClick = vi.fn();
      const closeMenu = vi.fn();
      const item: MenuItem = { label: 'Click me', onClick };

      executeMenuItemClick(item, closeMenu);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(closeMenu).toHaveBeenCalledTimes(1);
    });

    it('calls item.onClick but NOT closeMenu when item is a boolean toggle', () => {
      const onClick = vi.fn();
      const closeMenu = vi.fn();
      const item: MenuItem = { label: 'Toggle me', onClick, checked: true };

      executeMenuItemClick(item, closeMenu);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(closeMenu).not.toHaveBeenCalled();
    });
  });
});
