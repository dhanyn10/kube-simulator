import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasMiniMap, CanvasMiniMapNode, getMiniMapNodeColor } from '@/components/Layout/CanvasMiniMap';
import { useFlowStore } from '@/store';
import * as helpers from '@/store/helpers';
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

  it('getMiniMapNodeColor returns matching color based on node type and theme', () => {
    expect(getMiniMapNodeColor('Deployment', 'dark')).toBe('#8b5cf6');
    expect(getMiniMapNodeColor('StatefulSet', 'light')).toBe('#8b5cf6');
    expect(getMiniMapNodeColor('Pod', 'dark')).toBe('#22d3ee');
    expect(getMiniMapNodeColor('Service', 'light')).toBe('#f59e0b');
    expect(getMiniMapNodeColor('ConfigMap', 'dark')).toBe('#475569');
    expect(getMiniMapNodeColor('ConfigMap', 'light')).toBe('#94A3B8');
    expect(getMiniMapNodeColor(undefined, 'dark')).toBe('#475569');
    expect(getMiniMapNodeColor(undefined, 'light')).toBe('#94A3B8');
  });

  it('CanvasMiniMap renders arrows with light mode styling when colorMode is light', () => {
    useFlowStore.setState({ minimapPosition: 'bottom-right', colorMode: 'light' });

    render(
      <ReactFlowProvider>
        <CanvasMiniMap />
      </ReactFlowProvider>
    );

    const leftArrow = screen.getByTestId('minimap-arrow-left');
    expect(leftArrow).toHaveClass('bg-white');
  });

  it('CanvasMiniMapNode uses getDomMeasuredNodeSize dimensions if available', () => {
    vi.spyOn(helpers, 'getDomMeasuredNodeSize').mockReturnValue({ width: 175, height: 250 });

    const { container } = render(
      <svg>
        <CanvasMiniMapNode id="measured-node" x={5} y={10} width={100} height={100} />
      </svg>
    );

    const baseRect = container.querySelector('rect');
    expect(baseRect).toHaveAttribute('width', '175');
    expect(baseRect).toHaveAttribute('height', '250');
  });

  it('CanvasMiniMapNode handles horizontal aspect ratio without detail lines', () => {
    vi.spyOn(helpers, 'getDomMeasuredNodeSize').mockReturnValue({ width: 0, height: 0 });

    const { container } = render(
      <svg>
        <CanvasMiniMapNode id="horiz-node" x={0} y={0} width={200} height={80} />
      </svg>
    );

    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(0);
  });

  it('CanvasMiniMapNode handles vertical heights below 40 with null detail lines', () => {
    vi.spyOn(helpers, 'getDomMeasuredNodeSize').mockReturnValue({ width: 0, height: 0 });

    const { container } = render(
      <svg>
        <CanvasMiniMapNode id="short-node" x={0} y={0} width={25} height={35} />
      </svg>
    );

    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(0);
  });

  it('CanvasMiniMapNode renders varying detail lines based on height thresholds and service type', () => {
    vi.spyOn(helpers, 'getDomMeasuredNodeSize').mockReturnValue({ width: 0, height: 0 });

    // Height 50 (>= 40, < 65) -> 1 line
    const { container: c50 } = render(
      <svg>
        <CanvasMiniMapNode id="n50" x={0} y={0} width={30} height={50} />
      </svg>
    );
    expect(c50.querySelectorAll('line')).toHaveLength(1);

    // Height 70 (>= 65, < 90) -> 2 lines
    const { container: c70 } = render(
      <svg>
        <CanvasMiniMapNode id="n70" x={0} y={0} width={30} height={70} />
      </svg>
    );
    expect(c70.querySelectorAll('line')).toHaveLength(2);

    // Height 100 (>= 90, < 115) -> 3 lines
    const { container: c100 } = render(
      <svg>
        <CanvasMiniMapNode id="n100" x={0} y={0} width={30} height={100} />
      </svg>
    );
    expect(c100.querySelectorAll('line')).toHaveLength(3);

    // Height 120 with non-service node -> 3 lines
    useFlowStore.setState({
      nodes: [{ id: 'pod-node', type: 'Pod', position: { x: 0, y: 0 }, data: {} } as any],
    });
    const { container: cPod } = render(
      <svg>
        <CanvasMiniMapNode id="pod-node" x={0} y={0} width={30} height={120} />
      </svg>
    );
    expect(cPod.querySelectorAll('line')).toHaveLength(3);

    // Height 120 with Service node -> 5 lines (3 lines + dashed + 1 bottom line)
    useFlowStore.setState({
      nodes: [{ id: 'svc-node', type: 'Service', position: { x: 0, y: 0 }, data: {} } as any],
    });
    const { container: cSvc } = render(
      <svg>
        <CanvasMiniMapNode id="svc-node" x={0} y={0} width={30} height={120} />
      </svg>
    );
    expect(cSvc.querySelectorAll('line')).toHaveLength(5);
  });

  it('CanvasMiniMapNode handles selected state and default fallback colors with undefined onClick', () => {
    vi.spyOn(helpers, 'getDomMeasuredNodeSize').mockReturnValue({ width: 0, height: 0 });

    const { container } = render(
      <svg>
        <CanvasMiniMapNode id="def-node" x={0} y={0} width={100} height={100} selected={true} />
      </svg>
    );

    const baseRect = container.querySelector('rect');
    expect(baseRect).toHaveAttribute('fill', '#94A3B8');
    expect(baseRect).toHaveAttribute('stroke', '#334155');

    const g = container.querySelector('g.react-flow__minimap-node');
    expect(g).toHaveClass('opacity-90');
    // Clicking without onClick prop should not throw
    expect(() => fireEvent.click(g!)).not.toThrow();
  });
});
