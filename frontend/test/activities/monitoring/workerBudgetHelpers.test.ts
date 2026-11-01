import { describe, it, expect, vi } from 'vitest';
import {
  getLocalHardwareSpecs,
  calculateClusterBudget,
  getBudgetStatusBadgeClass,
  WORKER_PRESETS,
} from '@/activities/monitoring/workerBudgetHelpers';

describe('workerBudgetHelpers', () => {
  it('detects local hardware specs with fallback values', () => {
    const specs = getLocalHardwareSpecs();
    expect(specs.cpuCores).toBeGreaterThanOrEqual(1);
    expect(specs.memoryGb).toBeGreaterThanOrEqual(8);
  });

  it('falls back to 8 cores when navigator.hardwareConcurrency is missing', () => {
    const originalNavigator = globalThis.navigator;
    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });
      const specs = getLocalHardwareSpecs();
      expect(specs.cpuCores).toBe(8);
      expect(specs.memoryGb).toBe(16);
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    }
  });

  it('calculates optimal budget status when cluster resources are within hardware limits and meet demands', () => {
    const nodes = [
      {
        id: 'deploy-1',
        type: 'Deployment',
        data: { replicas: 2, cpuRequest: '500m', memoryRequest: '512Mi' },
      },
    ];

    const result = calculateClusterBudget({
      workerCount: 3,
      vCpuPerWorker: 2,
      memoryGbPerWorker: 4,
      nodes,
      localHardware: { cpuCores: 8, memoryGb: 16 },
    });

    expect(result.workerCount).toBe(3);
    expect(result.totalClusterCpu).toBe(6);
    expect(result.totalClusterMemoryGb).toBe(12);
    expect(result.maxPodsCapacity).toBe(330);
    expect(result.isLocalOverloaded).toBe(false);
    expect(result.isWorkloadDeficit).toBe(false);
    expect(result.statusLevel).toBe('safe');
  });

  it('flags danger status when cluster workers exceed local hardware limits', () => {
    const result = calculateClusterBudget({
      workerCount: 20,
      vCpuPerWorker: 2,
      memoryGbPerWorker: 4,
      nodes: [],
      localHardware: { cpuCores: 8, memoryGb: 16 },
    });

    expect(result.totalClusterCpu).toBe(40);
    expect(result.totalClusterMemoryGb).toBe(80);
    expect(result.isLocalOverloaded).toBe(true);
    expect(result.statusLevel).toBe('danger');
  });

  it('flags warning status when cluster supply is less than active canvas workload demands', () => {
    const nodes = [
      {
        id: 'heavy-deploy',
        type: 'Deployment',
        data: { replicas: 5, cpuRequest: '2000m', memoryRequest: '4Gi' },
      },
    ];

    const result = calculateClusterBudget({
      workerCount: 2,
      vCpuPerWorker: 2,
      memoryGbPerWorker: 4,
      nodes,
      localHardware: { cpuCores: 16, memoryGb: 32 },
    });

    // 5 replicas * 2 vCPU = 10 vCPU demand, but 2 workers * 2 vCPU = 4 vCPU supply
    expect(result.isWorkloadDeficit).toBe(true);
    expect(result.isLocalOverloaded).toBe(false);
    expect(result.statusLevel).toBe('warning');
  });

  it('flags warning status when workerCount > 15 even without deficit or overload', () => {
    const result = calculateClusterBudget({
      workerCount: 16,
      vCpuPerWorker: 1,
      memoryGbPerWorker: 1,
      nodes: [],
      localHardware: { cpuCores: 64, memoryGb: 64 },
    });
    expect(result.statusLevel).toBe('warning');
  });

  it('clamps worker counts within 1 to 100 range and handles NaN', () => {
    const clampedLow = calculateClusterBudget({
      workerCount: 0,
      vCpuPerWorker: 1,
      memoryGbPerWorker: 2,
      nodes: [],
    });
    expect(clampedLow.workerCount).toBe(1);

    const clampedNaN = calculateClusterBudget({
      workerCount: Number.NaN,
      vCpuPerWorker: 1,
      memoryGbPerWorker: 2,
      nodes: [],
    });
    expect(clampedNaN.workerCount).toBe(1);

    const clampedHigh = calculateClusterBudget({
      workerCount: 150,
      vCpuPerWorker: 1,
      memoryGbPerWorker: 2,
      nodes: [],
    });
    expect(clampedHigh.workerCount).toBe(100);
  });

  it('returns proper badge CSS classes for each status level', () => {
    expect(getBudgetStatusBadgeClass('danger')).toContain('text-rose-400');
    expect(getBudgetStatusBadgeClass('warning')).toContain('text-amber-400');
    expect(getBudgetStatusBadgeClass('safe')).toContain('text-emerald-400');
  });

  it('has valid presets array', () => {
    expect(WORKER_PRESETS.length).toBe(3);
    expect(WORKER_PRESETS[0].id).toBe('small');
    expect(WORKER_PRESETS[1].id).toBe('standard');
    expect(WORKER_PRESETS[2].id).toBe('large');
  });
});
