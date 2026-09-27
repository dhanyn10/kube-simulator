export type TabType = 'canvas' | 'settings' | 'history';

/**
 * Computes theme-aware CSS class names for right sidebar tab bar navigation buttons.
 *
 * @param tab The target tab key ('canvas' | 'settings' | 'history').
 * @param activeTab Currently active tab in right sidebar.
 * @param colorMode Active theme mode ('dark' | 'light').
 * @returns Tailwind CSS class string for button styling.
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
 * Computes theme-aware CSS class names for the right sidebar canvas dropdown menu toggle button.
 *
 * @param activeTab Currently active tab in right sidebar.
 * @param colorMode Active theme mode ('dark' | 'light').
 * @returns Tailwind CSS class string for toggle button styling.
 */
export const getRightSidebarDropdownToggleClass = (activeTab: TabType, colorMode: 'dark' | 'light'): string => {
  const isCanvas = activeTab === 'canvas';
  const isDark = colorMode === 'dark';

  if (isCanvas) {
    return isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-100 shadow-sm text-slate-900';
  }
  return isDark ? 'text-slate-500 hover:text-slate-300 border-transparent' : 'text-slate-400 hover:text-slate-600 border-transparent';
};
