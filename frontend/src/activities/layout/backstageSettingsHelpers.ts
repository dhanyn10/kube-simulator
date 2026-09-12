/**
 * Returns active button styling class based on theme mode.
 */
export function getSettingsActiveBtnClass(): string {
  return "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/10 border-blue-600";
}

/**
 * Returns inactive button styling class based on theme mode.
 */
export function getSettingsInactiveBtnClass(isDark: boolean): string {
  if (isDark) {
    return "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300";
  }
  return "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700";
}

/**
 * Returns pattern button class based on selection state and theme mode.
 */
export function getPatternButtonClass(
  isPatternActive: boolean,
  isDark: boolean
): string {
  const base = "flex-1 py-3 px-5 rounded-2xl border text-xs font-bold transition-all cursor-pointer";
  if (isPatternActive) {
    return `${base} ${getSettingsActiveBtnClass()}`;
  }
  return `${base} ${getSettingsInactiveBtnClass(isDark)}`;
}

/**
 * Returns label item container styling class based on theme mode.
 */
export function getSettingLabelClass(isDark: boolean): string {
  if (isDark) {
    return "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all select-none bg-slate-900 border-slate-800 hover:bg-slate-800/60";
  }
  return "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all select-none bg-white border-slate-200 hover:bg-slate-50";
}

/**
 * Formats canvas background grid opacity float to a percentage integer.
 */
export function formatOpacityPercentage(opacity: number): number {
  return Math.round(opacity * 100);
}
