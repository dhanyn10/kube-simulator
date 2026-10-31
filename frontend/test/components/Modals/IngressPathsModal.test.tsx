import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IngressPathsModal, normalizeIngressPath } from '@/components/Modals/IngressPathsModal';
import { useFlowStore } from '@/store';

describe('IngressPathsModal', () => {
  const onClose = vi.fn();
  const onSave = vi.fn();

  const mockIngressNode = {
    id: 'ing1',
    type: 'Ingress',
    data: {
      label: 'My Ingress',
      ingressHost: 'api.example.com',
      ingressPath: '/api',
      backendServiceName: 'api-service',
      servicePort: 8080,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [
        { id: 'svc1', type: 'Service', data: { label: 'api-service', serviceType: 'ClusterIP', port: 8080 } },
        { id: 'svc2', type: 'Service', data: { label: 'web-service', serviceType: 'ClusterIP', port: 3000 } },
      ],
    });
  });

  it('normalizes ingress path strings to start with /', () => {
    expect(normalizeIngressPath('')).toBe('/');
    expect(normalizeIngressPath('   ')).toBe('/');
    expect(normalizeIngressPath('api/v1')).toBe('/api/v1');
    expect(normalizeIngressPath('/api/v1')).toBe('/api/v1');
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <IngressPathsModal
        isOpen={false}
        onClose={onClose}
        ingressNode={mockIngressNode}
        onSave={onSave}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with default data initialized from ingressNode', () => {
    render(
      <IngressPathsModal
        isOpen={true}
        onClose={onClose}
        ingressNode={mockIngressNode}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Manage Ingress Routing Paths')).toBeDefined();
    expect(screen.getByText(/Configure host and path rules for api.example.com/)).toBeDefined();
    expect(screen.getByDisplayValue('/api')).toBeDefined();
    expect(screen.getByDisplayValue('8080')).toBeDefined();
  });

  it('renders existing ingressPaths when provided in ingressNode', () => {
    const multiPathNode = {
      ...mockIngressNode,
      data: {
        ...mockIngressNode.data,
        ingressPaths: [
          { id: 'p1', path: '/v1', serviceName: 'api-service', servicePort: 8080 },
          { id: 'p2', path: '/v2', serviceName: 'web-service', servicePort: 3000 },
        ],
      },
    };

    render(
      <IngressPathsModal
        isOpen={true}
        onClose={onClose}
        ingressNode={multiPathNode}
        onSave={onSave}
      />
    );

    expect(screen.getByDisplayValue('/v1')).toBeDefined();
    expect(screen.getByDisplayValue('/v2')).toBeDefined();
    expect(screen.getByDisplayValue('3000')).toBeDefined();
  });

  it('adds, updates, toggles pathType, auto-syncs service port on target service change, deletes, and saves path rules', () => {
    render(
      <IngressPathsModal
        isOpen={true}
        onClose={onClose}
        ingressNode={mockIngressNode}
        onSave={onSave}
      />
    );

    // 1. Add new path (defaults to first available service api-service with port 8080)
    const addBtn = screen.getByRole('button', { name: /Add Path/i });
    fireEvent.click(addBtn);

    // Should now have 2 rows
    expect(screen.getByDisplayValue('/path-2')).toBeDefined();

    // 2. Update path #2 without leading slash and trigger blur -> auto-normalizes to /payment
    const path2Input = screen.getByDisplayValue('/path-2');
    fireEvent.change(path2Input, { target: { value: 'payment' } });
    fireEvent.blur(path2Input);
    expect(screen.getByDisplayValue('/payment')).toBeDefined();

    // 2b. Toggle pathType on row #2 from Prefix to Exact
    const pathTypeBtn2 = screen.getByRole('button', { name: /Path type Prefix for path 2/i });
    fireEvent.click(pathTypeBtn2);
    expect(screen.getByRole('button', { name: /Path type Exact for path 2/i })).toBeDefined();

    // 3. Update target service dropdown on row #2 -> auto-updates port to web-service's port (3000)
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
    fireEvent.change(selects[1], { target: { value: 'web-service' } });
    expect(screen.getByDisplayValue('3000')).toBeDefined();

    // 4. Update port on row #2 manually
    const portInput3000 = screen.getByDisplayValue('3000');
    fireEvent.change(portInput3000, { target: { value: '9000' } });
    expect(screen.getByDisplayValue('9000')).toBeDefined();

    // 5. Delete row #1
    const deleteButtons = screen.getAllByRole('button', { name: /Delete path/i });
    expect(deleteButtons).toHaveLength(2);
    fireEvent.click(deleteButtons[0]);

    // Row #1 deleted, only /payment remains
    expect(screen.queryByDisplayValue('/api')).toBeNull();
    expect(screen.getByDisplayValue('/payment')).toBeDefined();

    // 6. Save
    const saveBtn = screen.getByRole('button', { name: /Save Paths/i });
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/payment',
          pathType: 'Exact',
          serviceName: 'web-service',
          servicePort: 9000,
        }),
      ])
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('detects duplicate paths, displays warning, and disables Save button', () => {
    render(
      <IngressPathsModal
        isOpen={true}
        onClose={onClose}
        ingressNode={mockIngressNode}
        onSave={onSave}
      />
    );

    const addBtn = screen.getByRole('button', { name: /Add Path/i });
    fireEvent.click(addBtn);

    const path2Input = screen.getByDisplayValue('/path-2');
    fireEvent.change(path2Input, { target: { value: '/api' } });

    expect(screen.getByText(/Duplicate path detected/i)).toBeDefined();
    const saveBtn = screen.getByRole('button', { name: /Save Paths/i });
    expect(saveBtn).toBeDisabled();
  });

  it('handles Cancel button click', () => {
    render(
      <IngressPathsModal
        isOpen={true}
        onClose={onClose}
        ingressNode={mockIngressNode}
        onSave={onSave}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
