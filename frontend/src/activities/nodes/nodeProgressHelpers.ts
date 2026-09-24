/**
 * Helper functions for Node status indicator and replica progress calculation.
 */

import { cn } from '@/lib/utils';

export interface ProgressSegmentStyle {
  circleBgClass: string;
  circleStrokeClass: string;
  textClass: string;
  barClass: string;
}

/**
 * Calculates stroke and background CSS classes for replica progress display.
 */
export const getProgressSegmentStyles = (
  colorMode: string,
  isAutocompleteHovered?: boolean
): ProgressSegmentStyle => {
  const circleBgClass = colorMode === 'dark' ? 'text-slate-700/50' : 'text-slate-200';

  const circleStrokeClass = cn(
    'transition-all duration-500',
    isAutocompleteHovered
      ? 'text-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
      : 'text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
  );

  const textClass = cn(
    'absolute text-[8px] font-black',
    isAutocompleteHovered
      ? 'text-blue-500 drop-shadow-[0_0_3px_rgba(59,130,246,0.4)]'
      : 'text-emerald-500 drop-shadow-[0_0_3px_rgba(16,185,129,0.4)]'
  );

  const barClass = isAutocompleteHovered
    ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]'
    : 'bg-emerald-500 shadow-[0_0_2px_rgba(16,185,129,0.5)]';

  return {
    circleBgClass,
    circleStrokeClass,
    textClass,
    barClass,
  };
};

/**
 * Generates SVG strokeDasharray values for mega progress circular indicator.
 */
export const getMegaCircleDashArray = (radius = 16, segments = 10, fillRatio = 0.7) => {
  const circumference = 2 * Math.PI * radius;
  const segmentLength = circumference / segments;
  const strokeDash = segmentLength * fillRatio;
  const gapDash = segmentLength * (1 - fillRatio);
  return `${strokeDash} ${gapDash}`;
};
