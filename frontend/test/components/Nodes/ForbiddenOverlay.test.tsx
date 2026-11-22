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

  it('renders Option B restricted ghost overlay with section tag and aria-label', () => {
    useFlowStore.setState({ activeIdentity: 'dev-user' });
    render(<ForbiddenOverlay nodeType="Service" data={{ label: 'my-service' } as any} />);

    const overlay = screen.getByTestId('forbidden-overlay');
    expect(overlay).toBeDefined();
    expect(overlay.className).toContain('node-forbidden-overlay');
    expect(overlay.tagName.toLowerCase()).toBe('section');
    expect(overlay.getAttribute('aria-label')).toBe('Access Restricted for user dev-user');
    expect(overlay.getAttribute('tabIndex')).toBeNull();
    expect(screen.getByText('Restricted')).toBeDefined();
  });

  it('renders nothing when node type is allowed for activeIdentity', () => {
    useFlowStore.setState({ activeIdentity: 'dev-user' });
    render(<ForbiddenOverlay nodeType="Pod" data={{ label: 'my-pod' } as any} />);

    expect(screen.queryByTestId('forbidden-overlay')).toBeNull();
  });

  it('applies light mode styling when colorMode is light', () => {
    useFlowStore.setState({ activeIdentity: 'dev-user', colorMode: 'light' });
    render(<ForbiddenOverlay nodeType="Service" data={{ label: 'my-service' } as any} />);

    const badge = screen.getByText('Restricted').parentElement;
    expect(badge).toBeDefined();
    expect(badge?.className).toContain('bg-white/95 text-slate-700 border-slate-300');
  });
});
