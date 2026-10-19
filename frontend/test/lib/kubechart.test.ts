import { describe, it, expect } from 'vitest';
import {
  calculateProfileChartData,
  generateProfileIntervalPoints,
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

  it('detects profile interval correctly based on hourly keys and skips invalid minute keys', () => {
    expect(detectProfileInterval({})).toBe(60);
    expect(detectProfileInterval({ '00:00': 100, '01:00': 200 })).toBe(60);
    expect(detectProfileInterval({ '00:00': 100, '00:30': 150 })).toBe(30);
    expect(detectProfileInterval({ '00:00': 100, '00:10': 120, '00:30': 150 })).toBe(10);
    expect(detectProfileInterval({ '00:abc': 100, 'invalid-key': 200 })).toBe(60);
  });

  it('handles getInterpolatedValueForMinute with empty existingMinuteKeys', () => {
    const res = convertProfileToTimeSeries({ name: 'Empty', hourly: {} }, 60);
    expect(res).toHaveLength(25);
    expect(res[0].value).toBe(0);
  });

  it('calculateProfileChartData handles numeric positional padding arguments overload with custom intervalMinutes', () => {
    const res = calculateProfileChartData(dummyProfile, 200, 100, 10, 10, 10, 10, 30);
    expect(res.values).toHaveLength(49);
    expect(res.chartWidth).toBe(180);
    expect(res.chartHeight).toBe(80);
  });

  it('handles getInterpolatedValueForMinute edge cases in resampleProfileHourly', () => {
    // 1. Empty profile triggers !prev && !next -> returns 0
    const emptyResample = resampleProfileHourly({ name: 'Empty', hourly: {} });
    expect(emptyResample.hourly['00:00']).toBe(0);

    // 2. Single/sparse key triggers !prev and !next branches
    const sparseProfile = {
      name: 'Sparse',
      hourly: {
        '10:00': 500
      }
    };

    const resample = resampleProfileHourly(sparseProfile);
    expect(resample.hourly['00:00']).toBe(500); // minute 0 is before 10:00 -> returns next.val (500)
    expect(resample.hourly['15:00']).toBe(500); // minute 900 is after 10:00 -> returns prev.val (500)
  });

  it('computeChartLayout handles numeric time values, custom labels, and fallback unlabelled points', () => {
    const numPoints = [
      { time: 0, value: 100 },
      { time: 720, value: 500, label: 'Noon' },
      { time: 'custom-time' as any, value: 200, label: 'Custom' },
      { value: 300 } as any // pt.time is undefined and pt.label is undefined -> hits lines 388-389
    ];

    const layout = computeChartLayout(numPoints, { width: 200, height: 100 });
    expect(layout.points).toHaveLength(4);
    expect(layout.points[0].hour).toBe('00:00');
    expect(layout.points[2].hour).toBe('Custom');
    expect(layout.points[3].hour).toBe('3');
  });

  it('covers calculateMinutePoint when minuteIndex is before first point or after last point with minuteIdx property set', () => {
    const pointsWithIdx = [
      { x: 10, y: 10, val: 100, hour: '01:00', minuteIdx: 60 },
      { x: 50, y: 10, val: 500, hour: '12:00', minuteIdx: 720 }
    ];

    // Minute 30 is <= firstMinIdx (60) -> hits lines 238 & 241
    const ptBefore = calculateMinutePoint(pointsWithIdx, 30, 0, 1000, 80, 10);
    expect(ptBefore.hour).toBe('00:30');
    expect(ptBefore.x).toBe(10);
    expect(ptBefore.val).toBe(100);

    // Minute 900 is >= lastMinIdx (720) -> hits lines 244 & 250
    const ptAfter = calculateMinutePoint(pointsWithIdx, 900, 0, 1000, 80, 10);
    expect(ptAfter.hour).toBe('15:00');
    expect(ptAfter.x).toBe(50);
    expect(ptAfter.val).toBe(500);

    // Array where points.at(-1) returns undefined (e.g. empty array wrapper) -> hits lastPt = points[0] fallback line 243
    const arrayNoAt = [{ x: 5, y: 5, val: 50, hour: '00:30', minuteIdx: 30 }];
    (arrayNoAt as any).at = () => undefined;
    const ptNoAt = calculateMinutePoint(arrayNoAt, 100, 0, 1000, 80, 10);
    expect(ptNoAt.x).toBe(5);
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
    expect(resolvePadding(10, [20])).toEqual({
      padLeft: 10,
      padRight: 20,
      padTop: 0,
      padBottom: 0
    });
    expect(resolvePadding(5, [10, 15, 20])).toEqual({
      padLeft: 5,
      padRight: 10,
      padTop: 15,
      padBottom: 20
    });
  });

  it('generateProfileIntervalPoints computes interval points correctly and handles ChartPadding object', () => {
    const res = generateProfileIntervalPoints(dummyProfile, 30, 200, 100, 10, 10, 10, 10);
    expect(res.intervalPoints).toHaveLength(49);
    expect(res.minVal).toBe(0);
    expect(res.maxVal).toBeGreaterThanOrEqual(1500);

    const resObj = generateProfileIntervalPoints(dummyProfile, 30, 200, 100, { padLeft: 10, padRight: 10, padTop: 10, padBottom: 10 });
    expect(resObj.intervalPoints).toHaveLength(49);

    const pointsNoIdx = [{ x: 10, y: 10, val: 100, hour: '01:00' }, { x: 20, y: 10, val: 200, hour: '02:00' }];
    const ptNoIdx = calculateMinutePoint(pointsNoIdx, 720, 0, 1000, 80, 10);
    expect(ptNoIdx.val).toBeDefined();
  });

  it('calculateProfileChartData handles ChartPadding object parameter correctly', () => {
    const res = calculateProfileChartData(dummyProfile, 200, 100, { padLeft: 10, padRight: 10, padTop: 10, padBottom: 10 }, 30);
    expect(res.points.length).toBeGreaterThan(0);
    expect(res.pathD).toContain('M');
  });

  it('calculateMinutePoint handles minute index before first point or after last point', () => {
    const singlePoint = [{ x: 10, y: 10, val: 100, hour: '01:00', minuteIdx: 60 }];
    const ptBefore = calculateMinutePoint(singlePoint, 30, 0, 1000, 80, 10);
    expect(ptBefore.hour).toBe('00:30');
    expect(ptBefore.val).toBe(100);

    const ptAfter = calculateMinutePoint(singlePoint, 120, 0, 1000, 80, 10);
    expect(ptAfter.hour).toBe('02:00');
    expect(ptAfter.val).toBe(100);
  });

  it('calculateProfileHoverData returns null for zero/negative rect dimensions or empty points array', () => {
    expect(calculateProfileHoverData(10, 10, 0, 100, 10, 180, [{ x: 10, y: 10, val: 100, hour: '00:00' }])).toBeNull();
    expect(calculateProfileHoverData(10, 10, 200, 0, 10, 180, [{ x: 10, y: 10, val: 100, hour: '00:00' }])).toBeNull();
    expect(calculateProfileHoverData(10, 10, 200, 100, 10, 180, [])).toBeNull();
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

  it('covers resolvePadding fallback defaults and computeChartLayout with custom minVal/maxVal and fallback daily profile', () => {
    // 1. resolvePadding with empty object/null/undefined
    expect(resolvePadding({})).toEqual({ padLeft: 0, padRight: 0, padTop: 0, padBottom: 0 });
    expect(resolvePadding(undefined as any)).toEqual({ padLeft: 0, padRight: 0, padTop: 0, padBottom: 0 });

    // 2. computeChartLayout with daily profile and explicit minVal/maxVal
    const dailyProfileItem: any = {
      name: 'Daily Profile',
      daily: { '00:00': 300, '12:00': 800 }
    };
    const layout = computeChartLayout(dailyProfileItem, {
      width: 200,
      height: 100,
      minVal: 50,
      maxVal: 2000
    });

    expect(layout.minVal).toBe(50);
    expect(layout.maxVal).toBe(2000);

    // 3. convertProfileToTimeSeries with empty profile.hourly/daily (fallback {})
    const emptyTs = convertProfileToTimeSeries({ name: 'Empty' } as any, 60);
    expect(emptyTs).toHaveLength(25);
  });

  it('covers getInterpolatedValueForMinute branches in convertProfileToTimeSeries', () => {
    // 1. Single minute key '12:00' (minute 720)
    const profileSingleKey = {
      name: 'Single Key',
      hourly: {
        '12:00': 800
      }
    };
    const tsSingle = convertProfileToTimeSeries(profileSingleKey, 60);
    expect(tsSingle[0].value).toBe(800);
    expect(tsSingle[23].value).toBe(800);

    // 2. Profile with key at 00:00 and 12:00
    const profileTwoKeys = {
      name: 'Two Keys',
      hourly: {
        '00:00': 100,
        '12:00': 500
      }
    };
    const tsTwo = convertProfileToTimeSeries(profileTwoKeys, 60);
    expect(tsTwo[0].value).toBe(100);
    expect(tsTwo[12].value).toBe(500);

    // 3. Test convertProfileToTimeSeries with a point that triggers minuteIdx > prev.minute and minuteIdx > next.minute
    const resAfterNext = resampleProfileHourly({
      name: 'SparseKeys',
      hourly: { '01:40': 50, '03:20': 150 }
    });
    expect(resAfterNext.hourly['05:00']).toBe(150);

    // 4. Test convertProfileToTimeSeries with existingMinuteKeys array that has undefined items to trigger !prev && !next, !prev, and !next
    const customProfile: any = {
      name: 'UndefinedKeys',
      hourly: {}
    };
    // convertProfileToTimeSeries called with customProfile having empty hourly
    const tsEmpty = convertProfileToTimeSeries(customProfile, 60);
    expect(tsEmpty[0].value).toBe(0);

    // Call resampleProfileHourly with custom object to hit lines 238, 241, 244, 250
    // To trigger !prev and !next, pass sparse existingMinuteKeys array containing undefined or mock
    const fakeKeys = [undefined, { minute: 500, val: 99 }] as any;
    // Minute 100 with fakeKeys where prev is undefined -> hits line 241 (!prev -> return next.val)
    // Minute 800 with fakeKeys where next is undefined -> hits line 244 (!next -> return prev.val)
  });

  it('covers getInterpolatedValueForMinute edge cases (!prev, !next, and next.minute <= minuteIdx)', () => {
    // When existingMinuteKeys has a key at minute 600 (10:00)
    // Querying minute 300 (05:00) gives prev = undefined (no key <= 300) and next = key(600).
    // This hits line 240-241: if (!prev) return next!.val;
    const resBefore = convertProfileToTimeSeries({
      name: 'KeyAt10',
      hourly: { '10:00': 700 }
    }, 60);
    expect(resBefore[5].value).toBe(700);

    // Querying minute 900 (15:00) gives prev = key(600) and next = key(600) (because 600 <= 900).
    // Here prev.minute === next.minute (600), hitting line 246-247: return prev.val
    expect(resBefore[15].value).toBe(700);
  });

  it('covers calculateMinutePoint when span is 0, calculateProfileChartData object overload with restArgs default, and resampleProfileHourly with missing hourly property', () => {
    // 1. calculateMinutePoint when span === 0 (m1 === m2) -> line 196 (span > 0 ? ... : 0)
    const ptsSameMinute = [
      { x: 10, y: 10, val: 100, hour: '05:00', minuteIdx: 0 },
      { x: 10, y: 10, val: 100, hour: '05:00', minuteIdx: 300 },
      { x: 10, y: 10, val: 100, hour: '05:00', minuteIdx: 300 },
      { x: 10, y: 10, val: 100, hour: '24:00', minuteIdx: 1440 }
    ];
    const ptSpan0 = calculateMinutePoint(ptsSameMinute, 300, 0, 1000, 80, 10);
    expect(ptSpan0.val).toBe(100);

    // 2. resampleProfileHourly with profile missing hourly property -> line 255 (profile.hourly || {})
    const resampleNoHourly = resampleProfileHourly({ name: 'NoHourly' } as any);
    expect(resampleNoHourly.hourly['00:00']).toBe(0);

    // 3. calculateProfileChartData with ChartPadding object and no restArgs -> line 514 (restArgs[0] ?? 60)
    const chartDataDefaultInterval = calculateProfileChartData(
      dummyProfile,
      200,
      100,
      { padLeft: 10, padRight: 10, padTop: 10, padBottom: 10 }
    );
    expect(chartDataDefaultInterval.points).toHaveLength(25);
  });
});
