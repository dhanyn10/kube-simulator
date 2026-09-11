import { describe, it, expect, vi } from 'vitest';
import {
  getContextMenuContainerClass,
  getContextMenuButtonClass,
  getContextMenuLoadProfileClass,
  getContextMenuExitClass,
  getContextMenuDividerClass,
  handleThemeToggleClick,
  handleLoadProfileClick,
  handleExitClick,
} from '@/activities/layout/backstageContextMenuHelpers';

describe('backstageContextMenuHelpers', () => {
  it('returns container class for dark and light modes', () => {
    expect(getContextMenuContainerClass(true)).toContain('bg-slate-900/95');
    expect(getContextMenuContainerClass(false)).toContain('bg-white/95');
  });

  it('returns menu button class for dark and light modes', () => {
    expect(getContextMenuButtonClass(true)).toContain('text-slate-200');
    expect(getContextMenuButtonClass(false)).toContain('text-slate-700');
  });

  it('returns load profile class for dark and light modes', () => {
    expect(getContextMenuLoadProfileClass(true)).toContain('hover:bg-slate-800');
    expect(getContextMenuLoadProfileClass(false)).toContain('hover:bg-slate-100');
  });

  it('returns exit button class for dark and light modes', () => {
    expect(getContextMenuExitClass(true)).toContain('text-rose-500');
    expect(getContextMenuExitClass(false)).toContain('text-rose-500');
  });

  it('returns divider class for dark and light modes', () => {
    expect(getContextMenuDividerClass(true)).toContain('border-slate-800');
    expect(getContextMenuDividerClass(false)).toContain('border-slate-100');
  });

  it('handles theme toggle click', () => {
    const toggleColorMode = vi.fn();
    const setContextMenu = vi.fn();

    handleThemeToggleClick(toggleColorMode, setContextMenu);

    expect(toggleColorMode).toHaveBeenCalledOnce();
    expect(setContextMenu).toHaveBeenCalledWith(null);
  });

  it('handles load profile click when item is present', () => {
    const item = {
      id: 1,
      name: 'Test Project',
      location: 'loc',
      fullPath: 'path',
      updatedAt: 'now',
    };
    const setContextMenu = vi.fn();
    const handleRestoreFile = vi.fn();

    handleLoadProfileClick(item, setContextMenu, handleRestoreFile);

    expect(setContextMenu).toHaveBeenCalledWith(null);
    expect(handleRestoreFile).toHaveBeenCalledWith(item);
  });

  it('handles load profile click when item is null', () => {
    const setContextMenu = vi.fn();
    const handleRestoreFile = vi.fn();

    handleLoadProfileClick(null, setContextMenu, handleRestoreFile);

    expect(setContextMenu).toHaveBeenCalledWith(null);
    expect(handleRestoreFile).not.toHaveBeenCalled();
  });

  it('handles exit click', () => {
    const setContextMenu = vi.fn();
    const onClose = vi.fn();

    handleExitClick(setContextMenu, onClose);

    expect(setContextMenu).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
