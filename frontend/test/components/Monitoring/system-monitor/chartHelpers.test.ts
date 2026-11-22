import { describe, it, expect } from 'vitest';
import {
  calculateSeriesStats,
  buildSvgPoints,
  buildAreaPath,
  CHART_PALETTE,
  parseIntervalMinutes,
  aggregateMetricSeries,
  getIntervalStepMinutes,
  getIntervalCapacity,
  getXAxisUnit,
  getXAxisScaleMeta,
  getScrubberTimeLabel,
  resolveScrubberPointValue,
  generateXAxisTicks,
  getNiceCeiling,
  calculateDynamicYMax,
  generateYAxisScale,
  dataToCoords,
  calculatePercentFromTop,
  getThresholdReferenceLines,
  calculateNetworkMetrics,
  extractReplicaCounts,
  calculateReplicaSeries,
} from '@/components/Monitoring/system-monitor/chartHelpers';
import { SimulationMetricPoint } from '@/store/types';

describe('chartHelpers', () => {
  it('has valid color palette array', () => {
    expect(CHART_PALETTE.length).toBeGreaterThan(0);
  });

  it('resolves interval minutes with default 1h, 10m, and dynamic 5m', () => {
    expect(parseIntervalMinutes('1h')).toBe(60);
    expect(parseIntervalMinutes('30m')).toBe(30);
    expect(parseIntervalMinutes('15m')).toBe(15);
    expect(parseIntervalMinutes('10m')).toBe(10);
    expect(parseIntervalMinutes('5m')).toBe(5);
    expect(parseIntervalMinutes('1m')).toBe(1);
    expect(parseIntervalMinutes(undefined)).toBe(60);
  });

  it('resolves dynamic interval step minutes and generates X-axis ticks following chosen interval', () => {
    expect(getXAxisUnit('1h')).toBe('Hours');
    expect(getXAxisUnit('30m')).toBe('Minutes');
    expect(getXAxisUnit('5m')).toBe('Minutes');

    expect(getIntervalCapacity('1h')).toBe(24);
    expect(getIntervalCapacity('5m')).toBe(12);
    expect(getIntervalCapacity('10m')).toBe(12);

    expect(getIntervalStepMinutes('1h')).toBe(60);
    expect(getIntervalStepMinutes('30m')).toBe(30);
    expect(getIntervalStepMinutes('15m')).toBe(15);
    expect(getIntervalStepMinutes('10m')).toBe(10);
    expect(getIntervalStepMinutes('5m')).toBe(5);
    expect(getIntervalStepMinutes('1m')).toBe(1);

    // 5m interval ticks: 12 intervals from 0 to 60 (0, 5, 10, 15, 20... 60)
    const ticks5m = generateXAxisTicks('5m');
    expect(ticks5m).toHaveLength(13);
    expect(ticks5m[0]).toEqual({ label: '0', minute: 0, percent: 0 });
    expect(ticks5m[1]).toEqual({ label: '5', minute: 5, percent: 8.3 });
    expect(ticks5m[2]).toEqual({ label: '10', minute: 10, percent: 16.7 });
    expect(ticks5m[3]).toEqual({ label: '15', minute: 15, percent: 25 });
    expect(ticks5m[4]).toEqual({ label: '20', minute: 20, percent: 33.3 });
    expect(ticks5m.at(-1)).toEqual({ label: '60', minute: 60, percent: 100 });

    // 10m interval ticks: 12 intervals from 0 to 120 (0, 10, 20... 120)
    const ticks10m = generateXAxisTicks('10m');
    expect(ticks10m).toHaveLength(13);
    expect(ticks10m[1].label).toBe('10');
    expect(ticks10m[2].label).toBe('20');
    expect(ticks10m.at(-1).label).toBe('120');

    // 1h interval ticks: 24 intervals from 0 to 24 (0, 1, 2... 24)
    const ticks1h = generateXAxisTicks('1h');
    expect(ticks1h).toHaveLength(25);
    expect(ticks1h[0]).toEqual({ label: '0', minute: 0, percent: 0 });
    expect(ticks1h[1]).toEqual({ label: '1', minute: 1, percent: 4.2 });
    expect(ticks1h.at(-1)).toEqual({ label: '24', minute: 24, percent: 100 });

    // Hover scrubber time label & scale metadata
    expect(getScrubberTimeLabel(25, '5m')).toBe('15 min');
    expect(getScrubberTimeLabel(50, '1h')).toBe('12h');
    expect(getXAxisScaleMeta('5m')).toEqual({
      unit: 'Minutes',
      stepLabel: '5m / div',
      windowLabel: '60 Minutes',
    });
    expect(getXAxisScaleMeta('1h')).toEqual({
      unit: 'Hours',
      stepLabel: '1h / div',
      windowLabel: '24 Hours',
    });
    expect(resolveScrubberPointValue([10, 20, 30], 99, 50, 12)).toBe(30);
    expect(resolveScrubberPointValue([], 99, 50, 12)).toBe(99);
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
    // Points stream from right to left, latest point is at viewWidth (500)
    const hourlyResult = aggregateMetricSeries(mockPoints, 'cpuPercent', '1h');
    expect(hourlyResult.data).toEqual([30, 60]);
    expect(hourlyResult.currentVal).toBe(60);
    expect(hourlyResult.svgPoints).toContain('500,');
    expect(hourlyResult.areaPath).toContain('M');

    // 5m interval produces discrete 5m buckets
    const dynamic5mResult = aggregateMetricSeries(mockPoints, 'cpuPercent', '5m');
    expect(dynamic5mResult.data.length).toBeGreaterThan(2);
    expect(dynamic5mResult.currentVal).toBe(60);
    expect(dynamic5mResult.svgPoints).toContain('500,');

    // Fallback when minuteIndex is missing
    const fallbackResult = aggregateMetricSeries([{ cpuPercent: 80 } as any], 'cpuPercent', '1h');
    expect(fallbackResult.data).toEqual([80]);
  });

  it('preserves historical buckets across 24h traffic cycle loop without revising older buckets', () => {
    // Day 1: Hour 5 has CPU = 25
    // Day 2: Hour 5 has CPU = 90
    const loopingPoints: SimulationMetricPoint[] = [
      { cpuPercent: 25, memoryPercent: 30, cpuValue: 250, memoryValue: 300, cpuLimit: 1000, memoryLimit: 1024, isThrottled: false, isOOM: false, minuteIndex: 300 }, // Day 1 05:00
      { cpuPercent: 70, memoryPercent: 40, cpuValue: 700, memoryValue: 400, cpuLimit: 1000, memoryLimit: 1024, isThrottled: false, isOOM: false, minuteIndex: 960 }, // Day 1 16:00
      { cpuPercent: 90, memoryPercent: 80, cpuValue: 900, memoryValue: 800, cpuLimit: 1000, memoryLimit: 1024, isThrottled: true, isOOM: false, minuteIndex: 300 }, // Day 2 05:00 (wrap)
    ];

    const result = aggregateMetricSeries(loopingPoints, 'cpuPercent', '1h');
    // Day 1 hour 5 (25) must NOT be averaged with Day 2 hour 5 (90)
    // The data points must represent distinct sequential buckets
    expect(result.data[0]).toBe(25);
    expect(result.data.at(-1)).toBe(90);
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
    expect(buildSvgPoints([50])).toContain('500,');

    const points = buildSvgPoints([0, 50, 100], 100, 200, 100);
    expect(points.split(' ')).toHaveLength(3);
    expect(points).toContain('200,');
  });

  it('converts data values to 2D screen coordinates streaming from right to left', () => {
    expect(dataToCoords([])).toHaveLength(0);

    const singleCoord = dataToCoords([50], 100, 500, 140);
    expect(singleCoord.at(-1)?.x).toBe(500);

    const coords = dataToCoords([10, 20, 30], 100, 500, 140, 10);
    expect(coords).toHaveLength(3);
    expect(coords.at(-1)?.x).toBe(500); // newest point at right edge
    expect(coords[0].x).toBeLessThan(500);
  });

  it('calculates percentFromTop for threshold lines aligned with chart headroom', () => {
    expect(calculatePercentFromTop(0, 100)).toBe(100);
    expect(calculatePercentFromTop(100, 100)).toBe(7.1);
    expect(calculatePercentFromTop(80, 100)).toBe(25.7);
    expect(calculatePercentFromTop(50, 0)).toBe(0);
  });

  it('generates Kubernetes-native threshold reference lines for CPU and Memory', () => {
    // 1a. CPU without HPA: only 90% Throttle line (NO HPA helper line)
    const cpuLinesNoHpa = getThresholdReferenceLines('cpuPercent', 100);
    expect(cpuLinesNoHpa).toHaveLength(1);
    expect(cpuLinesNoHpa[0]).toEqual({
      value: 90,
      label: '90% Throttle',
      badge: '90% Throttle Risk',
      color: 'rose',
      percentFromTop: 16.4,
    });

    // 1b. CPU with HPA present: 80% HPA and 90% Throttle lines
    const cpuLines100 = getThresholdReferenceLines('cpuPercent', 100, [], {}, 100, true);
    expect(cpuLines100).toHaveLength(2);
    expect(cpuLines100[0]).toEqual({
      value: 80,
      label: '80% HPA',
      badge: '80% HPA Target',
      color: 'amber',
      percentFromTop: 25.7,
    });
    expect(cpuLines100[1]).toEqual({
      value: 90,
      label: '90% Throttle',
      badge: '90% Throttle Risk',
      color: 'rose',
      percentFromTop: 16.4,
    });

    // 1c. CPU with HPA in deployments: custom 70% HPA target
    const cpuLinesDepHpa = getThresholdReferenceLines(
      'cpuPercent',
      100,
      [{ id: 'd1', label: 'dep1', replicas: 1, hasHpa: true, hpas: [{ targetCPU: 70 }] }]
    );
    expect(cpuLinesDepHpa).toHaveLength(2);
    expect(cpuLinesDepHpa[0].label).toBe('70% HPA');

    // 2. CPU multi-core spike with dynamicMax = 200 and HPA present: shows 100% Quota Limit line
    const cpuLinesSpike = getThresholdReferenceLines('cpuPercent', 200, [], {}, 100, true);
    expect(cpuLinesSpike).toHaveLength(3);
    expect(cpuLinesSpike[2]).toEqual({
      value: 100,
      label: '100% Limit',
      badge: '100% Quota Limit',
      color: 'red',
      percentFromTop: 53.6,
    });

    // 3. Low dynamicMax below 80 returns empty array
    expect(getThresholdReferenceLines('cpuPercent', 50)).toHaveLength(0);

    // 4. Memory threshold lines derived from deployments metric memoryLimit
    const memLines = getThresholdReferenceLines(
      'memoryValue',
      512,
      [{ id: 'dep-1', label: 'api', replicas: 1 }],
      {
        'dep-1': [
          {
            cpuPercent: 10,
            memoryPercent: 20,
            cpuValue: 100,
            memoryValue: 200,
            cpuLimit: 1000,
            memoryLimit: 512,
            isThrottled: false,
            isOOM: false,
          },
        ],
      },
      256
    );
    expect(memLines).toHaveLength(2);
    expect(memLines[0].label).toBe('85% OOM Risk');
    expect(memLines[0].badge).toBe('85% OOM Risk (435 MiB)');
    expect(memLines[0].color).toBe('amber');
    expect(memLines[1].label).toBe('Limit: 512 MiB');
    expect(memLines[1].badge).toBe('Limit: 512 MiB');
    expect(memLines[1].color).toBe('rose');

    // 5. Memory fallback to maxVal when deployments have no memoryLimit
    const fallbackMemLines = getThresholdReferenceLines('memoryValue', 256, [], {}, 256);
    expect(fallbackMemLines).toHaveLength(2);
    expect(fallbackMemLines[0].badge).toBe('85% OOM Risk (218 MiB)');
    expect(fallbackMemLines[1].badge).toBe('Limit: 256 MiB');

    // 6. Unknown metricKey returns empty array
    expect(getThresholdReferenceLines('unknown', 100)).toHaveLength(0);
  });

  it('calculates network metrics from real ingress traffic for unindexed and bucketed data', () => {
    // 1. Unindexed data
    const unindexed = calculateNetworkMetrics(
      [{ id: 'dep-1', label: 'api', replicas: 2 }],
      {
        'dep-1': [
          { cpuPercent: 10, memoryPercent: 20, trafficRpm: 300, latencyMs: 12 },
          { cpuPercent: 20, memoryPercent: 30, trafficRpm: 600, latencyMs: 25 },
        ],
      },
      '1h'
    );
    expect(unindexed.trafficData).toEqual([300, 600]);
    expect(unindexed.currentTrafficRpm).toBe(600);
    expect(unindexed.currentLatency).toBe(25);

    // 2. Bucketed data with minuteIndex
    const bucketed = calculateNetworkMetrics(
      [{ id: 'dep-1', label: 'api', replicas: 1 }],
      {
        'dep-1': [
          { cpuPercent: 10, memoryPercent: 20, minuteIndex: 0, tickIndex: 0, trafficRpm: 100, latencyMs: 10 },
          { cpuPercent: 30, memoryPercent: 30, minuteIndex: 120, tickIndex: 120, trafficRpm: 200, latencyMs: 40 },
        ],
      },
      '1h'
    );
    expect(bucketed.trafficData.length).toBeGreaterThan(1);
    expect(bucketed.currentTrafficRpm).toBe(200);
    expect(bucketed.currentLatency).toBe(40);

    // 3. Total ingress is summed across workloads, not averaged per workload
    const twoWorkloads = calculateNetworkMetrics(
      [
        { id: 'dep-1', label: 'api', replicas: 1 },
        { id: 'dep-2', label: 'web', replicas: 1 },
      ],
      {
        'dep-1': [{ cpuPercent: 10, minuteIndex: 0, tickIndex: 0, trafficRpm: 2000, latencyMs: 20 }],
        'dep-2': [{ cpuPercent: 10, minuteIndex: 0, tickIndex: 0, trafficRpm: 2000, latencyMs: 35 }],
      },
      '1h'
    );
    expect(twoWorkloads.currentTrafficRpm).toBe(4000);
    expect(twoWorkloads.currentLatency).toBe(35);
  });

  it('extracts replica counts and calculates replica series correctly', () => {
    const deps = [{ id: 'd1', label: 'web', replicas: 3 }];
    const metrics = {
      d1: [
        { cpuPercent: 10, memoryPercent: 20, replicas: 3 },
        { cpuPercent: 10, memoryPercent: 20, replicas: 5 },
      ],
    };
    const counts = extractReplicaCounts(deps, metrics);
    expect(counts).toEqual([3, 3, 5]);

    // Unindexed series
    const seriesUnindexed = calculateReplicaSeries(deps, metrics, '1h', 10);
    expect(seriesUnindexed).toHaveLength(1);
    expect(seriesUnindexed[0].current).toBe(3);
    expect(seriesUnindexed[0].svgPoints).toBeDefined();

    // Bucketed series with minuteIndex
    const bucketedMetrics = {
      d1: [
        { cpuPercent: 10, memoryPercent: 20, replicas: 4, minuteIndex: 10 },
      ],
    };
    const seriesBucketed = calculateReplicaSeries(deps, bucketedMetrics, '1h', 10);
    expect(seriesBucketed).toHaveLength(1);
    expect(seriesBucketed[0].current).toBe(4);
  });

  it('maintains strictly monotonic bucket count without right-edge oscillation when switching between 15m and 1h', () => {
    const stream: SimulationMetricPoint[] = [];
    let prevLen15m = 0;
    let prevLen1h = 0;

    for (let tick = 1; tick <= 3200; tick++) {
      stream.push({
        cpuPercent: 30 + (tick % 40),
        memoryPercent: 50,
        cpuValue: 300,
        memoryValue: 512,
        cpuLimit: 1000,
        memoryLimit: 1024,
        isThrottled: false,
        isOOM: false,
        minuteIndex: tick % 1440,
        tickIndex: tick,
      });

      const windowPoints = stream.slice(-2880);
      if (tick % 25 === 0) {
        const res15m = aggregateMetricSeries(windowPoints, 'cpuPercent', '15m');
        const res1h = aggregateMetricSeries(windowPoints, 'cpuPercent', '1h');

        expect(res15m.data.length).toBeGreaterThanOrEqual(prevLen15m);
        expect(res15m.data.length).toBeLessThanOrEqual(12);
        expect(res1h.data.length).toBeGreaterThanOrEqual(prevLen1h);
        expect(res1h.data.length).toBeLessThanOrEqual(24);

        prevLen15m = res15m.data.length;
        prevLen1h = res1h.data.length;
      }
    }

    expect(prevLen15m).toBe(12);
    expect(prevLen1h).toBe(24);
  });

  it('handles midnight rollover in calculateNetworkMetrics and empty metric buckets', () => {
    const deps = [{ id: 'dep-1', label: 'web', replicas: 2 }];
    const rolloverMetrics = {
      'dep-1': [
        { minuteIndex: 1439, cpuPercent: 50 },
        { minuteIndex: 5, cpuPercent: 60 },
      ],
    };
    const resRollover = calculateNetworkMetrics(deps, rolloverMetrics, '1h');
    expect(resRollover.trafficData.length).toBeGreaterThan(0);

    const emptyDepsMetrics = {
      'dep-1': [],
    };
    const resEmpty = calculateNetworkMetrics(deps, emptyDepsMetrics, '1h');
    expect(resEmpty.trafficData).toEqual([]);
    expect(resEmpty.currentTrafficRpm).toBe(0);
    expect(resEmpty.currentLatency).toBe(0);
  });

  it('covers scrubber, ceiling, dynamic Y-max, and stats edge cases', () => {
    // resolveScrubberPointValue fallback with sparse array
    const sparseArr: number[] = [];
    sparseArr[10] = 50;
    expect(resolveScrubberPointValue(sparseArr, 999, 10, 10)).toBe(999);

    // getNiceCeiling when fraction <= 1
    expect(getNiceCeiling(100)).toBe(100);
    expect(getNiceCeiling(10)).toBe(10);
    expect(getNiceCeiling(1)).toBe(1);

    // calculateDynamicYMax with undefined or null values
    expect(calculateDynamicYMax(undefined as any)).toBe(100);

    // calculateSeriesStats with descending array and ending with 0
    const statsDesc = calculateSeriesStats('s1', 'Label', '#fff', [50, 20, 10, 0]);
    expect(statsDesc.min).toBe(0);
    expect(statsDesc.max).toBe(50);
    expect(statsDesc.current).toBe(0);
  });

  it('covers buildAreaPath edge cases', () => {
    expect(buildAreaPath('', 500, 140)).toBe('M0,140 L500,140 Z');
    expect(buildAreaPath('100', 500, 140)).toBe('M0,140 L100 L500,140 Z');
    expect(buildAreaPath(',100', 500, 140)).toBe('M0,140 L,100 L500,140 Z');
  });

  it('covers aggregateMetricSeries unindexed, bucketed, zero metrics and custom iterators', () => {
    // Unindexed with undefined/zero values and last point 0
    const unindexedPoints: SimulationMetricPoint[] = [
      { cpuPercent: 0 },
      { cpuPercent: 0 },
    ];
    const unindexedRes = aggregateMetricSeries(unindexedPoints, 'cpuPercent', '1h');
    expect(unindexedRes.currentVal).toBe(0);
    expect(unindexedRes.data).toEqual([0, 0]);

    // Bucketed with undefined minuteIndex and zero metric
    const bucketedPoints: SimulationMetricPoint[] = [
      { minuteIndex: 0, cpuPercent: 0 },
      { minuteIndex: undefined as any, cpuPercent: 0 },
    ];
    const bucketedRes = aggregateMetricSeries(bucketedPoints, 'cpuPercent', '1h');
    expect(bucketedRes.currentVal).toBe(0);

    // Empty bucket indices via empty-yielding iterator
    const customEmptyPoints = Object.assign([], {
      length: 1,
      some: () => true,
      [Symbol.iterator]: function* () {},
    });
    const emptyAgg = aggregateMetricSeries(customEmptyPoints as any, 'cpuPercent', '1h');
    expect(emptyAgg.data).toEqual([]);
    expect(emptyAgg.currentVal).toBe(0);
  });

  it('covers calculateNetworkMetrics missing metrics, undefined rpm/latency, and empty deployments', () => {
    const deps = [
      { id: 'dep-a', label: 'dep-a' },
      { id: 'dep-b', label: 'dep-b' },
    ];
    // Unindexed metrics with missing dep and undefined values
    const unindexedNetMetrics: Record<string, SimulationMetricPoint[]> = {
      'dep-a': [
        { trafficRpm: undefined, latencyMs: undefined },
      ],
    };
    const unindexedNet = calculateNetworkMetrics(deps, unindexedNetMetrics, '1h');
    expect(unindexedNet.trafficData).toHaveLength(1);
    expect(unindexedNet.trafficData[0]).toBe(0);

    // Bucketed metrics with missing metrics entry and undefined minuteIndex
    const bucketedNetMetrics: Record<string, SimulationMetricPoint[]> = {
      'dep-a': [
        { minuteIndex: 0, trafficRpm: 10, latencyMs: 20 },
        { minuteIndex: undefined as any, trafficRpm: undefined, latencyMs: undefined },
      ],
    };
    const bucketedNet = calculateNetworkMetrics(deps, bucketedNetMetrics, '1h');
    expect(bucketedNet.trafficData.length).toBeGreaterThan(0);

    // Empty deployments with bucketed metrics triggers aggregateBucketTrafficMetrics early return
    const emptyNet = calculateNetworkMetrics([], { 'unmatched-dep': [{ minuteIndex: 0 }] }, '1h');
    expect(emptyNet.trafficData).toEqual([]);
    expect(emptyNet.currentTrafficRpm).toBe(0);
  });

  it('covers replica series and extractReplicaCounts fallback branches', () => {
    const deps = [
      { id: 'dep-no-rep', label: 'dep-no-rep', replicas: 0 },
    ];
    // extractReplicaCounts with fallback to 1 and non-numeric replica in point
    const counts = extractReplicaCounts(deps, {
      'dep-no-rep': [{ replicas: undefined as any }],
    });
    expect(counts).toEqual([1]);

    // extractReplicaCounts with missing metrics entry taking || [] fallback
    const countsMissing = extractReplicaCounts(deps, {});
    expect(countsMissing).toEqual([1]);

    // calculateReplicaSeries unindexed with 0 replicas fallback to 1, non-empty points, and missing metrics
    const depsWithMissing = [
      { id: 'dep-no-rep', label: 'dep-no-rep', replicas: 0 },
      { id: 'dep-missing', label: 'dep-missing', replicas: 2 },
    ];
    const unindexedReplica = calculateReplicaSeries(depsWithMissing, { 'dep-no-rep': [{ cpuPercent: 10 }] }, '1h', 10);
    expect(unindexedReplica[0].current).toBe(1);
    expect(unindexedReplica[0].data).toEqual([1]);
    expect(unindexedReplica[1].current).toBe(2);
    expect(unindexedReplica[1].data).toEqual([]);

    // calculateReplicaSeries bucketed with 0 replicas and 0 currentVal fallback to 1
    const bucketedMetrics: Record<string, SimulationMetricPoint[]> = {
      'dep-no-rep': [
        { minuteIndex: 0, replicas: 0 },
      ],
    };
    const bucketedReplica = calculateReplicaSeries(deps, bucketedMetrics, '1h', 10);
    expect(bucketedReplica[0].current).toBe(1);
  });

  it('covers getThresholdReferenceLines memory and HPA branches', () => {
    // Memory threshold with memoryLimit missing or <= 0
    const depMem = [{ id: 'dep-m', label: 'dep-m' }];
    const metricsMem: Record<string, SimulationMetricPoint[]> = {
      'dep-m': [{ memoryLimit: 0 }],
    };
    // softLimit and memLimit exceed dynamicMax
    const memLinesExceed = getThresholdReferenceLines('memoryValue', 100, depMem, metricsMem, 256);
    expect(memLinesExceed).toEqual([]);

    // CPU threshold with custom hpaTarget !== 80
    const cpuCustomTarget = getThresholdReferenceLines('cpuPercent', 100, [], {}, 100, true, 60);
    expect(cpuCustomTarget.some((l) => l.label.includes('60%'))).toBe(true);

    // CPU threshold with deployment hasHpa = false and hpas array with targetCPU
    const depWithHpa = [
      {
        id: 'dep-hpa',
        label: 'dep-hpa',
        hasHpa: false,
        hpas: [{ targetCPU: 70 }],
      },
    ];
    const cpuLinesHpa = getThresholdReferenceLines('cpuPercent', 100, depWithHpa, {}, 100, false, 80);
    expect(cpuLinesHpa.some((l) => l.label.includes('70%'))).toBe(true);

    // CPU threshold with empty hpas array and '0' string targetCPU fallback to 80
    const depEmptyHpa = [
      {
        id: 'dep-empty-hpa',
        label: 'dep-empty-hpa',
        hasHpa: false,
        hpas: [],
      },
      {
        id: 'dep-zero-hpa',
        label: 'dep-zero-hpa',
        hasHpa: false,
        hpas: [{ targetCPU: '0' as any }],
      },
    ];
    const cpuLinesFallback = getThresholdReferenceLines('cpuPercent', 100, depEmptyHpa, {}, 100, false, 80);
    expect(cpuLinesFallback.some((l) => l.label.includes('80%'))).toBe(true);
  });
});
