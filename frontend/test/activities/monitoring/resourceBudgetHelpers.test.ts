import { describe, it, expect } from 'vitest';
import { calculateResourceTotals } from '@/activities/monitoring/resourceBudgetHelpers';

describe('resourceBudgetHelpers', () => {
  it('returns default zero values for empty nodes array or non-workload nodes', () => {
    const result = calculateResourceTotals([]);
    expect(result).toEqual({
      cpuReq: 0,
      memReq: 0,
      cpuLim: 0,
      memLim: 0,
      hasMissingLimits: false,
    });

    const nonWorkloadResult = calculateResourceTotals([
      { id: '1', type: 'Service', data: {} },
      { id: '2', type: 'Ingress', data: {} },
    ]);
    expect(nonWorkloadResult).toEqual({
      cpuReq: 0,
      memReq: 0,
      cpuLim: 0,
      memLim: 0,
      hasMissingLimits: false,
    });
  });

  it('aggregates CPU and Memory requests/limits for top-level Pods and Deployments', () => {
    const nodes = [
      {
        id: 'dep-1',
        type: 'Deployment',
        data: {
          replicas: 2,
          cpuRequest: '250m',
          cpuLimit: '500m',
          memoryRequest: '256Mi',
          memoryLimit: '512Mi',
        },
      },
      {
        id: 'pod-1',
        type: 'Pod',
        data: {
          cpuRequest: '500m',
          cpuLimit: '1000m',
          memoryRequest: '512Mi',
          memoryLimit: '1024Mi',
        },
      },
    ];

    const result = calculateResourceTotals(nodes);
    // dep-1 (replicas 2): cpuReq 250*2=500, cpuLim 500*2=1000, memReq 256*2=512, memLim 512*2=1024
    // pod-1 (replicas 1): cpuReq 500, cpuLim 1000, memReq 512, memLim 1024
    // Totals: cpuReq=1000, cpuLim=2000, memReq=1024, memLim=2048
    expect(result.cpuReq).toBe(1000);
    expect(result.cpuLim).toBe(2000);
    expect(result.memReq).toBe(1024);
    expect(result.memLim).toBe(2048);
    expect(result.hasMissingLimits).toBe(false);
  });

  it('skips child pods nested inside Deployment or ReplicaSet parents', () => {
    const nodes = [
      {
        id: 'dep-1',
        type: 'Deployment',
        data: {
          replicas: 2,
          cpuRequest: '100m',
          cpuLimit: '200m',
          memoryRequest: '128Mi',
          memoryLimit: '256Mi',
        },
      },
      {
        id: 'child-pod-1',
        type: 'Pod',
        parentId: 'dep-1',
        data: {
          cpuRequest: '100m',
          cpuLimit: '200m',
          memoryRequest: '128Mi',
          memoryLimit: '256Mi',
        },
      },
    ];

    const result = calculateResourceTotals(nodes);
    // Only dep-1 is calculated (replicas=2) -> cpuReq: 200, cpuLim: 400
    expect(result.cpuReq).toBe(200);
    expect(result.cpuLim).toBe(400);
  });

  it('detects missing CPU or Memory limits and sets hasMissingLimits flag', () => {
    const nodes = [
      {
        id: 'pod-no-limit',
        type: 'Pod',
        data: {
          cpuRequest: '250m',
          memoryRequest: '256Mi',
        },
      },
    ];

    const result = calculateResourceTotals(nodes);
    expect(result.hasMissingLimits).toBe(true);
  });
});
