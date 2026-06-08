import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReplicaSetNode } from '@/components/Nodes/ReplicaSet';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

// Mock @xyflow/react
vi.mock('@xyflow/react', () => ({
  NodeResizer: () => <div data-testid="node-resizer" />,
  Handle: () => <div data-testid="handle" />,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

describe('ReplicaSetNode', () => {
  const defaultProps = {
    id: '1',
    data: { label: 'test-rs', replicas: 1 },
    selected: false,
    zIndex: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    dragging: false,
    type: 'replicaSet',
  } as any;

  it('renders correctly', () => {
    render(<ReplicaSetNode {...defaultProps} />);
    expect(screen.getByText('ReplicaSet: test-rs')).toBeInTheDocument();
  });

  it('shows replica count if greater than 1', () => {
    const props = {
      ...defaultProps,
      data: { ...defaultProps.data, replicas: 3 },
    };
    render(<ReplicaSetNode {...props} />);
    expect(screen.getByText('x3')).toBeInTheDocument();
  });

  it('does not show replica count if equal to 1', () => {
    render(<ReplicaSetNode {...defaultProps} />);
    expect(screen.queryByText('x1')).not.toBeInTheDocument();
  });

  it('applies light mode classes', () => {
    useFlowStore.setState({ colorMode: 'light' });
    const { container } = render(<ReplicaSetNode {...defaultProps} />);
    expect(container.firstChild).toHaveClass('bg-emerald-500/[0.02]');
  });

  it('applies dark mode classes', () => {
    useFlowStore.setState({ colorMode: 'dark' });
    const { container } = render(<ReplicaSetNode {...defaultProps} />);
    expect(container.firstChild).toHaveClass('bg-emerald-500/5');
  });

  it('applies selected classes', () => {
    useFlowStore.setState({ colorMode: 'dark' });
    const { container } = render(<ReplicaSetNode {...defaultProps} selected={true} />);
    expect(container.firstChild).toHaveClass('border-emerald-400/60');
  });
});
