/**
 * Canvas Background color resolution helper.
 */
export const getFinalCanvasBgColor = (canvasBgColor: string, colorMode: 'dark' | 'light'): string => {
  const defaultBgColor = colorMode === 'dark' ? '#334155' : '#94A3B8';
  return canvasBgColor === 'default' ? defaultBgColor : canvasBgColor;
};
