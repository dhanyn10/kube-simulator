import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigMapNode } from '@/components/Nodes/ConfigMap';
import '@testing-library/jest-dom';

// Mock @xyflow/react
vi.mock('@xyflow/react', () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

// Mock BaseNode
vi.mock('./BaseNode', () => ({
  BaseNode: ({ children, title }: any) => (
    <div data-testid="base-node">
      <span>{title}</span>
      {children}
    </div>
  ),
}));

describe('ConfigMapNode', () => {
  const defaultProps = {
    id: '1',
    data: {
      label: 'test-cm',
      configData: [
        { key: 'key1', value: 'val1' },
        { key: 'key2', value: 'val2' },
      ],
      displaySettings: { data: true }
    },
    selected: false,
    zIndex: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    dragging: false,
    type: 'configMap',
  } as any;

  it('renders correctly', () => {
    render(<ConfigMapNode {...defaultProps} />);
    expect(screen.getByText('ConfigMap')).toBeInTheDocument();
    expect(screen.getByText('Data (2)')).toBeInTheDocument();
    expect(screen.getByText('key1:')).toBeInTheDocument();
    expect(screen.getByText('val1')).toBeInTheDocument();
  });

  it('shows more label when more than 3 items', () => {
    const props = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        configData: [
          { key: 'k1', value: 'v1' },
          { key: 'k2', value: 'v2' },
          { key: 'k3', value: 'v3' },
          { key: 'k4', value: 'v4' },
        ],
      },
    };
    render(<ConfigMapNode {...props} />);
    expect(screen.getByText('+ 1 more...')).toBeInTheDocument();
  });

  it('hides data if displaySettings.data is false', () => {
    const props = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        displaySettings: { data: false },
      },
    };
    render(<ConfigMapNode {...props} />);
    expect(screen.queryByText('Data (2)')).not.toBeInTheDocument();
  });
});
