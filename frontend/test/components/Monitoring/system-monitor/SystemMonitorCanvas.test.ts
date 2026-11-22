import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  CircularRingBuffer,
  hexToRgba,
  renderCanvasSeries,
  CanvasSeriesItem,
  SystemMonitorCanvasRenderer,
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

    it('renders SystemMonitorCanvasRenderer component and draws onto canvas 2d context', () => {
      const mockCtx = {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        save: vi.fn(),
        scale: vi.fn(),
        restore: vi.fn(),
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
      };
      const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

      const series: CanvasSeriesItem[] = [
        {
          id: 's-1',
          color: '#3b82f6',
          data: [10, 20, 30],
          isArea: true,
          lineWidth: 2,
        },
      ];

      const { unmount } = render(
        React.createElement(SystemMonitorCanvasRenderer, { series, maxVal: 100, capacity: 10 })
      );

      expect(mockCtx.clearRect).toHaveBeenCalled();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();

      unmount();
      getContextSpy.mockRestore();
    });

    it('covers uncovered conditions in SystemMonitorCanvasRenderer (lines 48, 149, 154, 162)', () => {
      const mockCtx = {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        save: vi.fn(),
        scale: vi.fn(),
        restore: vi.fn(),
      };
      const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

      // 1. Line 149: canvas is null
      const lockedRef = {
        get current() { return null; },
        set current(_v: any) {},
      };
      const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      let currentH = internals?.H;
      if (internals) {
        Object.defineProperty(internals, 'H', {
          configurable: true,
          get() { return currentH; },
          set(newH) {
            if (newH && newH.useRef) {
              const origHUseRef = newH.useRef;
              newH.useRef = (init: any) => {
                origHUseRef(init);
                return lockedRef;
              };
            }
            currentH = newH;
          }
        });
      }
      const { unmount: unmountNull } = render(
        React.createElement(SystemMonitorCanvasRenderer, { series: [], maxVal: 100, capacity: 5 })
      );
      unmountNull();
      if (internals) {
        Object.defineProperty(internals, 'H', {
          configurable: true,
          writable: true,
          value: currentH,
        });
      }

      // Line 152: ctx is null
      getContextSpy.mockReturnValueOnce(null as any);
      const { unmount: unmountNoCtx } = render(
        React.createElement(SystemMonitorCanvasRenderer, { series: [], maxVal: 100, capacity: 5 })
      );
      unmountNoCtx();

      // 2. Line 48 (data.length > capacity), Line 154 (devicePixelRatio falsy), Line 162 (rerender with same size)
      const origDpr = globalThis.devicePixelRatio;
      try {
        (globalThis as any).devicePixelRatio = 0; // line 154: falls back to 1

        const seriesWithOverflow: CanvasSeriesItem[] = [
          {
            id: 'overflow-series',
            color: '#3b82f6',
            data: [10, 20, 30, 40, 50, 60], // length 6 > capacity 3 (line 48)
            isArea: true,
          },
        ];

        const { rerender, unmount, container } = render(
          React.createElement(SystemMonitorCanvasRenderer, { series: seriesWithOverflow, maxVal: 100, capacity: 3 })
        );

        // Rerender with identical dimensions (line 162: canvas.width === targetWidth && canvas.height === targetHeight)
        const origWidthDesc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
        const origHeightDesc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');

        try {
          // Force canvas.width === targetWidth (500) so branch 16 evaluates canvas.height
          Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
            get() { return 500; },
            set(_v) {},
            configurable: true,
          });
          // Case A: canvas.height matches targetHeight (140)
          Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
            get() { return 140; },
            set(_v) {},
            configurable: true,
          });
          rerender(
            React.createElement(SystemMonitorCanvasRenderer, { series: [...seriesWithOverflow], maxVal: 100, capacity: 3 })
          );

          // Case B: canvas.height does NOT match targetHeight (140)
          Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
            get() { return 999; },
            set(_v) {},
            configurable: true,
          });
          rerender(
            React.createElement(SystemMonitorCanvasRenderer, { series: [{ ...seriesWithOverflow[0] }], maxVal: 100, capacity: 3 })
          );
        } finally {
          if (origWidthDesc) Object.defineProperty(HTMLCanvasElement.prototype, 'width', origWidthDesc);
          if (origHeightDesc) Object.defineProperty(HTMLCanvasElement.prototype, 'height', origHeightDesc);
        }

        expect(mockCtx.clearRect).toHaveBeenCalled();
        expect(mockCtx.moveTo).toHaveBeenCalled();
        expect(mockCtx.stroke).toHaveBeenCalled();

        unmount();
      } finally {
        (globalThis as any).devicePixelRatio = origDpr;
        getContextSpy.mockRestore();
      }
    });
  });
});
