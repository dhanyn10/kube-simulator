import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasMiniMap, CanvasMiniMapNode } from '@/components/Layout/CanvasMiniMap';
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

  it('renders CanvasMiniMapNode with vertical card aspect ratio, header, and detail lines for Service', () => {
    useFlowStore.setState({
      nodes: [
        {
          id: 'svc-1',
          type: 'Service',
          position: { x: 0, y: 0 },
          data: { label: 'web-service', serviceType: 'NodePort', port: 80, targetPort: 80, nodePort: 30080 },
          width: 150,
          height: 200,
          measured: { width: 150, height: 200 },
        } as any,
      ],
    });

    const handleClick = vi.fn();
    const { container } = render(
      <svg>
        <CanvasMiniMapNode
          id="svc-1"
          x={10}
          y={20}
          width={150}
          height={200}
          color="#f59e0b"
          strokeColor="#334155"
          onClick={handleClick}
        />
      </svg>
    );

    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(2);
    // Base card rect
    expect(rects[0]).toHaveAttribute('width', '150');
    expect(rects[0]).toHaveAttribute('height', '200');
    expect(rects[0]).toHaveAttribute('fill', '#f59e0b');

    // Header rect
    expect(rects[1]).toHaveAttribute('width', '150');

    // Detail lines
    const lines = container.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);

    const g = container.querySelector('g.react-flow__minimap-node');
    expect(g).toBeInTheDocument();
    fireEvent.click(g!);
    expect(handleClick).toHaveBeenCalledWith(expect.anything(), 'svc-1');
  });
});
