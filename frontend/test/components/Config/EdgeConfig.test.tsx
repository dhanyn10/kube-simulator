import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
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
      globalEdgeErrorColor: 'var(--color-mat-red)',
      setGlobalEdgeColors: (color: string, errorColor: string) => {
        useFlowStore.setState({ globalEdgeColor: color, globalEdgeErrorColor: errorColor });
      },
      setEdges: (edges: any) => {
        useFlowStore.setState({ edges });
      },
    } as any);
  });

  it('updates edge width and handles default data fallback when width is undefined', () => {
    const setEdgesSpy = vi.spyOn(useFlowStore.getState(), 'setEdges');
    render(<EdgeConfig selectedEdge={{ id: 'e1' }} />);

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('2'); // fallback default width 2

    fireEvent.change(slider, { target: { value: '8' } });

    expect(setEdgesSpy).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ data: expect.objectContaining({ width: 8 }) })
    ]));
  });

  it('changes running color and handles color swaps when selected color equals error color', () => {
    render(<EdgeConfig selectedEdge={mockEdge} />);

    // Pick 'Red' color for running color which matches globalEdgeErrorColor 'var(--color-mat-red)'
    const redColorBtn = screen.getAllByTitle('Red')[0];
    fireEvent.click(redColorBtn);

    expect(useFlowStore.getState().globalEdgeColor).toBe('var(--color-mat-red)');
    expect(useFlowStore.getState().globalEdgeErrorColor).toBe('var(--color-mat-indigo)');

    // Pick 'Blue' color for running color
    const blueColorBtn = screen.getAllByTitle('Blue')[0];
    fireEvent.click(blueColorBtn);

    expect(useFlowStore.getState().globalEdgeColor).toBe('var(--color-mat-blue)');
    expect(useFlowStore.getState().globalEdgeErrorColor).toBe('var(--color-mat-indigo)');
  });

  it('changes error color and handles color swaps when selected color equals running color', () => {
    render(<EdgeConfig selectedEdge={mockEdge} />);

    // Pick 'Indigo' color for error color which matches globalEdgeColor 'var(--color-mat-indigo)'
    const indigoColorBtn = screen.getAllByTitle('Indigo')[1];
    fireEvent.click(indigoColorBtn);

    expect(useFlowStore.getState().globalEdgeErrorColor).toBe('var(--color-mat-indigo)');
    expect(useFlowStore.getState().globalEdgeColor).toBe('var(--color-mat-red)');

    // Pick 'Amber' color for error color
    const amberColorBtn = screen.getAllByTitle('Amber')[1];
    fireEvent.click(amberColorBtn);

    expect(useFlowStore.getState().globalEdgeErrorColor).toBe('var(--color-mat-amber)');
    expect(useFlowStore.getState().globalEdgeColor).toBe('var(--color-mat-red)');
  });

  it('resets colors to default and renders in light mode', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<EdgeConfig selectedEdge={mockEdge} />);

    const resetBtns = screen.getAllByTitle('Reset to default');
    fireEvent.click(resetBtns[0]); // Reset Running
    expect(useFlowStore.getState().globalEdgeColor).toBe('var(--color-mat-indigo)');

    fireEvent.click(resetBtns[1]); // Reset Error
    expect(useFlowStore.getState().globalEdgeErrorColor).toBe('var(--color-mat-red)');
  });
});
