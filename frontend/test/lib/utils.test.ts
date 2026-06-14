import { describe, it, expect, vi } from 'vitest';
import { parseCPU, parseMemory, formatCPU, formatMemory, getAbsPos, randomId, validateResourceLimits, generateYaml, cn } from '@/lib/utils';

describe('utils', () => {
  describe('cn', () => {
    it('merges tailwind classes', () => {
      expect(cn('bg-red-500', 'p-4')).toBe('bg-red-500 p-4');
      expect(cn('p-2', 'p-4')).toBe('p-4'); // tailwind-merge in action
    });
  });

  describe('getAbsPos', () => {
    it('calculates absolute position for nested nodes', () => {
        const nodes = [
            { id: 'n1', position: { x: 10, y: 20 } },
            { id: 'n2', position: { x: 5, y: 5 }, parentId: 'n1' }
        ];
        expect(getAbsPos('n2', nodes)).toEqual({ x: 15, y: 25 });
        expect(getAbsPos('non-existent', nodes)).toEqual({ x: 0, y: 0 });
    });
  });

  describe('randomId', () => {
      it('generates prefixed id', () => {
          expect(randomId('test')).toContain('test-');
      });
  });

  describe('parseCPU', () => {
    it('parses milliCPU', () => {
      expect(parseCPU('500m')).toBe(500);
    });
    it('parses Cores', () => {
      expect(parseCPU('1')).toBe(1000);
      expect(parseCPU(2)).toBe(2);
    });
    it('handles defaults', () => {
      expect(parseCPU(undefined)).toBe(500);
      expect(parseCPU('')).toBe(500);
      // @ts-ignore
      expect(parseCPU(null)).toBe(500);
      expect(parseCPU('invalid')).toBe(500);
    });
  });

  describe('parseMemory', () => {
    it('parses Mi', () => {
      expect(parseMemory('512Mi')).toBe(512);
    });
    it('parses Gi', () => {
      expect(parseMemory('1Gi')).toBe(1024);
    });
    it('parses raw numbers as Mi', () => {
        expect(parseMemory('256')).toBe(256);
    });
    it('handles defaults', () => {
      expect(parseMemory('')).toBe(512);
      expect(parseMemory(undefined)).toBe(512);
      // @ts-ignore
      expect(parseMemory(null)).toBe(512);
      expect(parseMemory('invalid')).toBe(512);
    });
  });

  describe('formatters', () => {
    it('formats CPU correctly', () => {
      expect(formatCPU(1000)).toBe('1.0 Core');
      expect(formatCPU(500)).toBe('500m');
    });
    it('formats Memory correctly', () => {
      expect(formatMemory(1024)).toBe('1.0 Gi');
      expect(formatMemory(512)).toBe('512 Mi');
    });
  });

  describe('validateResourceLimits', () => {
      it('detects errors when limits < requests', () => {
          const data = { cpuRequest: '500m', cpuLimit: '200m', memoryRequest: '1Gi', memoryLimit: '512Mi' };
          const res = validateResourceLimits(data);
          expect(res.isCpuError).toBe(true);
          expect(res.isMemError).toBe(true);
          expect(res.hasError).toBe(true);
      });
      it('returns no error for valid limits', () => {
          const data = { cpuRequest: '200m', cpuLimit: '500m' };
          const res = validateResourceLimits(data);
          expect(res.hasError).toBe(false);
      });
  });

  describe('generateYaml', () => {
      it('calls backend and parses JSON results', async () => {
          const mockYaml = JSON.stringify([{ kind: 'Pod', metadata: { name: 'test' } }]);
          (globalThis as any).go = {
              main: { App: { GenerateYaml: vi.fn().mockResolvedValue(mockYaml) } }
          };

          const result = await generateYaml([], []);
          expect(result).toContain('kind: Pod');
          expect(result).toContain('name: test');
      });

      it('handles non-array response from backend', async () => {
        (globalThis as any).go = {
            main: { App: { GenerateYaml: vi.fn().mockResolvedValue('raw string') } }
        };
        const result = await generateYaml([], []);
        expect(result).toBe('raw string');
      });

      it('returns empty string if backend missing', async () => {
        (globalThis as any).go = {};
        const result = await generateYaml([], []);
        expect(result).toBe("");
      });
  });
});
