import { describe, it, expect } from 'vitest';
import { calculateResourceTotals, calculateWorkloadLimitMetrics } from '@/activities/monitoring/resourceBudgetHelpers';

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

  it('calculates workload limit metrics correctly for constrained and unconstrained workloads', () => {
    const nodes = [
      { id: 'dep-1', type: 'Deployment', data: { replicas: 3, cpuLimit: '500m', memoryLimit: '512Mi' } },
      { id: 'pod-free', type: 'Pod', data: { replicas: 1 } },
      { id: 'child-pod', type: 'Pod', parentId: 'dep-1', data: { replicas: 1, cpuLimit: '500m' } },
      { id: 'svc', type: 'Service', data: {} },
    ];
    const metrics = calculateWorkloadLimitMetrics(nodes);
    expect(metrics.totalPodCount).toBe(4);
    expect(metrics.constrainedPodCount).toBe(3);
    expect(metrics.totalCpuLimMilli).toBe(1500);
    expect(metrics.totalMemLimMiB).toBe(1536);
  });

  it('does not skip pods nested inside a Namespace parent or missing parent', () => {
    const nodes = [
      { id: 'ns-1', type: 'Namespace', data: {} },
      { id: 'pod-in-ns', type: 'Pod', parentId: 'ns-1', data: { cpuRequest: '100m', memoryRequest: '128Mi' } },
      { id: 'pod-orphan-parent', type: 'Pod', parentId: 'non-existent-parent', data: { cpuLimit: '200m' } },
    ];

    const totals = calculateResourceTotals(nodes);
    expect(totals.cpuReq).toBe(300);
    expect(totals.memReq).toBe(128);

    const metrics = calculateWorkloadLimitMetrics(nodes);
    expect(metrics.totalPodCount).toBe(2);
    expect(metrics.constrainedPodCount).toBe(1);
  });

  it('handles nodes with missing type, replicas, and requests using default fallbacks', () => {
    const nodes = [
      // Missing type -> falls back to ''
      { id: 'no-type', data: {} },
      // Pod without replicas, cpuRequest, or memoryRequest -> falls back to 1 and '0'
      { id: 'pod-defaults', type: 'Pod', data: {} },
    ];

    const totals = calculateResourceTotals(nodes);
    expect(totals.cpuReq).toBe(0);
    expect(totals.memReq).toBe(0);
    expect(totals.hasMissingLimits).toBe(true);

    const metrics = calculateWorkloadLimitMetrics(nodes);
    expect(metrics.totalPodCount).toBe(1);
    expect(metrics.constrainedPodCount).toBe(0);
  });

  it('defaults requests to limits for Guaranteed QoS and supports StatefulSet nodes', () => {
    const nodes = [
      { id: 'ss-1', type: 'StatefulSet', data: { replicas: 2, cpuLimit: '500m', memoryLimit: '256Mi' } },
      { id: 'ss-child', type: 'Pod', parentId: 'ss-1', data: { cpuLimit: '500m', memoryLimit: '256Mi' } },
    ];

    const totals = calculateResourceTotals(nodes);
    expect(totals.cpuReq).toBe(1000);
    expect(totals.cpuLim).toBe(1000);
    expect(totals.memReq).toBe(512);
    expect(totals.memLim).toBe(512);
    expect(totals.hasMissingLimits).toBe(false);

    const metrics = calculateWorkloadLimitMetrics(nodes);
    expect(metrics.totalPodCount).toBe(2);
    expect(metrics.constrainedPodCount).toBe(2);
    expect(metrics.totalCpuLimMilli).toBe(1000);
    expect(metrics.totalMemLimMiB).toBe(512);
  });
});
