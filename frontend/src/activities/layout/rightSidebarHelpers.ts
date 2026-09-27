export type TabType = 'canvas' | 'settings' | 'history';

/**
 * Returns CSS class names for right sidebar tab buttons based on active state and color mode.
 */
export const getRightSidebarTabClass = (tab: TabType, activeTab: TabType, colorMode: 'dark' | 'light'): string => {
  const isActive = activeTab === tab;
  const isDark = colorMode === 'dark';

  if (isActive) {
    return isDark ? 'bg-slate-800 text-white' : 'bg-white shadow-sm text-slate-900';
  }
  return isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600';
};

/**
 * Returns CSS class names for the right sidebar canvas dropdown toggle button.
 */
export const getRightSidebarDropdownToggleClass = (activeTab: TabType, colorMode: 'dark' | 'light'): string => {
  const isCanvas = activeTab === 'canvas';
  const isDark = colorMode === 'dark';

  if (isCanvas) {
    return isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-100 shadow-sm text-slate-900';
  }
  return isDark ? 'text-slate-500 hover:text-slate-300 border-transparent' : 'text-slate-400 hover:text-slate-600 border-transparent';
};
