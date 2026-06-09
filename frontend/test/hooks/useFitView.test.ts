import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFitView } from '@/hooks/useFitView';

const mockGetNodes = vi.fn();
const mockSetViewport = vi.fn();
const mockRfFitView = vi.fn();

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    getNodes: mockGetNodes,
    setViewport: mockSetViewport,
    fitView: mockRfFitView,
  }),
}));

describe('useFitView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div class="react-flow__renderer" style="width: 1000px; height: 1000px;"></div>';
    // Mock getBoundingClientRect for the renderer
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 1000,
      top: 0,
      left: 0,
      bottom: 1000,
      right: 1000,
    } as DOMRect);
  });

  it('does nothing if there are no nodes', () => {
    mockGetNodes.mockReturnValue([]);
    const { result } = renderHook(() => useFitView());
    result.current();
    expect(mockSetViewport).not.toHaveBeenCalled();
    expect(mockRfFitView).not.toHaveBeenCalled();
  });

  it('calculates scale and centers viewport for nodes', () => {
    const nodes = [
      { position: { x: 100, y: 100 }, width: 200, height: 200 },
      { position: { x: 500, y: 500 }, width: 100, height: 100 },
    ];
    mockGetNodes.mockReturnValue(nodes);

    const { result } = renderHook(() => useFitView());
    result.current();

    expect(mockSetViewport).toHaveBeenCalledWith(
        expect.objectContaining({
            zoom: expect.any(Number),
            x: expect.any(Number),
            y: expect.any(Number),
        }),
        expect.objectContaining({ duration: 800 })
    );
  });

  it('falls back to standard fitView if renderer is not found', () => {
    document.body.innerHTML = '';
    mockGetNodes.mockReturnValue([{ position: { x: 0, y: 0 }, width: 100, height: 100 }]);

    const { result } = renderHook(() => useFitView());
    result.current();

    expect(mockRfFitView).toHaveBeenCalled();
  });

  it('respects maxZoom parameter', () => {
    // Large container, small node -> high scale
    mockGetNodes.mockReturnValue([{ position: { x: 0, y: 0 }, width: 10, height: 10 }]);

    const { result } = renderHook(() => useFitView());
    result.current({ maxZoom: 0.5 });

    expect(mockSetViewport).toHaveBeenCalledWith(
        expect.objectContaining({ zoom: 0.5 }),
        expect.any(Object)
    );
  });
});
