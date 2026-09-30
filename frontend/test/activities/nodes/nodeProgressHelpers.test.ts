import { describe, it, expect } from 'vitest';
import {
  getProgressSegmentStyles,
  getMegaCircleDashArray,
  getSegmentClass,
  getActiveBarClass,
} from '@/activities/nodes/nodeProgressHelpers';

describe('nodeProgressHelpers', () => {
  it('returns expected styles for dark and light color modes', () => {
    const darkStyles = getProgressSegmentStyles('dark');
    expect(darkStyles.circleBgClass).toBe('text-slate-700/50');

    const lightStyles = getProgressSegmentStyles('light');
    expect(lightStyles.circleBgClass).toBe('text-slate-200');
  });

  it('returns expected segment class for unfilled indices, hoveredPodIndex null/negative/matching/non-matching, and custom highlightedBarClass', () => {
    // 1. Unfilled index (index >= replicas)
    const unfilled = getSegmentClass({
      index: 3,
      replicas: 3,
      progressEmptyBgClass: 'bg-slate-700',
      activeBarClass: 'bg-emerald-500',
    });
    expect(unfilled).toBe('bg-slate-700');

    // 2. Non-matching index when hoveredPodIndex is specified
    const resNonMatching = getSegmentClass({
      index: 1,
      replicas: 3,
      progressEmptyBgClass: 'bg-slate-700',
      isAutocompleteHovered: true,
      hoveredPodIndex: 0, // index 1 !== hoveredPodIndex 0
      activeBarClass: 'bg-emerald-500',
    });
    expect(resNonMatching).toBe('bg-emerald-500');

    // 3. Matching index when hoveredPodIndex matches index
    const resMatching = getSegmentClass({
      index: 1,
      replicas: 3,
      progressEmptyBgClass: 'bg-slate-700',
      isAutocompleteHovered: true,
      hoveredPodIndex: 1,
      activeBarClass: 'bg-emerald-500',
      highlightedBarClass: 'bg-blue-600',
    });
    expect(resMatching).toBe('bg-blue-600');

    // 4. Hovered when hoveredPodIndex is null, undefined, or negative (-1)
    const resNullHover = getSegmentClass({
      index: 0,
      replicas: 3,
      progressEmptyBgClass: 'bg-slate-700',
      isAutocompleteHovered: true,
      hoveredPodIndex: null,
      activeBarClass: 'bg-emerald-500',
    });
    expect(resNullHover).toContain('bg-blue-500');

    const resUndefinedHover = getSegmentClass({
      index: 0,
      replicas: 3,
      progressEmptyBgClass: 'bg-slate-700',
      isAutocompleteHovered: true,
      hoveredPodIndex: undefined,
      activeBarClass: 'bg-emerald-500',
    });
    expect(resUndefinedHover).toContain('bg-blue-500');

    const resNegativeHover = getSegmentClass({
      index: 0,
      replicas: 3,
      progressEmptyBgClass: 'bg-slate-700',
      isAutocompleteHovered: true,
      hoveredPodIndex: -1,
      activeBarClass: 'bg-emerald-500',
    });
    expect(resNegativeHover).toContain('bg-blue-500');

    // 5. Unfilled fallback when replicas is 0 or undefined
    const resNoReplicas = getSegmentClass({
      index: 0,
      replicas: undefined as any,
      progressEmptyBgClass: 'bg-slate-700',
      activeBarClass: 'bg-emerald-500',
    });
    expect(resNoReplicas).toBe('bg-slate-700');
  });

  it('getActiveBarClass returns expected classes for crashing, pending, and ready states', () => {
    expect(getActiveBarClass(true, false)).toContain('bg-red-600');
    expect(getActiveBarClass(false, true)).toContain('bg-red-500');
    expect(getActiveBarClass(false, false)).toContain('bg-emerald-500');
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
