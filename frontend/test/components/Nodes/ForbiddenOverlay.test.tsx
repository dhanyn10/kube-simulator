import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('renders Option B restricted ghost overlay with lock badge and accessibility role', () => {
    useFlowStore.setState({ activeIdentity: 'dev-user' });
    render(<ForbiddenOverlay nodeType="Service" data={{ label: 'my-service' } as any} />);

    const overlay = screen.getByTestId('forbidden-overlay');
    expect(overlay).toBeDefined();
    expect(overlay.getAttribute('role')).toBe('region');
    expect(overlay.getAttribute('aria-label')).toBe('Access Restricted for user dev-user');
    expect(screen.getByText('Restricted')).toBeDefined();
  });

  it('intercepts click and keyboard events to prevent propagating interactions', () => {
    useFlowStore.setState({ activeIdentity: 'dev-user' });
    render(<ForbiddenOverlay nodeType="Service" data={{ label: 'my-service' } as any} />);

    const overlay = screen.getByTestId('forbidden-overlay');

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');
    const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');

    fireEvent(overlay, clickEvent);

    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('renders nothing when node type is allowed for activeIdentity', () => {
    useFlowStore.setState({ activeIdentity: 'dev-user' });
    render(<ForbiddenOverlay nodeType="Pod" data={{ label: 'my-pod' } as any} />);

    expect(screen.queryByTestId('forbidden-overlay')).toBeNull();
  });
});
