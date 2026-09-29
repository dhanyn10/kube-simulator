import { describe, it, expect } from 'vitest';
import {
  getProgressSegmentStyles,
  getMegaCircleDashArray,
  getSegmentClass,
} from '@/activities/nodes/nodeProgressHelpers';

describe('nodeProgressHelpers', () => {
  it('returns expected styles for dark and light color modes', () => {
    const darkStyles = getProgressSegmentStyles('dark');
    expect(darkStyles.circleBgClass).toBe('text-slate-700/50');

    const lightStyles = getProgressSegmentStyles('light');
    expect(lightStyles.circleBgClass).toBe('text-slate-200');
  });

  it('returns expected segment class when isAutocompleteHovered is true and hoveredPodIndex is not matching index', () => {
    const resNonMatching = getSegmentClass({
      index: 1,
      replicas: 3,
      progressEmptyBgClass: 'bg-slate-700',
      isAutocompleteHovered: true,
      hoveredPodIndex: 0, // index 1 !== hoveredPodIndex 0
      activeBarClass: 'bg-emerald-500',
    });

    expect(resNonMatching).toBe('bg-emerald-500');
  });

  it('returns expected styles for ready, pending, crashing, and autocomplete hovered states', () => {
    // 1. Default ready state
    const readyStyles = getProgressSegmentStyles('dark', false, { isReady: true });
    expect(readyStyles.circleStrokeClass).toContain('text-emerald-500');
    expect(readyStyles.barClass).toContain('bg-emerald-500');

    // 2. Pending state
    const pendingStyles = getProgressSegmentStyles('dark', false, { isPending: true });
    expect(pendingStyles.circleStrokeClass).toContain('text-red-500');
    expect(pendingStyles.barClass).toContain('bg-red-500');

    // 3. Crashing state
    const crashingStyles = getProgressSegmentStyles('dark', false, { isCrashing: true });
    expect(crashingStyles.circleStrokeClass).toContain('text-red-600');
    expect(crashingStyles.barClass).toContain('bg-red-600');

    // 4. Autocomplete hovered state (overrides status colors with blue)
    const hoveredStyles = getProgressSegmentStyles('dark', true, { isPending: true });
    expect(hoveredStyles.circleStrokeClass).toContain('text-blue-500');
    expect(hoveredStyles.barClass).toBe('bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]');
  });

  it('calculates mega circle dash array correctly', () => {
    const dashArray = getMegaCircleDashArray(16, 10, 0.7);
    expect(dashArray).toMatch(/^\d+\.\d+ \d+\.\d+$/);
  });
});
