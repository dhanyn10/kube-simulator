/**
 * Canvas background color resolution helper.
 * Resolves the effective background color for the React Flow canvas grid based on user setting and active theme.
 *
 * @param canvasBgColor The configured background color setting ('default' or custom hex/color string).
 * @param colorMode Active application color mode ('dark' or 'light').
 * @returns Resolved CSS color string for canvas background rendering.
 */
export const getFinalCanvasBgColor = (canvasBgColor: string, colorMode: 'dark' | 'light'): string => {
  const defaultBgColor = colorMode === 'dark' ? '#334155' : '#94A3B8';
  return canvasBgColor === 'default' ? defaultBgColor : canvasBgColor;
};
