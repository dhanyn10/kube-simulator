import { describe, it, expect } from 'vitest';
import {
  calculateSeriesStats,
  buildSvgPoints,
  CHART_PALETTE,
  parseIntervalMinutes,
  aggregateMetricSeries,
  getIntervalStepMinutes,
  generateXAxisTicks,
  getNiceCeiling,
  calculateDynamicYMax,
  generateYAxisScale,
} from '@/components/Monitoring/system-monitor/chartHelpers';
import { SimulationMetricPoint } from '@/store/types';

describe('chartHelpers', () => {
  it('has valid color palette array', () => {
    expect(CHART_PALETTE.length).toBeGreaterThan(0);
  });

  it('resolves interval minutes with default 1h and dynamic 5m', () => {
    expect(parseIntervalMinutes('1h')).toBe(60);
    expect(parseIntervalMinutes('30m')).toBe(30);
    expect(parseIntervalMinutes('15m')).toBe(15);
    expect(parseIntervalMinutes('5m')).toBe(5);
    expect(parseIntervalMinutes('1m')).toBe(1);
    expect(parseIntervalMinutes(undefined)).toBe(60);
  });

  it('resolves dynamic interval step minutes and generates X-axis ticks', () => {
    expect(getIntervalStepMinutes('1h')).toBe(240);
    expect(getIntervalStepMinutes('30m')).toBe(180);
    expect(getIntervalStepMinutes('15m')).toBe(120);
    expect(getIntervalStepMinutes('5m')).toBe(60);
    expect(getIntervalStepMinutes('1m')).toBe(60);

    // 1h interval ticks (4-hour steps: 00:00 to 24:00 => 7 ticks)
    const ticks1h = generateXAxisTicks('1h');
    expect(ticks1h).toHaveLength(7);
    expect(ticks1h[0]).toEqual({ label: '00:00', minute: 0, percent: 0 });
    expect(ticks1h.at(-1)).toEqual({ label: '24:00', minute: 1440, percent: 100 });

    // 30m interval ticks (3-hour steps => 9 ticks)
    const ticks30m = generateXAxisTicks('30m');
    expect(ticks30m).toHaveLength(9);
    expect(ticks30m[1].label).toBe('03:00');

    // 15m interval ticks (2-hour steps => 13 ticks)
    const ticks15m = generateXAxisTicks('15m');
    expect(ticks15m).toHaveLength(13);
    expect(ticks15m[1].label).toBe('02:00');

    // 5m interval ticks (1-hour steps => 25 ticks)
    const ticks5m = generateXAxisTicks('5m');
    expect(ticks5m).toHaveLength(25);
    expect(ticks5m[1].label).toBe('01:00');
  });

  it('calculates nice ceiling values for autoscaling', () => {
    expect(getNiceCeiling(80)).toBe(100);
    expect(getNiceCeiling(130)).toBe(150);
    expect(getNiceCeiling(180)).toBe(200);
    expect(getNiceCeiling(220)).toBe(250);
    expect(getNiceCeiling(420)).toBe(500);
    expect(getNiceCeiling(850)).toBe(1000);
  });

  it('calculates dynamic Y-axis max with Task Manager autoscaling behavior (scales up & down)', () => {
    // Empty or zero peak returns minFloor
    expect(calculateDynamicYMax([], 100)).toBe(100);
    expect(calculateDynamicYMax([0, 0], 100)).toBe(100);

    // Values below minFloor remain at minFloor
    expect(calculateDynamicYMax([30, 50, 70], 100)).toBe(100);

    // Peak exceeds minFloor -> scales up with headroom and rounds to nice step
    // 140 * 1.15 = 161 -> nice ceiling = 200
    expect(calculateDynamicYMax([50, 140, 90], 100)).toBe(200);

    // Big spike -> scales up to 1000 or 1500
    // 1200 * 1.15 = 1380 -> nice ceiling = 1500
    expect(calculateDynamicYMax([1200], 100)).toBe(1500);

    // When values drop from spike -> scales DOWN automatically so graph is not shrunken
    expect(calculateDynamicYMax([80], 100)).toBe(100);
    expect(calculateDynamicYMax([200], 256)).toBe(256);
    expect(calculateDynamicYMax([350], 256)).toBe(500);
  });

  it('generates Y-axis scale with ticks and formatted labels', () => {
    const scale = generateYAxisScale(100, '%', 3);
    expect(scale.maxVal).toBe(100);
    expect(scale.ticks).toHaveLength(3);
    expect(scale.ticks[0]).toEqual({ value: 100, label: '100%', percentFromTop: 0 });
    expect(scale.ticks[1]).toEqual({ value: 50, label: '50%', percentFromTop: 50 });
    expect(scale.ticks[2]).toEqual({ value: 0, label: '0%', percentFromTop: 100 });

    const memScale = generateYAxisScale(1000, ' MiB', 3);
    expect(memScale.ticks[0].label).toBe('1,000 MiB');
    expect(memScale.ticks[1].label).toBe('500 MiB');
  });

  it('aggregates 24-hour simulation metric series by hourly default and 5m dynamic intervals', () => {
    const emptyResult = aggregateMetricSeries([], 'cpuPercent', '1h');
    expect(emptyResult.data).toHaveLength(0);

    // Mock points with minuteIndex across 24 hours
    const mockPoints: SimulationMetricPoint[] = [
      { cpuPercent: 20, memoryPercent: 30, cpuValue: 200, memoryValue: 300, cpuLimit: 1000, memoryLimit: 1024, isThrottled: false, isOOM: false, minuteIndex: 0 },
      { cpuPercent: 40, memoryPercent: 30, cpuValue: 400, memoryValue: 300, cpuLimit: 1000, memoryLimit: 1024, isThrottled: false, isOOM: false, minuteIndex: 30 },
      { cpuPercent: 60, memoryPercent: 30, cpuValue: 600, memoryValue: 300, cpuLimit: 1000, memoryLimit: 1024, isThrottled: false, isOOM: false, minuteIndex: 65 },
    ];

    // 1h interval aggregates points at 0 and 30 into hour 0 (average = 30), and point at 65 into hour 1 (60)
    const hourlyResult = aggregateMetricSeries(mockPoints, 'cpuPercent', '1h');
    expect(hourlyResult.data).toEqual([30, 60]);
    expect(hourlyResult.currentVal).toBe(60);
    expect(hourlyResult.svgPoints).toContain('0,');

    // 5m interval produces discrete 5m buckets
    const dynamic5mResult = aggregateMetricSeries(mockPoints, 'cpuPercent', '5m');
    expect(dynamic5mResult.data.length).toBeGreaterThan(2);
    expect(dynamic5mResult.currentVal).toBe(60);

    // Fallback when minuteIndex is missing
    const fallbackResult = aggregateMetricSeries([{ cpuPercent: 80 } as any], 'cpuPercent', '1h');
    expect(fallbackResult.data).toEqual([80]);
  });

  it('calculates series stats correctly for empty and non-empty data', () => {
    const emptyStats = calculateSeriesStats('d1', 'Dep 1', '#3b82f6', []);
    expect(emptyStats.current).toBe(0);
    expect(emptyStats.min).toBe(0);
    expect(emptyStats.max).toBe(0);
    expect(emptyStats.avg).toBe(0);

    const stats = calculateSeriesStats('d1', 'Dep 1', '#3b82f6', [20, 60, 40], { isThrottled: true, isOOM: false });
    expect(stats.current).toBe(40);
    expect(stats.min).toBe(20);
    expect(stats.max).toBe(60);
    expect(stats.avg).toBe(40);
    expect(stats.isThrottled).toBe(true);
    expect(stats.isOOM).toBe(false);
  });

  it('builds SVG points accurately', () => {
    expect(buildSvgPoints([])).toContain('0,140');
    expect(buildSvgPoints([50])).toContain('0,140');

    const points = buildSvgPoints([0, 50, 100], 100, 200, 100);
    expect(points.split(' ')).toHaveLength(3);
  });
});
