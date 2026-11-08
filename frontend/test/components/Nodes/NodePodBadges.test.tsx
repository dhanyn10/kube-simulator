import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NodePodBadges } from '@/components/Nodes/NodePodBadges';

describe('NodePodBadges', () => {
  it('renders null when hasAnyBadge is false or type is not Pod', () => {
    const data = {
      type: 'Deployment',
      displaySettings: { assignedNode: false },
      runtime: undefined,
      webserver: undefined,
    };
    const { container } = render(<NodePodBadges data={data} nodeId="node-empty" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders node badge, runtime badge, and webserver badge when active', () => {
    const data = {
      type: 'Pod',
      displaySettings: { assignedNode: true },
      assignedNode: 'worker-1',
      runtime: 'nodejs',
      webserver: 'nginx',
    };

    render(<NodePodBadges data={data} nodeId="node-active" />);

    expect(screen.getByText('worker-1')).toBeDefined();
    expect(screen.getByText('nodejs')).toBeDefined();
    expect(screen.getByText('nginx')).toBeDefined();
  });

  it('renders with assigned worker node fallback based on node ID hash', () => {
    const data = {
      type: 'Pod',
      displaySettings: { assignedNode: true },
      runtime: undefined,
      webserver: undefined,
    };

    const { container } = render(<NodePodBadges data={data} nodeId="pod-123" />);
    const badge = container.querySelector('span[title^="Worker Node:"]');
    expect(badge).not.toBeNull();
  });
});
