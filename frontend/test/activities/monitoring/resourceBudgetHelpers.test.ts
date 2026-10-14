import { describe, it, expect } from 'vitest';
import { calculateResourceTotals } from '@/activities/monitoring/resourceBudgetHelpers';

describe('resourceBudgetHelpers', () => {
  it('returns default zero values for empty nodes array or non-workload nodes', () => {
    const emptyResult = calculateResourceTotals([]);
    expect(emptyResult).toEqual({ cpuReq: 0, memReq: 0, cpuLim: 0, memLim: 0, hasMissingLimits: false });

    const nonWorkloadNodes = [{ id: '1', type: 'Service', data: {} }, { id: '2', type: 'Ingress', data: {} }];
    const nonWorkloadResult = calculateResourceTotals(nonWorkloadNodes);
    expect(nonWorkloadResult).toEqual({ cpuReq: 0, memReq: 0, cpuLim: 0, memLim: 0, hasMissingLimits: false });
  });

  it('aggregates CPU and Memory requests/limits for top-level Pods and Deployments', () => {
    const workloadNodes = [
      { id: 'dep-1', type: 'Deployment', data: { replicas: 2, cpuRequest: '250m', cpuLimit: '500m', memoryRequest: '256Mi', memoryLimit: '512Mi' } },
      { id: 'pod-1', type: 'Pod', data: { cpuRequest: '500m', cpuLimit: '1000m', memoryRequest: '512Mi', memoryLimit: '1024Mi' } }
    ];

    const aggregatedResult = calculateResourceTotals(workloadNodes);
    expect(aggregatedResult.cpuReq).toBe(1000);
    expect(aggregatedResult.cpuLim).toBe(2000);
    expect(aggregatedResult.memReq).toBe(1024);
    expect(aggregatedResult.memLim).toBe(2048);
    expect(aggregatedResult.hasMissingLimits).toBe(false);
  });

  it('skips child pods nested inside Deployment or ReplicaSet parents', () => {
    const parentChildNodes = [
      { id: 'dep-1', type: 'Deployment', data: { replicas: 2, cpuRequest: '100m', cpuLimit: '200m', memoryRequest: '128Mi', memoryLimit: '256Mi' } },
      { id: 'child-pod-1', type: 'Pod', parentId: 'dep-1', data: { cpuRequest: '100m', cpuLimit: '200m', memoryRequest: '128Mi', memoryLimit: '256Mi' } }
    ];

    const parentChildResult = calculateResourceTotals(parentChildNodes);
    expect(parentChildResult.cpuReq).toBe(200);
    expect(parentChildResult.cpuLim).toBe(400);
  });

  it('detects missing CPU or Memory limits and sets hasMissingLimits flag', () => {
    const unconstrainedNodes = [{ id: 'pod-no-limit', type: 'Pod', data: { cpuRequest: '250m', memoryRequest: '256Mi' } }];
    const unconstrainedResult = calculateResourceTotals(unconstrainedNodes);
    expect(unconstrainedResult.hasMissingLimits).toBe(true);
  });
});
