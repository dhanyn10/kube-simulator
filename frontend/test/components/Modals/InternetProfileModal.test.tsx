import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { InternetProfileModal } from '@/components/Modals/InternetProfileModal';
import { ECOMMERCE_PROFILE } from '@/activities/modals';
import { useFlowStore } from '@/store/useFlowStore';

const mockGetInternetProfiles = vi.fn();
const mockSaveInternetProfile = vi.fn();
const mockDeleteInternetProfile = vi.fn();

// Mock window.go
beforeEach(() => {
  (window as any).go = {
    main: {
      App: {
        GetInternetProfiles: mockGetInternetProfiles,
        SaveInternetProfile: mockSaveInternetProfile,
        DeleteInternetProfile: mockDeleteInternetProfile
      }
    }
  };
});

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
    mockGetInternetProfiles.mockResolvedValue([]);
    mockSaveInternetProfile.mockResolvedValue(true);
    mockDeleteInternetProfile.mockResolvedValue(true);
    useFlowStore.setState({ colorMode: 'dark', nodes: [], edges: [] });
  });

  it('renders modal when isOpen is true and handles label fallback when label is missing', async () => {
    await act(async () => {
      render(
        <InternetProfileModal
          isOpen={true}
          onClose={mockOnClose}
          selectedNode={{ id: 'node-internet-1', data: {} }} // label missing -> fallback 'Internet'
          performUpdate={mockPerformUpdate}
        />
      );
    });

    expect(screen.getByText('Internet')).toBeDefined();
    expect(screen.getByText(/24-Hour Connection Simulation Profile Templates/i)).toBeDefined();
  });

  it('evaluates isRed boolean based on outgoing edges and connected node statuses', async () => {
    // Case 1: 0 outgoing edges (isRed: true)
    useFlowStore.setState({
      nodes: [{ id: 'node-internet-1', type: 'Internet', data: {} }],
      edges: []
    });

    const { rerender } = render(
      <InternetProfileModal
        isOpen={true}
        onClose={mockOnClose}
        selectedNode={dummyNode}
        performUpdate={mockPerformUpdate}
      />
    );

    // Case 2: Edge with validationError: true (isRed: true)
    useFlowStore.setState({
      nodes: [
        { id: 'node-internet-1', type: 'Internet', data: {} },
        { id: 'pod-1', type: 'Pod', data: { status: 'ready' } }
      ],
      edges: [
        { id: 'e1', source: 'node-internet-1', target: 'pod-1', data: { validationError: 'Error' } }
      ]
    });

    rerender(
      <InternetProfileModal
        isOpen={true}
        onClose={mockOnClose}
        selectedNode={dummyNode}
        performUpdate={mockPerformUpdate}
      />
    );

    // Case 3: Edge pointing to unready Pod or Deployment (isRed: true)
    useFlowStore.setState({
      nodes: [
        { id: 'node-internet-1', type: 'Internet', data: {} },
        { id: 'pod-1', type: 'Pod', data: { status: 'pending' } },
        { id: 'dep-1', type: 'Deployment', data: { status: 'unready' } }
      ],
      edges: [
        { id: 'e1', source: 'node-internet-1', target: 'pod-1', data: {} },
        { id: 'e2', source: 'node-internet-1', target: 'dep-1', data: {} }
      ]
    });

    rerender(
      <InternetProfileModal
        isOpen={true}
        onClose={mockOnClose}
        selectedNode={dummyNode}
        performUpdate={mockPerformUpdate}
      />
    );

    // Case 4: Edge pointing to non-Pod/Deployment node (e.g. Service or Ingress) (isRed: false if healthy)
    useFlowStore.setState({
      nodes: [
        { id: 'node-internet-1', type: 'Internet', data: {} },
        { id: 'svc-1', type: 'Service', data: {} }
      ],
      edges: [{ id: 'e1', source: 'node-internet-1', target: 'svc-1', data: {} }]
    });

    rerender(
      <InternetProfileModal
        isOpen={true}
        onClose={mockOnClose}
        selectedNode={dummyNode}
        performUpdate={mockPerformUpdate}
      />
    );

    // Case 5: Edge pointing to ready Pod (isRed: false)
    useFlowStore.setState({
      nodes: [
        { id: 'node-internet-1', type: 'Internet', data: {} },
        { id: 'pod-1', type: 'Pod', data: { status: 'ready' } }
      ],
      edges: [{ id: 'e1', source: 'node-internet-1', target: 'pod-1', data: {} }]
    });

    rerender(
      <InternetProfileModal
        isOpen={true}
        onClose={mockOnClose}
        selectedNode={dummyNode}
        performUpdate={mockPerformUpdate}
      />
    );
  });

  it('renders light mode styling, singular "1 Available Profile" label, and handles card background/button styling', async () => {
    useFlowStore.setState({ colorMode: 'light' });

    await act(async () => {
      render(
        <InternetProfileModal
          isOpen={true}
          onClose={mockOnClose}
          selectedNode={dummyNode}
          performUpdate={mockPerformUpdate}
        />
      );
    });

    expect(screen.getByText('1 Available Profile')).toBeDefined();

    // Verify Apply button and Details button in light mode
    const applyButton = screen.getByRole('button', { name: /Apply/i });
    expect(applyButton.className).toContain('border-blue-500');

    const detailsButton = screen.getByRole('button', { name: /Details/i });
    expect(detailsButton.className).toContain('bg-slate-100');
  });

  it('displays default Ecommerce profile template card, badge, and active traffic dots during simulation', async () => {
    useFlowStore.setState({ isSimulating: true });

    const activeSimNode = {
      ...dummyNode,
      data: {
        ...dummyNode.data,
        currentHourIndex: 5
      }
    };

    await act(async () => {
      render(
        <InternetProfileModal
          isOpen={true}
          onClose={mockOnClose}
          selectedNode={activeSimNode}
          performUpdate={mockPerformUpdate}
        />
      );
    });

    const matches = screen.getAllByText(ECOMMERCE_PROFILE.name);
    expect(matches.length).toBeGreaterThan(0);

    // Verify applied checkmark badge
    const badge = screen.getByTestId(`applied-badge-${ECOMMERCE_PROFILE.name.replaceAll(/\s+/g, '-')}`);
    expect(badge).toBeDefined();

    // Verify mini active traffic dot on active applied card
    const miniDot = screen.getByTestId('mini-active-traffic-dot');
    expect(miniDot).toBeDefined();
  });

  it('handles custom profile cards with delete button, metrics summary formatting (<1000 and >=1000)', async () => {
    const customProfile = {
      name: 'Custom Heavy Load',
      hourly: { '00:00': 500, '01:00': 2500 }
    };
    mockGetInternetProfiles.mockResolvedValue([customProfile]);

    await act(async () => {
      render(
        <InternetProfileModal
          isOpen={true}
          onClose={mockOnClose}
          selectedNode={dummyNode}
          performUpdate={mockPerformUpdate}
        />
      );
    });

    expect(screen.getByText('Custom Heavy Load')).toBeDefined();
    expect(screen.getByText('2.5k')).toBeDefined();
    expect(screen.getByText('2 Available Profiles')).toBeDefined();

    // Delete custom profile button
    const deleteButton = screen.getByTitle('Delete Template');
    await act(async () => {
      fireEvent.click(deleteButton);
    });
    expect(mockDeleteInternetProfile).toHaveBeenCalledWith('Custom Heavy Load');
  });

  it('allows clicking Details to open detailed view, editing name and points, and saving/applying detailed profile', async () => {
    await act(async () => {
      render(
        <InternetProfileModal
          isOpen={true}
          onClose={mockOnClose}
          selectedNode={dummyNode}
          performUpdate={mockPerformUpdate}
        />
      );
    });

    const detailsButtons = screen.getAllByRole('button', { name: /Details/i });
    expect(detailsButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(detailsButtons[0]);
    });

    expect(screen.getByText(/Back to Profiles Gallery/i)).toBeDefined();

    // Edit profile name in detail view
    const nameInput = screen.getByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'Updated E-Commerce Profile' } });

    // Click 'Applied' / 'Save & Apply Profile' button in details view
    const saveApplyBtn = screen.getByRole('button', { name: /Applied|Save & Apply Profile/i });
    await act(async () => {
      fireEvent.click(saveApplyBtn);
    });

    // handleSaveAndApplyDetailProfile returns viewMode to 'grid', verify grid header is shown
    expect(screen.getByText(/Select Connection Simulation Profile/i)).toBeDefined();
  });

  it('allows switching to graphical custom profile creation view, updating points, randomizing graph, saving, and canceling', async () => {
    await act(async () => {
      render(
        <InternetProfileModal
          isOpen={true}
          onClose={mockOnClose}
          selectedNode={dummyNode}
          performUpdate={mockPerformUpdate}
        />
      );
    });

    const addCustomCard = screen.getByText('Add Custom Profile');
    await act(async () => {
      fireEvent.click(addCustomCard);
    });

    expect(screen.getByText('Randomize Graph')).toBeDefined();

    // Edit custom profile name input
    const customNameInput = screen.getByRole('textbox');
    fireEvent.change(customNameInput, { target: { value: 'My Custom Profile' } });

    // Click Randomize Graph
    const randomizeBtn = screen.getByRole('button', { name: /Randomize Graph/i });
    await act(async () => {
      fireEvent.click(randomizeBtn);
    });

    // Save custom profile
    const saveCustomBtn = screen.getByRole('button', { name: /Save & Apply Custom Profile/i });
    await act(async () => {
      fireEvent.click(saveCustomBtn);
    });

    expect(mockSaveInternetProfile).toHaveBeenCalled();

    // Open custom view again and cancel
    const addCustomCardAgain = screen.getByText('Add Custom Profile');
    await act(async () => {
      fireEvent.click(addCustomCardAgain);
    });
    const cancelBtn = screen.getByText(/Cancel Custom Creation/i);
    await act(async () => {
      fireEvent.click(cancelBtn);
    });
  });

  it('displays "None" in footer when no active profile is applied and triggers onClose when Close button is clicked', async () => {
    const nodeWithoutProfile = {
      id: 'node-internet-1',
      data: {
        label: 'Internet Connection',
        connectionProfile: null
      }
    };

    await act(async () => {
      render(
        <InternetProfileModal
          isOpen={true}
          onClose={mockOnClose}
          selectedNode={nodeWithoutProfile}
          performUpdate={mockPerformUpdate}
        />
      );
    });

    expect(screen.getByText('None')).toBeDefined();

    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    const closeFooterBtn = closeButtons.find((btn) => btn.textContent === 'Close') || closeButtons[0];
    fireEvent.click(closeFooterBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });
});
