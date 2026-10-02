import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasMiniMap } from '@/components/Layout/CanvasMiniMap';
import { useFlowStore } from '@/store';
import { ReactFlowProvider } from '@xyflow/react';
import '@testing-library/jest-dom';

describe('CanvasMiniMap Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      minimapPosition: 'bottom-right',
      colorMode: 'dark',
    });
  });

  it('renders left and up arrows when in bottom-right position, and handles position changes', () => {
    render(
      <ReactFlowProvider>
        <CanvasMiniMap />
      </ReactFlowProvider>
    );

    const leftArrow = screen.getByTestId('minimap-arrow-left');
    const upArrow = screen.getByTestId('minimap-arrow-up');

    expect(leftArrow).toBeInTheDocument();
    expect(upArrow).toBeInTheDocument();

    fireEvent.click(leftArrow);
    expect(useFlowStore.getState().minimapPosition).toBe('bottom-left');
  });

  it('renders up arrow and moves to top-right when clicked', () => {
    render(
      <ReactFlowProvider>
        <CanvasMiniMap />
      </ReactFlowProvider>
    );

    const upArrow = screen.getByTestId('minimap-arrow-up');
    fireEvent.click(upArrow);
    expect(useFlowStore.getState().minimapPosition).toBe('top-right');
  });

  it('renders right arrow when in bottom-left position and moves to bottom-right', () => {
    useFlowStore.setState({ minimapPosition: 'bottom-left' });

    render(
      <ReactFlowProvider>
        <CanvasMiniMap />
      </ReactFlowProvider>
    );

    const rightArrow = screen.getByTestId('minimap-arrow-right');
    expect(rightArrow).toBeInTheDocument();

    fireEvent.click(rightArrow);
    expect(useFlowStore.getState().minimapPosition).toBe('bottom-right');
  });

  it('renders down arrow when in top-right position and moves to bottom-right', () => {
    useFlowStore.setState({ minimapPosition: 'top-right' });

    render(
      <ReactFlowProvider>
        <CanvasMiniMap />
      </ReactFlowProvider>
    );

    const downArrow = screen.getByTestId('minimap-arrow-down');
    expect(downArrow).toBeInTheDocument();

    fireEvent.click(downArrow);
    expect(useFlowStore.getState().minimapPosition).toBe('bottom-right');
  });
});
