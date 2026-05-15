import { describe, it, expect } from 'vitest';
import { parseCPU, parseMemory, formatCPU, formatMemory } from './utils';

describe('resource utils', () => {
  describe('parseCPU', () => {
    it('parses milliCPU', () => {
      expect(parseCPU('500m')).toBe(500);
    });
    it('parses Cores', () => {
      expect(parseCPU('1')).toBe(1000);
      expect(parseCPU(2)).toBe(2); // If number passed, returns as is
    });
    it('handles defaults', () => {
      expect(parseCPU(undefined)).toBe(500);
    });
  });

  describe('parseMemory', () => {
    it('parses Mi', () => {
      expect(parseMemory('512Mi')).toBe(512);
    });
    it('parses Gi', () => {
      expect(parseMemory('1Gi')).toBe(1024);
    });
    it('handles defaults', () => {
      expect(parseMemory('')).toBe(512);
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
});
