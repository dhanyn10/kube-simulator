import { describe, it, expect } from 'vitest';
import {
  calculateSeriesStats,
  buildSvgPoints,
  CHART_PALETTE,
  parseIntervalMinutes,
  aggregateMetricSeries,
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
