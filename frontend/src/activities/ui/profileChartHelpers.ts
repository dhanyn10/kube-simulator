/**
 * Calculates hover dot fill class for mini curve previews.
 */
export const getMiniHoverDotClass = (isSameHour: boolean, isRed?: boolean): string => {
  if (isSameHour) {
    return isRed
      ? 'fill-rose-500 stroke-white dark:stroke-slate-900'
      : 'fill-emerald-400 stroke-white dark:stroke-slate-900';
  }
  return 'fill-blue-300 stroke-white dark:stroke-slate-900';
};

/**
 * Calculates guide line stroke color based on hover, simulation, and error state.
 */
export const getGuideLineStroke = (
  isHoveredThis: boolean,
  isSimulatingActive: boolean,
  isSameHour: boolean,
  isRed?: boolean
): string => {
  if (isHoveredThis && isSameHour) {
    return isRed ? '#f43f5e' : '#10b981';
  }
  if (isSimulatingActive && !isHoveredThis) {
    return isRed ? '#f43f5e' : '#34d399';
  }
  return '#3b82f6';
};

/**
 * Calculates point fill styling classes based on hover, drag, simulation, and error state.
 */
export const getPointFillClass = (
  isHoveredThis: boolean,
  isSameHour: boolean,
  isSimulatingActive: boolean,
  isDraggingThis: boolean,
  isRed?: boolean
): string => {
  if (isHoveredThis && isSameHour) {
    return isRed
      ? 'fill-rose-500 stroke-white'
      : 'fill-emerald-400 stroke-white';
  }
  if (isSimulatingActive && !isHoveredThis) {
    return isRed
      ? 'fill-rose-500 stroke-white dark:stroke-slate-900'
      : 'fill-emerald-400 stroke-white dark:stroke-slate-900';
  }
  if (isDraggingThis || isHoveredThis) {
    return 'fill-blue-400 stroke-white';
  }
  return 'fill-blue-500 stroke-white dark:stroke-slate-900';
};
