import { describe, it, expect } from 'vitest';
import {
  calculateProfileChartData,
  calculateHourIndexFromX,
  calculateYValueFromPointer,
  formatMinuteToHHMM,
  getInterpolatedProfileTraffic,
  calculateMinutePoint
} from '@/activities/modals/internetProfileChartHelpers';

describe('internetProfileChartHelpers', () => {
  const dummyProfile = {
    name: 'Test Profile',
    hourly: {
      '00:00': 100,
      '01:00': 200,
      '12:00': 1500,
      '23:00': 500
    }
  };

  it('calculates profile chart data bounds and paths correctly including points fallback', () => {
    const result = calculateProfileChartData(dummyProfile, 200, 100, 10, 10, 10, 10);
    expect(result.values).toHaveLength(24);
    expect(result.points).toHaveLength(24);
    expect(result.pathD).toContain('M');
    expect(result.areaD).toContain('Z');
    expect(result.maxVal).toBeGreaterThanOrEqual(1500);
    expect(result.minVal).toBe(0);

    // Test with array where at(-1) returns undefined to cover points[0] fallback on lastPoint
    const origAt = Array.prototype.at;
    let atCallCount = 0;
    Array.prototype.at = function(index: number) {
      if (index === -1) {
        atCallCount++;
        return undefined as any;
      }
      return origAt.call(this, index);
    };

    const resFallback = calculateProfileChartData(dummyProfile, 200, 100, 10, 10, 10, 10);
    expect(resFallback.areaD).toBeDefined();

    Array.prototype.at = origAt;
  });

  it('calculates hour index from relative mouse X position', () => {
    const width = 200;
    const padLeft = 10;
    const padRight = 10;
    const chartWidth = width - padLeft - padRight; // 180

    // Left edge -> hour index 0
    expect(calculateHourIndexFromX(5, 200, width, padLeft, padRight, chartWidth)).toBe(0);

    // Right edge -> hour index 23
    expect(calculateHourIndexFromX(195, 200, width, padLeft, padRight, chartWidth)).toBe(23);

    // Middle -> hour index around 12
    expect(calculateHourIndexFromX(100, 200, width, padLeft, padRight, chartWidth)).toBe(12);
  });

  it('calculates Y traffic value when dragging chart point', () => {
    const height = 100;
    const padTop = 10;
    const chartHeight = 80;
    const minVal = 0;
    const maxVal = 1000;

    // Pointer at top -> near maxVal
    const topVal = calculateYValueFromPointer(10, 100, height, padTop, chartHeight, minVal, maxVal);
    expect(topVal).toBe(maxVal);

    // Pointer at bottom -> near minVal (clamped at least 10)
    const bottomVal = calculateYValueFromPointer(90, 100, height, padTop, chartHeight, minVal, maxVal);
    expect(bottomVal).toBe(10);
  });

  it('formats minute index to HH:MM string', () => {
    expect(formatMinuteToHHMM(0)).toBe('00:00');
    expect(formatMinuteToHHMM(90)).toBe('01:30');
    expect(formatMinuteToHHMM(875)).toBe('14:35');
    expect(formatMinuteToHHMM(1439)).toBe('23:59');
  });

  it('interpolates traffic value linearly between hourly anchor points', () => {
    const profile = {
      name: 'Linear Profile',
      hourly: {
        '00:00': 100,
        '01:00': 200,
      }
    };

    // Minute 0 (00:00) -> 100
    expect(getInterpolatedProfileTraffic(profile, 0)).toBe(100);

    // Minute 30 (00:30) -> halfway between 100 and 200 -> 150
    expect(getInterpolatedProfileTraffic(profile, 30)).toBe(150);

    // Minute 60 (01:00) -> 200
    expect(getInterpolatedProfileTraffic(profile, 60)).toBe(200);
  });

  it('calculates exact SVG minute point positioning', () => {
    const profile = {
      name: 'Linear Profile',
      hourly: {
        '00:00': 100,
        '01:00': 200,
      }
    };

    const pt0 = calculateMinutePoint(profile, 0, 200, 100, 10, 10, 10, 10);
    expect(pt0.x).toBe(10); // padLeft
    expect(pt0.timeStr).toBe('00:00');
    expect(pt0.val).toBe(100);

    const ptMid = calculateMinutePoint(profile, 720, 200, 100, 10, 10, 10, 10);
    expect(ptMid.timeStr).toBe('12:00');
    expect(ptMid.x).toBeGreaterThan(10);
  });
});
