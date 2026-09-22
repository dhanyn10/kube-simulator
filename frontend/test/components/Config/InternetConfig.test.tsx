import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InternetConfig } from '@/components/Config/InternetConfig';
import { useFlowStore } from '@/store';

describe('InternetConfig', () => {
  const performUpdate = vi.fn();
  const toggleVisibility = vi.fn();

  const selectedNode = {
    id: 'int1',
    type: 'Internet',
    data: {
      label: 'Internet',
      traffic: 5000,
      displaySettings: { traffic: true }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark', isSimulating: false, nodes: [], edges: [] });
  });

  it('renders permanently open sections without Advanced Options toggle', () => {
    render(
      <InternetConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    expect(screen.queryByText('Advanced Options')).toBeNull();
    expect(screen.getByText('Explore More')).toBeDefined();
    expect(screen.getByText('Data Traffic')).toBeDefined();
    const numInput = screen.getByTestId('traffic-numeric-input') as HTMLInputElement;
    expect(numInput.value).toBe('5000');
    expect(screen.getByText('visits')).toBeDefined();
    expect(screen.queryByText('Data Duration')).toBeNull();
  });

  it('opens and closes Explore More modal when buttons are clicked', async () => {
    render(
      <InternetConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Explore More'));
    });
    expect(screen.getByText('24-Hour Connection Simulation Profile Templates (00:00 - 23:00)')).toBeDefined();

    // Close modal via close button
    const closeButtons = screen.getAllByRole('button');
    // find close button (X icon or backdrop)
    const closeBtn = closeButtons.find((btn) => btn.querySelector('svg.lucide-x'));
    if (closeBtn) {
      await act(async () => {
        fireEvent.click(closeBtn);
      });
      expect(screen.queryByText('24-Hour Connection Simulation Profile Templates (00:00 - 23:00)')).toBeNull();
    }
  });

  it('handles traffic updates and slider min 1 and ruler ticks', () => {
    const defaultNode = {
      id: 'int1',
      type: 'Internet',
      data: {
        label: 'Internet',
        traffic: 100,
        displaySettings: { traffic: true }
      }
    };

    const { rerender } = render(
      <InternetConfig
        selectedNode={defaultNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

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

  it('handles clicking ruler tick buttons and editing numeric input with invalid or empty input fallback', () => {
    const defaultNode = {
      id: 'int1',
      type: 'Internet',
      data: {
        label: 'Internet',
        traffic: 100,
        displaySettings: { traffic: true }
      }
    };

    render(
      <InternetConfig
        selectedNode={defaultNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    // Click ruler tick 250
    const tick250 = screen.getByTestId('ruler-tick-250');
    fireEvent.click(tick250);
    expect(performUpdate).toHaveBeenCalledWith({ traffic: 250 });

    // Type value directly in numeric input
    const numInput = screen.getByTestId('traffic-numeric-input');
    fireEvent.change(numInput, { target: { value: '350' } });
    expect(performUpdate).toHaveBeenCalledWith({ traffic: 350 });

    // Empty input fallback
    fireEvent.change(numInput, { target: { value: '' } });
    expect(performUpdate).toHaveBeenCalledWith({ traffic: 1 });
  });

  it('displays ReadOnlyProfileChart with active traffic dot when connection profile is active during simulation and handles mouse hover', async () => {
    useFlowStore.setState({ isSimulating: true });

    const activeProfileNode = {
      id: 'int1',
      type: 'Internet',
      data: {
        label: 'Internet',
        traffic: 1000,
        currentHourIndex: 3,
        displaySettings: { traffic: true },
        connectionProfile: {
          name: 'Custom Profile',
          hourly: { '00:00': 1500, '03:00': 2000, '12:00': 3000 }
        }
      }
    };

    const { container } = render(
      <InternetConfig
        selectedNode={activeProfileNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    expect(screen.getByTestId('profile-chart-preview')).toBeDefined();
    expect(screen.getByText('Custom Profile')).toBeDefined();
    expect(screen.getByTestId('active-traffic-dot')).toBeDefined();
    expect(screen.getByText('03:00')).toBeDefined();
    expect(screen.queryByTestId('traffic-numeric-input')).toBeNull();

    const chartSvg = container.querySelector('svg[viewBox="0 0 240 80"]')!;
    vi.spyOn(chartSvg, 'getBoundingClientRect').mockReturnValue({
      width: 240,
      height: 80,
      top: 0,
      left: 0,
      bottom: 80,
      right: 240,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    // Hover at x matching hour 3 (same as safeHourIdx = 3) -> clientX = 37
    await act(async () => {
      fireEvent.mouseMove(chartSvg, { clientX: 37, clientY: 10 });
    });
    expect(screen.getByTestId('hover-traffic-dot')).toBeDefined();

    // Hover at different hour (e.g. hour 12) -> clientX = 124
    await act(async () => {
      fireEvent.mouseMove(chartSvg, { clientX: 124, clientY: 10 });
    });
    expect(screen.getByTestId('hover-traffic-dot')).toBeDefined();

    // Mouse leave
    await act(async () => {
      fireEvent.mouseLeave(chartSvg);
    });
    expect(screen.queryByTestId('hover-traffic-dot')).toBeNull();
  });

  it('handles ReadOnlyProfileChart when isRed is true (error/disconnected status) and fallback daily traffic profile data', async () => {
    useFlowStore.setState({
      isSimulating: false,
      nodes: [{ id: 'int1', type: 'Internet', data: {} }],
      edges: [] // No outgoing edges -> isRed = true
    });

    const activeProfileDailyNode = {
      id: 'int1',
      type: 'Internet',
      data: {
        label: 'Internet',
        // currentHourIndex is undefined -> safeHourIdx fallback to 0
        displaySettings: { traffic: true },
        connectionProfile: {
          name: 'Daily Profile',
          // profile without hourly, using daily fallback
          daily: { '00:00': 500, '01:00': 1000 }
        }
      }
    };

    const { container } = render(
      <InternetConfig
        selectedNode={activeProfileDailyNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    expect(screen.getByText('Daily Profile')).toBeDefined();

    const chartSvg = container.querySelector('svg[viewBox="0 0 240 80"]')!;
    vi.spyOn(chartSvg, 'getBoundingClientRect').mockReturnValue({
      width: 240,
      height: 80,
      top: 0,
      left: 0,
      bottom: 80,
      right: 240,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    // Hover at safeHourIdx (0) with isRed = true (clientX: 8)
    await act(async () => {
      fireEvent.mouseMove(chartSvg, { clientX: 8, clientY: 10 });
    });
    expect(screen.getByTestId('hover-traffic-dot')).toBeDefined();

    // Hover at non-safeHourIdx with isRed = true (clientX: 200)
    await act(async () => {
      fireEvent.mouseMove(chartSvg, { clientX: 200, clientY: 10 });
    });
    expect(screen.getByTestId('hover-traffic-dot')).toBeDefined();
  });

  it('handles profile with completely empty hourly and daily values', () => {
    const emptyProfileNode = {
      id: 'int1',
      type: 'Internet',
      data: {
        label: 'Internet',
        connectionProfile: {
          name: 'Empty Profile'
          // no hourly, no daily
        }
      }
    };

    render(
      <InternetConfig
        selectedNode={emptyProfileNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    expect(screen.getByText('Empty Profile')).toBeDefined();
  });

  it('handles large traffic values formatting and visibility toggles', () => {
    const largeNode = {
      id: 'int1',
      type: 'Internet',
      data: {
        label: 'Internet',
        traffic: 2000000,
        displaySettings: { traffic: true }
      }
    };

    const { rerender } = render(
      <InternetConfig
        selectedNode={largeNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    expect(screen.getByTestId('ruler-tick-2048000')).toBeDefined();

    const numInput = screen.getByTestId('traffic-numeric-input');
    fireEvent.change(numInput, { target: { value: '1' } });
    expect(performUpdate).toHaveBeenCalledWith({ traffic: 1 });

    const eyeButtons = screen.getAllByTitle('Show/Hide on Card');
    fireEvent.click(eyeButtons[0]);
    expect(toggleVisibility).toHaveBeenCalledWith('traffic');

    // Test decimal M (e.g. 1.5M) and decimal k (e.g. 2.5k) formatting
    rerender(
      <InternetConfig
        selectedNode={{ ...largeNode, data: { ...largeNode.data, traffic: 1500000 } }}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    rerender(
      <InternetConfig
        selectedNode={{ ...largeNode, data: { ...largeNode.data, traffic: 2500 } }}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );

    // Test maxRange > 10000 for slider step 50
    rerender(
      <InternetConfig
        selectedNode={{ ...largeNode, data: { ...largeNode.data, traffic: 50000 } }}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
      />
    );
  });
});
