import { describe, it, expect, vi } from 'vitest';
import {
  CircularRingBuffer,
  hexToRgba,
  renderCanvasSeries,
  CanvasSeriesItem,
} from '@/components/Monitoring/system-monitor';

describe('SystemMonitor Task Manager Architecture', () => {
  describe('CircularRingBuffer (Zero-Allocation Memory)', () => {
    it('initializes with capacity and reports initial state', () => {
      const ring = new CircularRingBuffer(10);
      expect(ring).toHaveLength(0);
      expect(ring.maxCapacity).toBe(10);
      expect(ring.latest).toBe(0);
      expect(ring.toArray()).toEqual(new Float32Array([]));
    });

    it('pushes elements below capacity and preserves chronological order', () => {
      const ring = new CircularRingBuffer(5);
      ring.push(10);
      ring.push(20);
      ring.push(30);

      expect(ring).toHaveLength(3);
      expect(ring.latest).toBe(30);
      expect(ring.toArray()).toEqual(new Float32Array([10, 20, 30]));
    });

    it('wraps around circular buffer when capacity is exceeded (O(1) overwrite)', () => {
      const ring = new CircularRingBuffer(4);
      ring.push(1);
      ring.push(2);
      ring.push(3);
      ring.push(4);
      expect(ring.toArray()).toEqual(new Float32Array([1, 2, 3, 4]));

      // Pushing 5th and 6th items should overwrite oldest items (1 and 2)
      ring.push(5);
      ring.push(6);

      expect(ring).toHaveLength(4);
      expect(ring.latest).toBe(6);
      expect(ring.toArray()).toEqual(new Float32Array([3, 4, 5, 6]));
    });

    it('clears all samples and resets head pointer', () => {
      const ring = new CircularRingBuffer(5);
      ring.push(100);
      ring.push(200);
      expect(ring).toHaveLength(2);

      ring.clear();
      expect(ring).toHaveLength(0);
      expect(ring.latest).toBe(0);
      expect(ring.toArray()).toEqual(new Float32Array([]));
    });
  });

  describe('hexToRgba Color Helper', () => {
    it('converts 6-digit hex to rgba string', () => {
      expect(hexToRgba('#3b82f6', 0.5)).toBe('rgba(59, 130, 246, 0.5)');
      expect(hexToRgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
    });

    it('converts 3-digit shorthand hex to rgba string', () => {
      expect(hexToRgba('#fff', 0.8)).toBe('rgba(255, 255, 255, 0.8)');
    });

    it('handles invalid hex gracefully with fallback rgba', () => {
      expect(hexToRgba('invalid', 0.2)).toBe('rgba(59, 130, 246, 0.2)');
    });
  });

  describe('renderCanvasSeries (Direct 2D GPU Rendering)', () => {
    it('clears canvas and draws area gradient and stroke line', () => {
      const ctx = {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({
          addColorStop: vi.fn(),
        }),
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
      } as unknown as CanvasRenderingContext2D;

      const series: CanvasSeriesItem[] = [
        {
          id: 'dep-cpu',
          color: '#3b82f6',
          data: [10, 40, 80],
          isArea: true,
          lineWidth: 2,
        },
      ];

      renderCanvasSeries(ctx, 500, 140, series, 100, 10);

      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 500, 140);
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('draws stepped square-wave line for replicas series', () => {
      const ctx = {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({
          addColorStop: vi.fn(),
        }),
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
      } as unknown as CanvasRenderingContext2D;

      const series: CanvasSeriesItem[] = [
        {
          id: 'replicas',
          color: '#06b6d4',
          data: [1, 2, 4],
          isStepped: true,
        },
      ];

      renderCanvasSeries(ctx, 500, 100, series, 10, 10);

      expect(ctx.clearRect).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('handles empty data gracefully without throwing', () => {
      const ctx = {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      renderCanvasSeries(ctx, 500, 100, [{ id: 'empty', color: '#fff', data: [] }], 100);
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 500, 100);
      expect(ctx.beginPath).not.toHaveBeenCalled();
    });
  });
});
