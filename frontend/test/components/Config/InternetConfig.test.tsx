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
    const numInput = screen.getByTestId('traffic-numeric-input') as HTMLInputElement;
    expect(numInput.value).toBe('5000');
    expect(screen.getByText('visits')).toBeDefined();
    expect(screen.getByText('Data Duration')).toBeDefined();
  });

  it('handles traffic updates and slider min 1 and ruler ticks', () => {
    const defaultNode = {
      id: 'int1',
      type: 'Internet',
      data: {
        label: 'Internet',
        traffic: 100,
        durationUnit: 'second',
        displaySettings: { traffic: true, duration: true }
      }
    };

    const { rerender } = render(
      <InternetConfig
        selectedNode={defaultNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    fireEvent.click(screen.getByText('Advanced Options'));
    let range = screen.getByRole('slider') as HTMLInputElement;
    expect(range.min).toBe('1');
    expect(range.max).toBe('1000');
    expect(screen.getByText('250')).toBeDefined();
    expect(screen.getByText('500')).toBeDefined();
    expect(screen.getByText('750')).toBeDefined();

    // Rerender with higher traffic (2500 -> maxRange becomes 4000)
    rerender(
      <InternetConfig
        selectedNode={{ ...defaultNode, data: { ...defaultNode.data, traffic: 2500 } }}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );
    range = screen.getByRole('slider') as HTMLInputElement;
    expect(range.max).toBe('4000');

    // Rerender with lower traffic (300 -> maxRange shrinks back to 1000)
    rerender(
      <InternetConfig
        selectedNode={{ ...defaultNode, data: { ...defaultNode.data, traffic: 300 } }}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );
    range = screen.getByRole('slider') as HTMLInputElement;
    expect(range.max).toBe('1000');

    fireEvent.change(range, { target: { value: '500' } });
    expect(performUpdate).toHaveBeenCalledWith({ traffic: 500 });
  });

  it('handles clicking ruler tick buttons and editing numeric input', () => {
    const defaultNode = {
      id: 'int1',
      type: 'Internet',
      data: {
        label: 'Internet',
        traffic: 100,
        durationUnit: 'second',
        displaySettings: { traffic: true, duration: true }
      }
    };

    render(
      <InternetConfig
        selectedNode={defaultNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    fireEvent.click(screen.getByText('Advanced Options'));

    // Click ruler tick 250
    const tick250 = screen.getByTestId('ruler-tick-250');
    fireEvent.click(tick250);
    expect(performUpdate).toHaveBeenCalledWith({ traffic: 250 });

    // Type value directly in numeric input
    const numInput = screen.getByTestId('traffic-numeric-input');
    fireEvent.change(numInput, { target: { value: '350' } });
    expect(performUpdate).toHaveBeenCalledWith({ traffic: 350 });
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

  it('handles large traffic values formatting and visibility toggles', () => {
    const largeNode = {
      id: 'int1',
      type: 'Internet',
      data: {
        label: 'Internet',
        traffic: 2000000,
        durationUnit: 'second',
        displaySettings: { traffic: true, duration: true }
      }
    };

    render(
      <InternetConfig
        selectedNode={largeNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    fireEvent.click(screen.getByText('Advanced Options'));
    expect(screen.getByTestId('ruler-tick-2048000')).toBeDefined();

    const numInput = screen.getByTestId('traffic-numeric-input');
    fireEvent.change(numInput, { target: { value: '1' } });
    expect(performUpdate).toHaveBeenCalledWith({ traffic: 1 });

    const eyeButtons = screen.getAllByTitle('Show/Hide on Card');
    fireEvent.click(eyeButtons[0]);
    expect(toggleVisibility).toHaveBeenCalledWith('traffic');

    fireEvent.click(eyeButtons[1]);
    expect(toggleVisibility).toHaveBeenCalledWith('duration');
  });
});
