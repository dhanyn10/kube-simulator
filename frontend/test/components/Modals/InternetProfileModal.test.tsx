import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { InternetProfileModal } from '@/components/Modals/InternetProfileModal';
import { ECOMMERCE_PROFILE } from '@/activities/modals';
import { useFlowStore } from '@/store/useFlowStore';

// Mock Wails runtime calls
vi.mock('@/lib/wailsRuntime', () => ({
  SaveInternetProfile: vi.fn().mockResolvedValue(true),
  GetInternetProfiles: vi.fn().mockResolvedValue([]),
  DeleteInternetProfile: vi.fn().mockResolvedValue(true)
}));

describe('InternetProfileModal', () => {
  const mockPerformUpdate = vi.fn();
  const mockOnClose = vi.fn();

  const dummyNode = {
    id: 'node-internet-1',
    data: {
      label: 'Internet Connection',
      activeProfileName: ECOMMERCE_PROFILE.name,
      connectionProfile: ECOMMERCE_PROFILE
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when isOpen is true', () => {
    render(
      <InternetProfileModal
        isOpen={true}
        onClose={mockOnClose}
        selectedNode={dummyNode}
        performUpdate={mockPerformUpdate}
      />
    );

    expect(screen.getByText('Internet Connection')).toBeDefined();
    expect(screen.getByText(/24-Hour Connection Simulation Profile Templates/i)).toBeDefined();
  });

  it('displays default Ecommerce profile template card, badge, and active traffic dots during simulation', () => {
    useFlowStore.setState({ isSimulating: true });

    const activeSimNode = {
      ...dummyNode,
      data: {
        ...dummyNode.data,
        currentHourIndex: 5
      }
    };

    render(
      <InternetProfileModal
        isOpen={true}
        onClose={mockOnClose}
        selectedNode={activeSimNode}
        performUpdate={mockPerformUpdate}
      />
    );

    const matches = screen.getAllByText(ECOMMERCE_PROFILE.name);
    expect(matches.length).toBeGreaterThan(0);

    // Verify applied checkmark badge
    const badge = screen.getByTestId(`applied-badge-${ECOMMERCE_PROFILE.name.replaceAll(/\s+/g, '-')}`);
    expect(badge).toBeDefined();

    // Verify mini active traffic dot on active applied card
    const miniDot = screen.getByTestId('mini-active-traffic-dot');
    expect(miniDot).toBeDefined();

    // Test hovering mini curve container
    const miniContainer = document.querySelector('.relative.my-1.cursor-pointer')!;
    fireEvent.mouseEnter(miniContainer);
    fireEvent.mouseMove(miniContainer, { clientX: 50 });

    const miniTooltip = screen.getByTestId('mini-traffic-dot-tooltip');
    expect(miniTooltip).toBeDefined();

    fireEvent.mouseLeave(miniContainer);
    expect(screen.queryByTestId('mini-traffic-dot-tooltip')).toBeNull();
  });

  it('renders custom floating tooltip when hovering chart data points in details view', () => {
    render(
      <InternetProfileModal
        isOpen={true}
        onClose={mockOnClose}
        selectedNode={dummyNode}
        performUpdate={mockPerformUpdate}
      />
    );

    const detailsButtons = screen.getAllByRole('button', { name: /Details/i });
    fireEvent.click(detailsButtons[0]);

    const svgChart = document.querySelector('svg.touch-none')!;
    expect(svgChart).toBeDefined();

    // Hover over SVG chart
    fireEvent.pointerMove(svgChart, { clientX: 100 });
    const tooltip = screen.getByTestId('interactive-chart-tooltip');
    expect(tooltip).toBeDefined();

    fireEvent.pointerLeave(svgChart);
    expect(screen.queryByTestId('interactive-chart-tooltip')).toBeNull();
  });

  it('allows clicking Details to open detailed view', () => {
    render(
      <InternetProfileModal
        isOpen={true}
        onClose={mockOnClose}
        selectedNode={dummyNode}
        performUpdate={mockPerformUpdate}
      />
    );

    const detailsButtons = screen.getAllByRole('button', { name: /Details/i });
    expect(detailsButtons.length).toBeGreaterThan(0);
    fireEvent.click(detailsButtons[0]);

    expect(screen.getByText(/Back to Profiles Gallery/i)).toBeDefined();
  });

  it('allows switching to graphical custom profile creation view', () => {
    render(
      <InternetProfileModal
        isOpen={true}
        onClose={mockOnClose}
        selectedNode={dummyNode}
        performUpdate={mockPerformUpdate}
      />
    );

    const addCustomCard = screen.getByText('Add Custom Profile');
    fireEvent.click(addCustomCard);

    expect(screen.getByText('Randomize Graph')).toBeDefined();
    expect(screen.getByText(/Save & Apply Custom Profile/i)).toBeDefined();
  });
});
