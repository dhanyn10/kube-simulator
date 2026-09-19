import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ForbiddenOverlay } from '@/components/Nodes/ForbiddenOverlay';
import { useFlowStore } from '@/store';
import { KubeIAMUser } from '@/types';

describe('ForbiddenOverlay', () => {
  const devUser: KubeIAMUser = {
    id: '1',
    username: 'dev-user',
    policies: [{ name: 'ContainerDeveloperPolicy', description: 'Dev Policy' }],
    roles: [],
  };

  beforeEach(() => {
    useFlowStore.setState({
      activeIdentity: 'system:admin',
      iamUsers: [devUser],
    });
  });

  it('renders nothing when user is system:admin', () => {
    render(<ForbiddenOverlay nodeType="Service" data={{ label: 'my-service' } as any} />);
    expect(screen.queryByTestId('forbidden-overlay')).toBeNull();
  });

  it('renders forbidden overlay when user lacks access', () => {
    useFlowStore.setState({ activeIdentity: 'dev-user' });
    render(<ForbiddenOverlay nodeType="Service" data={{ label: 'my-service' } as any} />);

    expect(screen.getByTestId('forbidden-overlay')).toBeDefined();
    expect(screen.getByText('Restricted')).toBeDefined();
  });

  it('renders nothing when node type is allowed for activeIdentity', () => {
    useFlowStore.setState({ activeIdentity: 'dev-user' });
    render(<ForbiddenOverlay nodeType="Pod" data={{ label: 'my-pod' } as any} />);

    expect(screen.queryByTestId('forbidden-overlay')).toBeNull();
  });
});
