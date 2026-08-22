import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalLogBody } from '../../../src/components/Layout/TerminalPanel';
import '@testing-library/jest-dom';

describe('TerminalLogBody', () => {
  it('renders idle state when not simulating, activity tab, and no logs', () => {
    const startSimulation = vi.fn();
    render(
      <TerminalLogBody
        isSimulating={false}
        terminalActiveTab="activity"
        activeLogs={[]}
        loggableResources={[]}
        paginatedLogs={[]}
        searchQuery=""
        colorMode="dark"
        startSimulation={startSimulation}
        currentPage={1}
        pageSize={25}
      />
    );

    expect(screen.getByText('Terminal Idle')).toBeInTheDocument();
    const applyBtn = screen.getByRole('button', { name: /Apply Manifests/i });
    expect(applyBtn).toBeInTheDocument();

    fireEvent.click(applyBtn);
    expect(startSimulation).toHaveBeenCalledTimes(1);
  });

  it('renders empty loggable resources state when in logs tab with no loggable resources', () => {
    render(
      <TerminalLogBody
        isSimulating={true}
        terminalActiveTab="logs"
        activeLogs={[]}
        loggableResources={[]}
        paginatedLogs={[]}
        searchQuery=""
        colorMode="dark"
        startSimulation={vi.fn()}
        currentPage={1}
        pageSize={25}
      />
    );

    expect(screen.getByText('No Loggable Resources')).toBeInTheDocument();
    expect(screen.getByText(/Add a Pod, Deployment, or ReplicaSet/i)).toBeInTheDocument();
  });

  it('renders "No matches found" when searchQuery produces no results', () => {
    const mockResource = [{ id: 'pod-1', type: 'Pod' }] as any;
    render(
      <TerminalLogBody
        isSimulating={true}
        terminalActiveTab="logs"
        activeLogs={['log entry 1']}
        loggableResources={mockResource}
        paginatedLogs={[]}
        searchQuery="nonexistent"
        colorMode="dark"
        startSimulation={vi.fn()}
        currentPage={1}
        pageSize={25}
      />
    );

    expect(screen.getByText('No matches found')).toBeInTheDocument();
  });

  it('renders "Waiting for log stream..." when logs array is empty without search query', () => {
    const mockResource = [{ id: 'pod-1', type: 'Pod' }] as any;
    render(
      <TerminalLogBody
        isSimulating={true}
        terminalActiveTab="logs"
        activeLogs={[]}
        loggableResources={mockResource}
        paginatedLogs={[]}
        searchQuery=""
        colorMode="dark"
        startSimulation={vi.fn()}
        currentPage={1}
        pageSize={25}
      />
    );

    expect(screen.getByText('Waiting for log stream...')).toBeInTheDocument();
  });

  it('renders paginated logs lines with correct line indices', () => {
    render(
      <TerminalLogBody
        isSimulating={true}
        terminalActiveTab="activity"
        activeLogs={['$ kubectl get pods', 'web-pod Running']}
        loggableResources={[]}
        paginatedLogs={['$ kubectl get pods', 'web-pod Running']}
        searchQuery=""
        colorMode="dark"
        startSimulation={vi.fn()}
        currentPage={1}
        pageSize={25}
      />
    );

    expect(screen.getByText('$ kubectl get pods')).toBeInTheDocument();
    expect(screen.getByText('web-pod Running')).toBeInTheDocument();
  });
});
