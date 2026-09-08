import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { IdentityPassportModal } from '../../../src/components/Modals/IdentityPassportModal';
import { useFlowStore } from '../../../src/store/useFlowStore';
import '@testing-library/jest-dom';

describe('IdentityPassportModal', () => {
  beforeEach(() => {
    useFlowStore.setState({
      isIdentityModalOpen: false,
      activeIdentity: 'system:admin',
      colorMode: 'dark',
      iamUsers: [
        {
          id: 'u-1',
          username: 'budi',
          accessType: 'Managed Access',
          policies: [{ name: 'ContainerDeveloperPolicy', type: 'Default', description: 'Container dev' }],
          createdAt: Date.now(),
        },
      ],
      nodes: [
        {
          id: 'node-1',
          type: 'Pod',
          data: {
            label: 'web-pod',
            roles: [
              {
                id: 'role-1',
                name: 'pod-reader',
                assignedUsers: ['budi'],
                rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }],
              },
            ],
          },
          position: { x: 0, y: 0 },
        },
      ],
    });
  });

  it('renders null when isIdentityModalOpen is false', () => {
    const { container } = render(<IdentityPassportModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal content when open', () => {
    act(() => {
      useFlowStore.setState({ isIdentityModalOpen: true });
    });

    render(<IdentityPassportModal />);

    expect(screen.getByText('Digital Identity Passport & Certificate')).toBeInTheDocument();
    expect(screen.getAllByText('system:admin')[0]).toBeInTheDocument();
    expect(screen.getByText('CN=kubernetes-admin, O=system:masters')).toBeInTheDocument();
  });

  it('allows switching active identity context', () => {
    act(() => {
      useFlowStore.setState({ isIdentityModalOpen: true });
    });

    render(<IdentityPassportModal />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'budi' } });

    expect(useFlowStore.getState().activeIdentity).toBe('budi');
    expect(screen.getByText('CN=budi, O=kube-sim-developers')).toBeInTheDocument();
    expect(screen.getByText('pod-reader')).toBeInTheDocument();
  });
});
