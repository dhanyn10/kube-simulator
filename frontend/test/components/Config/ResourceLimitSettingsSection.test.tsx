import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ResourceLimitSettingsSection } from '@/components/Config/ResourceLimitSettingsSection';
import { useFlowStore } from '@/store';
import { K8sNodeData } from '@/types';

describe('ResourceLimitSettingsSection', () => {
  const sampleData: K8sNodeData = {
    label: 'App Deployment',
    type: 'Deployment',
    resourceLimits: [
      {
        id: 'res-1',
        name: 'app-limit',
        limitCpu: '500m',
        limitMemory: '512Mi',
        requestCpu: '250m',
        requestMemory: '256Mi',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      updateNodeData: vi.fn(),
      addLog: vi.fn(),
    });
  });

  it('returns null when resourceLimits array is empty', () => {
    const { container } = render(
      <ResourceLimitSettingsSection data={{ label: 'Dep', type: 'Deployment', resourceLimits: [] }} nodeId="node-1" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders hero button badge when resourceLimits exist', () => {
    render(<ResourceLimitSettingsSection data={sampleData} nodeId="node-1" />);

    const heroBtn = screen.getByTitle('Attached Resource Limits (1)');
    expect(heroBtn).toBeInTheDocument();
  });

  it('opens list modal and edit modal, invoking renderListModal and renderEditModal callbacks', () => {
    render(<ResourceLimitSettingsSection data={sampleData} nodeId="node-1" />);

    const heroBtn = screen.getByTitle('Attached Resource Limits (1)');
    fireEvent.click(heroBtn);

    // Verify List Modal rendered via renderListModal
    expect(screen.getByRole('heading', { name: /Attached Resource Limits/i })).toBeInTheDocument();
    expect(screen.getByText('app-limit')).toBeInTheDocument();

    // Click Delete button on item row in List Modal to execute onDeleteItem
    const deleteBtn = screen.getByTitle('Delete ResourceLimit');
    fireEvent.click(deleteBtn);

    // Click Edit button on item row to trigger onEditItem and renderEditModal
    const editBtn = screen.getByTitle('Edit ResourceLimit');
    fireEvent.click(editBtn);

    // Verify Edit Modal rendered via renderEditModal
    expect(screen.getByRole('heading', { name: /Edit Resource Limit/i })).toBeInTheDocument();
  });
});
