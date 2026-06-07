import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResourceBudget } from '../../../src/components/Monitoring/ResourceBudget';
import { useFlowStore } from '../../../src/store';

describe('ResourceBudget', () => {
  it('renders correctly with resource limits', () => {
    useFlowStore.setState({
      systemResources: {
        cpuCores: 4,
        totalMemoryGB: 16,
        freeMemoryGB: 8,
        cpuUsage: 25
      },
      nodes: [
        { id: '1', type: 'Deployment', data: { cpuRequest: '1000m', cpuLimit: '2000m', memoryRequest: '1Gi', memoryLimit: '2Gi', replicas: 1 } },
        { id: '2', type: 'Pod', data: { cpuRequest: '500m', cpuLimit: '500m', memoryRequest: '512Mi', memoryLimit: '512Mi' } }
      ]
    });

    render(<ResourceBudget />);

    // Total CPU percent: OS (25%) + K8s Req (1500m/4000m = 37.5%) = 62.5% -> 63%
    expect(screen.getByText('63%')).toBeDefined();

    // CPU Req: 1000m + 500m = 1500m = 1.5 Cores
    expect(screen.getByText(/K8s Req: 1.5 Core/)).toBeDefined();

    // Memory Free: 8.0GB
    expect(screen.getByText('8.0GB')).toBeDefined();

    // Memory K8s Req: 1Gi + 512Mi = 1.5 Gi
    expect(screen.getByText(/K8s Req: 1.5 Gi/)).toBeDefined();
  });

  it('renders null when systemResources is missing', () => {
    useFlowStore.setState({
      systemResources: null,
      nodes: []
    });

    const { container } = render(<ResourceBudget />);
    expect(container.firstChild).toBeNull();
  });

  it('shows overload warning when usage is high', () => {
    useFlowStore.setState({
      systemResources: {
        cpuCores: 1,
        totalMemoryGB: 1,
        freeMemoryGB: 0.1,
        cpuUsage: 96
      },
      nodes: []
    });

    render(<ResourceBudget />);
    expect(screen.getByText('System Overload!')).toBeDefined();
    expect(screen.getByText(/CRITICAL: Potential usage exceeds host capacity!/)).toBeDefined();
  });
});
