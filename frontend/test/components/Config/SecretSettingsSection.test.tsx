import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SecretSettingsSection } from '@/components/Config/SecretSettingsSection';
import { useFlowStore } from '@/store';
import { K8sNodeData } from '@/types';

describe('SecretSettingsSection', () => {
  const sampleData: K8sNodeData = {
    label: 'App Pod',
    type: 'Pod',
    secrets: [
      {
        id: 'sec-1',
        name: 'app-secret',
        type: 'Opaque',
        secretData: [{ key: 'KEY', value: 'VAL' }],
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

  it('returns null when secrets array is empty', () => {
    const { container } = render(
      <SecretSettingsSection data={{ label: 'Pod', type: 'Pod', secrets: [] }} nodeId="node-1" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders hero button badge when secrets exist', () => {
    render(<SecretSettingsSection data={sampleData} nodeId="node-1" />);

    const heroBtn = screen.getByTitle('Attached Secrets (1)');
    expect(heroBtn).toBeInTheDocument();
  });

  it('opens list modal when hero button is clicked', () => {
    render(<SecretSettingsSection data={sampleData} nodeId="node-1" />);

    const heroBtn = screen.getByTitle('Attached Secrets (1)');
    fireEvent.click(heroBtn);

    expect(screen.getByRole('heading', { name: 'Attached Secrets' })).toBeInTheDocument();
    expect(screen.getByText('app-secret')).toBeInTheDocument();
  });
});
