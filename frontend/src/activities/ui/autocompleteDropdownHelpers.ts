export interface AutocompleteSuggestion {
  label: string;
  value: string;
  category?: string;
  description?: string;
  subItems?: string[];
}

/**
 * Checks if suggestion description provides meaningful information distinct from label or value.
 */
export const checkMeaningfulDescription = (item: AutocompleteSuggestion): boolean => {
  if (!item.description || item.description.trim() === '') return false;
  const desc = item.description.toLowerCase().trim();
  return desc !== item.label.toLowerCase().trim() && desc !== item.value.toLowerCase().trim();
};

/**
 * Calculates CSS badge class for autocomplete categories.
 */
export const getDropdownCategoryClass = (
  item: AutocompleteSuggestion,
  isSelected: boolean,
  isDark: boolean
): string => {
  if (item.category === 'add to canvas') {
    return isDark
      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
      : 'bg-amber-100 text-amber-800 border border-amber-300';
  }
  if (isSelected) {
    return 'bg-indigo-600 text-white';
  }
  return isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500';
};

/**
 * Calculates background row CSS class based on selection state and theme mode.
 */
export const getItemRowBgClass = (isSelected: boolean, isDark: boolean): string => {
  if (isSelected) {
    return isDark ? 'bg-indigo-600/30 text-indigo-100 font-bold' : 'bg-indigo-50 text-indigo-900 font-bold';
  }
  return isDark ? 'hover:bg-slate-800/60 text-slate-300' : 'hover:bg-slate-50 text-slate-700';
};

/**
 * Calculates detail info button CSS class.
 */
export const getInfoBtnClass = (isSelected: boolean, isDark: boolean): string => {
  if (isSelected) {
    return 'hover:bg-indigo-700 text-white';
  }
  return isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-600';
};

/**
 * Calculates sub-item pill CSS class.
 */
export const getSubItemClass = (isSubSelected: boolean, isDark: boolean): string => {
  if (isSubSelected) {
    return 'bg-indigo-600 text-white border-indigo-400 font-bold scale-105';
  }
  return isDark
    ? 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
    : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50';
};
