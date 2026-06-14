import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EdgeConfig } from '@/components/Config/EdgeConfig';
import { useFlowStore } from '@/store';

describe('EdgeConfig', () => {
  const mockEdge = { id: 'e1', data: { width: 4 } };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      edges: [mockEdge],
      colorMode: 'dark',
      globalEdgeColor: 'var(--color-mat-indigo)',
      globalEdgeErrorColor: 'var(--color-mat-red)'
    } as any);
  });

  it('updates edge width', () => {
    const setEdgesSpy = vi.spyOn(useFlowStore.getState(), 'setEdges');
    render(<EdgeConfig selectedEdge={mockEdge} />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '8' } });

    expect(setEdgesSpy).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ data: expect.objectContaining({ width: 8 }) })
    ]));
  });

  it('changes running color', () => {
    const setGlobalEdgeColorsSpy = vi.spyOn(useFlowStore.getState(), 'setGlobalEdgeColors');
    render(<EdgeConfig selectedEdge={mockEdge} />);

    // MATERIAL_COLORS has many colors. We can find by title.
    // Let's pick 'Blue' from the first palette (Running Color)
    const colorBtn = screen.getAllByTitle('Blue')[0];
    fireEvent.click(colorBtn);

    expect(setGlobalEdgeColorsSpy).toHaveBeenCalled();
  });

  it('resets colors to default', () => {
    const setGlobalEdgeColorsSpy = vi.spyOn(useFlowStore.getState(), 'setGlobalEdgeColors');
    render(<EdgeConfig selectedEdge={mockEdge} />);

    const resetBtns = screen.getAllByTitle('Reset to default');
    fireEvent.click(resetBtns[0]); // Reset Running
    expect(setGlobalEdgeColorsSpy).toHaveBeenCalledWith('var(--color-mat-indigo)', expect.any(String));

    fireEvent.click(resetBtns[1]); // Reset Error
    expect(setGlobalEdgeColorsSpy).toHaveBeenCalledWith(expect.any(String), 'var(--color-mat-red)');
  });
});
