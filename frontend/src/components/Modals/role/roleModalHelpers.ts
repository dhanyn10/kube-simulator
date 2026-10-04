/**
 * Computes border and ring styling for input container based on focus/active state and theme mode.
 *
 * @param isActive whether input component is active or focused
 * @param colorMode current theme mode ('dark' | 'light')
 * @returns CSS class string
 */
export function getContainerFocusBorderClass(isActive: boolean, colorMode: string): string {
  const isDark = colorMode === 'dark';
  if (isActive) {
    return isDark ? 'ring-2 ring-slate-400 border-slate-400' : 'ring-2 ring-slate-800 border-slate-800';
  }
  return isDark ? 'border-slate-700' : 'border-slate-300';
}
