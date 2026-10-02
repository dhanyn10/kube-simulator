import { describe, it, expect } from 'vitest';
import {
  calculateProfileChartData,
  calculateHourIndexFromX,
  calculateMinuteIndexFromX,
  calculateYValueFromPointer,
  calculateProfileHoverData,
  formatMinuteToHHMM,
  calculateMinutePoint,
  calculateDynamicLabelStep,
  hasSubHourlyKeys,
  detectProfileInterval,
  resampleProfileHourly,
  computeChartLayout,
  convertProfileToTimeSeries,
  computeYAxisTicks,
  resolvePadding
} from '@/lib/kubechart';

describe('kubechart library', () => {
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

    const origAt = Array.prototype.at;
    Array.prototype.at = function(index: number) {
      if (index === -1) {
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

    expect(calculateHourIndexFromX(5, 200, width, padLeft, padRight, chartWidth)).toBe(0);
    expect(calculateHourIndexFromX(195, 200, width, padLeft, padRight, chartWidth)).toBe(23);
    expect(calculateHourIndexFromX(100, 200, width, padLeft, padRight, chartWidth)).toBe(12);
  });

  it('calculates minute index from relative mouse X position', () => {
    const width = 200;
    const padLeft = 10;
    const padRight = 10;
    const chartWidth = width - padLeft - padRight; // 180

    expect(calculateMinuteIndexFromX(5, 200, width, padLeft, padRight, chartWidth)).toBe(0);
    expect(calculateMinuteIndexFromX(195, 200, width, padLeft, padRight, chartWidth)).toBe(1440);
    expect(calculateMinuteIndexFromX(100, 200, width, padLeft, padRight, chartWidth)).toBe(720);
  });

  it('calculates Y traffic value when dragging chart point', () => {
    const height = 100;
    const padTop = 10;
    const chartHeight = 80;
    const minVal = 0;
    const maxVal = 1000;

    const topVal = calculateYValueFromPointer(10, 100, height, padTop, chartHeight, minVal, maxVal);
    expect(topVal).toBe(maxVal);

    const bottomVal = calculateYValueFromPointer(90, 100, height, padTop, chartHeight, minVal, maxVal);
    expect(bottomVal).toBe(10);
  });

  it('calculates dynamic label step stride accurately for different chart widths and point counts', () => {
    expect(calculateDynamicLabelStep(0, 24, 50)).toBe(1);
    expect(calculateDynamicLabelStep(500, 1, 50)).toBe(1);
    // 580px width, 24 points -> pixelsPerPoint = 580/23 = 25.21px -> ceil(50/25.21) = 2
    expect(calculateDynamicLabelStep(580, 24, 50)).toBe(2);
    // 580px width, 139 points -> pixelsPerPoint = 580/138 = 4.2px -> ceil(50/4.2) = 12
    expect(calculateDynamicLabelStep(580, 139, 50)).toBe(12);
    // zoomed in 4x (2320px width), 139 points -> pixelsPerPoint = 2320/138 = 16.8px -> ceil(50/16.8) = 3
    expect(calculateDynamicLabelStep(2320, 139, 50)).toBe(3);
  });

  it('formats minute index to HH:MM time string', () => {
    expect(formatMinuteToHHMM(0)).toBe('00:00');
    expect(formatMinuteToHHMM(525)).toBe('08:45');
    expect(formatMinuteToHHMM(1439)).toBe('23:59');
    expect(formatMinuteToHHMM(1440)).toBe('00:00');
  });

  it('evaluates hasSubHourlyKeys correctly', () => {
    expect(hasSubHourlyKeys({})).toBe(false);
    expect(hasSubHourlyKeys({ '00:00': 100, '01:00': 200 })).toBe(false);
    expect(hasSubHourlyKeys({ '00:00': 100, '00:30': 150 })).toBe(true);
  });

  it('detects profile interval correctly based on hourly keys', () => {
    expect(detectProfileInterval({})).toBe(60);
    expect(detectProfileInterval({ '00:00': 100, '01:00': 200 })).toBe(60);
    expect(detectProfileInterval({ '00:00': 100, '00:30': 150 })).toBe(30);
    expect(detectProfileInterval({ '00:00': 100, '00:10': 120, '00:30': 150 })).toBe(10);
  });

  it('resamples profile hourly correctly', () => {
    const subHourlyProfile = {
      name: 'Sub Hourly',
      hourly: {
        '00:00': 100,
        '00:30': 150,
        '01:00': 200
      }
    };
    const resampled = resampleProfileHourly(subHourlyProfile);
    expect(Object.keys(resampled.hourly)).toHaveLength(24);
    expect(resampled.hourly['00:00']).toBe(100);
    expect(resampled.hourly['01:00']).toBe(200);
    expect(resampled.hourly['00:30']).toBeUndefined();
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

    expect(calculateProfileHoverData(-5, 50, 200, 100, 10, chartWidth, points)).toBeNull();
    expect(calculateProfileHoverData(205, 50, 200, 100, 10, chartWidth, points)).toBeNull();
    expect(calculateProfileHoverData(50, -10, 200, 100, 10, chartWidth, points)).toBeNull();
    expect(calculateProfileHoverData(50, 110, 200, 100, 10, chartWidth, points)).toBeNull();

    const hoverResult = calculateProfileHoverData(100, 50, 200, 100, 10, chartWidth, points);
    expect(hoverResult).not.toBeNull();
    expect(hoverResult?.hourStr).toBe('12:00');
    expect(hoverResult?.minuteIndex).toBe(720);
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

    expect(calculateMinutePoint([], 0, 0, 1000, 80, 10)).toEqual({
      x: 0,
      y: 0,
      val: 0,
      hour: '00:00'
    });

    const ptMin0 = calculateMinutePoint(points, 0, minVal, maxVal, chartHeight, 10);
    expect(ptMin0.x).toBe(points[0].x);
    expect(ptMin0.val).toBe(points[0].val);
    expect(ptMin0.hour).toBe('00:00');

    const ptMin30 = calculateMinutePoint(points, 30, minVal, maxVal, chartHeight, 10);
    expect(ptMin30.x).toBeCloseTo((points[0].x + points[1].x) / 2);
    expect(ptMin30.val).toBe(150);
    expect(ptMin30.hour).toBe('00:30');

    // Minute 1380 (23:00) is at points[23] (~95.8% of chart width)
    const ptMin2300 = calculateMinutePoint(points, 1380, minVal, maxVal, chartHeight, 10);
    expect(ptMin2300.x).toBeCloseTo(points[23].x);
    expect(ptMin2300.hour).toBe('23:00');

    // Minute 1439 (23:59) glides right near the end endpoint (points[24] at 24:00)
    const ptMin2359 = calculateMinutePoint(points, 1439, minVal, maxVal, chartHeight, 10);
    expect(ptMin2359.x).toBeGreaterThan(points[23].x);
    expect(ptMin2359.hour).toBe('23:59');
  });

  it('calculates minute point position across sub-hourly 10m point arrays accurately', () => {
    const subHourly10mProfile = {
      name: '10m Profile',
      hourly: {
        '00:00': 100,
        '00:10': 200,
        '12:00': 1000,
        '23:00': 500
      }
    };

    const result = calculateProfileChartData(subHourly10mProfile, 200, 100, { padLeft: 10, padRight: 10, padTop: 10, padBottom: 10 }, 10);
    expect(result.points).toHaveLength(145);

    // Minute 0 -> 00:00 -> x = padLeft (10)
    const pt0 = calculateMinutePoint(result.points, 0, result.minVal, result.maxVal, result.chartHeight, 10);
    expect(pt0.x).toBe(10);

    // Minute 720 -> 12:00 PM -> x = padLeft + 0.5 * chartWidth (100)
    const pt720 = calculateMinutePoint(result.points, 720, result.minVal, result.maxVal, result.chartHeight, 10);
    expect(pt720.x).toBeCloseTo(100);

    // Minute 1439 -> 23:59 -> x glides right near the end endpoint (190)
    const pt1439 = calculateMinutePoint(result.points, 1439, result.minVal, result.maxVal, result.chartHeight, 10);
    expect(pt1439.x).toBeGreaterThan(185);
    expect(pt1439.hour).toBe('23:59');
  });

  it('computes generic time-series chart layout cleanly', () => {
    const timeSeriesData = [
      { time: '00:00', value: 50 },
      { time: '12:00', value: 500 },
      { time: '23:00', value: 200 }
    ];

    const layout = computeChartLayout(timeSeriesData, {
      width: 300,
      height: 150,
      padding: { padLeft: 10, padRight: 10, padTop: 10, padBottom: 10 }
    });

    expect(layout.points).toHaveLength(3);
    expect(layout.pathD).toContain('M');
    expect(layout.areaD).toContain('Z');
    expect(layout.yTicks).toHaveLength(5);
  });

  it('resolves padding correctly from object or numbers', () => {
    expect(resolvePadding({ padLeft: 5, padRight: 10, padTop: 15, padBottom: 20 })).toEqual({
      padLeft: 5,
      padRight: 10,
      padTop: 15,
      padBottom: 20
    });
    expect(resolvePadding(5, [10, 15, 20])).toEqual({
      padLeft: 5,
      padRight: 10,
      padTop: 15,
      padBottom: 20
    });
  });

  it('converts profile to generic time series points array including 24:00 loop endpoint', () => {
    const series = convertProfileToTimeSeries(dummyProfile, 60);
    expect(series).toHaveLength(25);
    expect(series[0].time).toBe('00:00');
    expect(series[0].value).toBe(100);
  });

  it('computes Y-axis ticks with formatted labels', () => {
    const ticks = computeYAxisTicks(0, 2000, 10, 100);
    expect(ticks).toHaveLength(5);
    expect(ticks[0].label).toBe('2.0k');
    expect(ticks[4].label).toBe('0');
  });
});
