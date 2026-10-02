import { describe, it, expect } from 'vitest';
import {
  calculateProfileChartData,
  calculateHourIndexFromX,
  calculateMinuteIndexFromX,
  calculateYValueFromPointer,
  calculateProfileHoverData,
  generateProfileIntervalPoints,
  PROFILE_INTERVAL_OPTIONS,
  formatMinuteToHHMM,
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
    expect(result.values).toHaveLength(25);
    expect(result.points).toHaveLength(25);
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

  it('calculates minute index from relative mouse X position', () => {
    const width = 200;
    const padLeft = 10;
    const padRight = 10;
    const chartWidth = width - padLeft - padRight; // 180

    // Left edge -> minute index 0
    expect(calculateMinuteIndexFromX(5, 200, width, padLeft, padRight, chartWidth)).toBe(0);

    // Right edge -> minute index 1440 (24:00)
    expect(calculateMinuteIndexFromX(195, 200, width, padLeft, padRight, chartWidth)).toBe(1440);

    // Middle -> minute index around 720 (12:00)
    expect(calculateMinuteIndexFromX(100, 200, width, padLeft, padRight, chartWidth)).toBe(720);
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

  it('formats minute index to HH:MM time string', () => {
    expect(formatMinuteToHHMM(0)).toBe('00:00');
    expect(formatMinuteToHHMM(525)).toBe('08:45');
    expect(formatMinuteToHHMM(1439)).toBe('23:59');
    expect(formatMinuteToHHMM(1440)).toBe('00:00');
  });

  it('calculates profile hover data accurately and returns null when out of bounds', () => {
    const { points, chartWidth } = calculateProfileChartData(
      dummyProfile,
      200,
      100,
      10,
      10,
      10,
      10
    );

    // Out of bounds cases
    expect(calculateProfileHoverData(-5, 50, 200, 100, 10, chartWidth, points)).toBeNull();
    expect(calculateProfileHoverData(205, 50, 200, 100, 10, chartWidth, points)).toBeNull();
    expect(calculateProfileHoverData(50, -10, 200, 100, 10, chartWidth, points)).toBeNull();
    expect(calculateProfileHoverData(50, 110, 200, 100, 10, chartWidth, points)).toBeNull();

    // Valid inside bounds case (middle relativeX = 100 on rectWidth = 200)
    const hoverResult = calculateProfileHoverData(100, 50, 200, 100, 10, chartWidth, points);
    expect(hoverResult).not.toBeNull();
    expect(hoverResult?.hourStr).toBe('12:00');
    expect(hoverResult?.minuteIndex).toBe(720);
  });

  it('generates profile interval points according to selected interval resolution', () => {
    expect(PROFILE_INTERVAL_OPTIONS).toHaveLength(3);
    expect(PROFILE_INTERVAL_OPTIONS[0].label).toBe('1 Hour');
    expect(PROFILE_INTERVAL_OPTIONS[2].label).toBe('10 Minutes');

    const padding = { padLeft: 10, padRight: 10, padTop: 10, padBottom: 10 };
    const result60 = generateProfileIntervalPoints(dummyProfile, 60, 200, 100, padding);
    expect(result60.intervalPoints).toHaveLength(25);
    expect(result60.intervalPoints[0].hour).toBe('00:00');
    expect(result60.intervalPoints[23].hour).toBe('23:00');

    const result30 = generateProfileIntervalPoints(dummyProfile, 30, 200, 100, padding);
    expect(result30.intervalPoints).toHaveLength(49); // 00:00 to 24:00 step 30 min
    expect(result30.intervalPoints[1].hour).toBe('00:30');
  });

  it('calculates minute point position and linear interpolation accurately including 23:00-23:59 motion', () => {
    const { points, minVal, maxVal, chartHeight } = calculateProfileChartData(
      dummyProfile,
      200,
      100,
      10,
      10,
      10,
      10
    );

    // Empty points fallback
    expect(calculateMinutePoint([], 0, 0, 1000, 80, 10)).toEqual({
      x: 0,
      y: 0,
      val: 0,
      hour: '00:00'
    });

    // Minute 0 (00:00)
    const ptMin0 = calculateMinutePoint(points, 0, minVal, maxVal, chartHeight, 10);
    expect(ptMin0.x).toBe(points[0].x);
    expect(ptMin0.val).toBe(points[0].val);
    expect(ptMin0.hour).toBe('00:00');

    // Minute 30 (00:30) - exact midpoint between hour 0 (100) and hour 1 (200)
    const ptMin30 = calculateMinutePoint(points, 30, minVal, maxVal, chartHeight, 10);
    expect(ptMin30.x).toBeCloseTo((points[0].x + points[1].x) / 2);
    expect(ptMin30.val).toBe(150);
    expect(ptMin30.hour).toBe('00:30');

    // Minute 1439 (23:59) - glides right near points[24] (24:00)
    const ptMin2359 = calculateMinutePoint(points, 1439, minVal, maxVal, chartHeight, 10);
    expect(ptMin2359.x).toBeGreaterThan(points[23].x);
    expect(ptMin2359.hour).toBe('23:59');
  });
});
