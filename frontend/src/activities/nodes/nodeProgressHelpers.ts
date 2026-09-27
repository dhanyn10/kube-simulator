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
  isAutocompleteHovered?: boolean,
  statusFlags?: { isPending?: boolean; isCrashing?: boolean; isReady?: boolean }
): ProgressSegmentStyle => {
  const circleBgClass = colorMode === 'dark' ? 'text-slate-700/50' : 'text-slate-200';
  const isPending = statusFlags?.isPending;
  const isCrashing = statusFlags?.isCrashing;

  let activeColorStroke = 'text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
  let activeColorText = 'text-emerald-500 drop-shadow-[0_0_3px_rgba(16,185,129,0.4)]';
  let activeColorBar = 'bg-emerald-500 shadow-[0_0_2px_rgba(16,185,129,0.5)]';

  if (isCrashing) {
    activeColorStroke = 'text-red-600 shadow-[0_0_8px_rgba(220,38,38,0.6)]';
    activeColorText = 'text-red-600 drop-shadow-[0_0_3px_rgba(220,38,38,0.5)]';
    activeColorBar = 'bg-red-600 shadow-[0_0_4px_rgba(220,38,38,0.6)]';
  } else if (isPending) {
    activeColorStroke = 'text-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
    activeColorText = 'text-red-500 drop-shadow-[0_0_3px_rgba(239,68,68,0.4)]';
    activeColorBar = 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]';
  }

  const circleStrokeClass = cn(
    'transition-all duration-500',
    isAutocompleteHovered
      ? 'text-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
      : activeColorStroke
  );

  const textClass = cn(
    'absolute text-[8px] font-black',
    isAutocompleteHovered
      ? 'text-blue-500 drop-shadow-[0_0_3px_rgba(59,130,246,0.4)]'
      : activeColorText
  );

  const barClass = isAutocompleteHovered
    ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]'
    : activeColorBar;

  return {
    circleBgClass,
    circleStrokeClass,
    textClass,
    barClass,
  };
};

/**
 * Resolves active bar CSS classes based on pod status (crashing, pending, or ready/healthy).
 */
export const getActiveBarClass = (isCrashing?: boolean, isPending?: boolean): string => {
  if (isCrashing) {
    return 'bg-red-600 shadow-[0_0_4px_rgba(220,38,38,0.6)]';
  }
  if (isPending) {
    return 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]';
  }
  return 'bg-emerald-500 shadow-[0_0_2px_rgba(16,185,129,0.5)]';
};

/**
 * Resolves the segment CSS class for a specific index in replica progress indicators.
 */
export const getSegmentClass = ({
  index,
  replicas,
  progressEmptyBgClass,
  isAutocompleteHovered,
  hoveredPodIndex,
  activeBarClass,
  highlightedBarClass = 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]',
}: {
  index: number;
  replicas: number;
  progressEmptyBgClass: string;
  isAutocompleteHovered?: boolean;
  hoveredPodIndex?: number | null;
  activeBarClass: string;
  highlightedBarClass?: string;
}): string => {
  const isFilled = index < (replicas || 0);
  if (!isFilled) return progressEmptyBgClass;

  let isHighlighted = false;
  if (isAutocompleteHovered) {
    if (hoveredPodIndex !== null && hoveredPodIndex !== undefined && hoveredPodIndex >= 0) {
      isHighlighted = index === hoveredPodIndex;
    } else {
      isHighlighted = true;
    }
  }

  return isHighlighted ? highlightedBarClass : activeBarClass;
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
