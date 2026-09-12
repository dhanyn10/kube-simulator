import { RecentFileItem } from './fileBackstageHelpers';

/**
 * Returns container class for BackstageContextMenu based on theme mode.
 */
export function getContextMenuContainerClass(isDark: boolean): string {
  if (isDark) {
    return "fixed z-[250] min-w-[180px] py-1.5 rounded-xl border shadow-2xl text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-black/50";
  }
  return "fixed z-[250] min-w-[180px] py-1.5 rounded-xl border shadow-2xl text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50";
}

/**
 * Returns standard menu option button class based on theme mode.
 */
export function getContextMenuButtonClass(isDark: boolean): string {
  if (isDark) {
    return "w-full px-3.5 py-2 text-left flex items-center gap-2.5 font-medium transition-colors cursor-pointer hover:bg-slate-800 text-slate-200";
  }
  return "w-full px-3.5 py-2 text-left flex items-center gap-2.5 font-medium transition-colors cursor-pointer hover:bg-slate-100 text-slate-700";
}

/**
 * Returns Load Profile button class based on theme mode.
 */
export function getContextMenuLoadProfileClass(isDark: boolean): string {
  if (isDark) {
    return "w-full px-3.5 py-2 text-left flex items-center gap-2.5 font-medium transition-colors text-blue-500 hover:text-blue-400 cursor-pointer hover:bg-slate-800";
  }
  return "w-full px-3.5 py-2 text-left flex items-center gap-2.5 font-medium transition-colors text-blue-500 hover:text-blue-400 cursor-pointer hover:bg-slate-100";
}

/**
 * Returns Exit button class based on theme mode.
 */
export function getContextMenuExitClass(isDark: boolean): string {
  if (isDark) {
    return "w-full px-3.5 py-2 text-left flex items-center gap-2.5 font-medium transition-colors text-rose-500 hover:text-rose-400 cursor-pointer hover:bg-slate-800";
  }
  return "w-full px-3.5 py-2 text-left flex items-center gap-2.5 font-medium transition-colors text-rose-500 hover:text-rose-400 cursor-pointer hover:bg-slate-100";
}

/**
 * Returns divider line class based on theme mode.
 */
export function getContextMenuDividerClass(isDark: boolean): string {
  if (isDark) {
    return "my-1 border-t border-slate-800";
  }
  return "my-1 border-t border-slate-100";
}

/**
 * Handles toggling color mode and closing context menu.
 */
export function handleThemeToggleClick(
  toggleColorMode: () => void,
  setContextMenu: (val: null) => void
): void {
  toggleColorMode();
  setContextMenu(null);
}

/**
 * Handles profile restoration click and closing context menu.
 */
export function handleLoadProfileClick(
  item: RecentFileItem | null,
  setContextMenu: (val: null) => void,
  handleRestoreFile: (item: RecentFileItem) => void
): void {
  setContextMenu(null);
  if (item) {
    handleRestoreFile(item);
  }
}

/**
 * Handles closing context menu and exiting backstage view.
 */
export function handleExitClick(
  setContextMenu: (val: null) => void,
  onClose: () => void
): void {
  setContextMenu(null);
  onClose();
}
