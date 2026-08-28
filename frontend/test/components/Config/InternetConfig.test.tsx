import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InternetConfig } from '../../../src/components/Config/InternetConfig';
import { useFlowStore } from '../../../src/store';

describe('InternetConfig', () => {
  const performUpdate = vi.fn();
  const toggleVisibility = vi.fn();

  const selectedNode = {
    id: 'int1',
    type: 'Internet',
    data: {
      label: 'Internet',
      traffic: 5000,
      durationUnit: 'minute',
      displaySettings: { traffic: true, duration: true }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('renders correctly after opening advanced section', () => {
    render(
      <InternetConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    fireEvent.click(screen.getByText('Advanced Options'));
    expect(screen.getByText('Data Traffic')).toBeDefined();
    // The component uses toLocaleString(), so it might be 5,000 or 5.000 depending on locale
    // Use regex to be safe
    expect(screen.getByText(/5[.,]000/)).toBeDefined();
    expect(screen.getByText('visits')).toBeDefined();
    expect(screen.getByText('Data Duration')).toBeDefined();
  });

  it('handles traffic updates', () => {
    render(
      <InternetConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    fireEvent.click(screen.getByText('Advanced Options'));
    const range = screen.getByRole('slider');
    fireEvent.change(range, { target: { value: '10000' } });
    expect(performUpdate).toHaveBeenCalledWith({ traffic: 10000 });
  });

  it('handles duration unit updates for ms, sec, and min', () => {
    render(
      <InternetConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    fireEvent.click(screen.getByText('Advanced Options'));

    fireEvent.click(screen.getByText('ms'));
    expect(performUpdate).toHaveBeenCalledWith({ durationUnit: 'millisecond' });

    fireEvent.click(screen.getByText('sec'));
    expect(performUpdate).toHaveBeenCalledWith({ durationUnit: 'second' });

    fireEvent.click(screen.getByText('min'));
    expect(performUpdate).toHaveBeenCalledWith({ durationUnit: 'minute' });
  });
});
