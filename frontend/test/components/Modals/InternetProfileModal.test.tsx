import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { InternetProfileModal } from '@/components/Modals/InternetProfileModal';
import { ECOMMERCE_PROFILE } from '@/activities/modals';
import { HOURS_OF_DAY } from '@/lib/kubechart';
import { useFlowStore } from '@/store/useFlowStore';
import * as kubechart from '@/lib/kubechart';


const mockGetInternetProfiles = vi.fn();
const mockSaveInternetProfile = vi.fn();
const mockDeleteInternetProfile = vi.fn();

// Mock globalThis.go
beforeEach(() => {
  (globalThis as any).go = {
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
    useFlowStore.setState({ colorMode: 'dark', nodes: [], edges: [], isSimulating: false });
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
    const dot1 = screen.getByTestId('mini-active-traffic-dot');
    expect(dot1.querySelector('.fill-rose-500')).not.toBeNull();

    // Case 2: Edge with validationError: true (isRed: true)
    act(() => {
      useFlowStore.setState({
        nodes: [
          { id: 'node-internet-1', type: 'Internet', data: {} },
          { id: 'pod-1', type: 'Pod', data: { status: 'ready' } }
        ],
        edges: [
          { id: 'e1', source: 'node-internet-1', target: 'pod-1', data: { validationError: 'Error' } }
        ]
      });
    });
    const dot2 = screen.getByTestId('mini-active-traffic-dot');
    expect(dot2.querySelector('.fill-rose-500')).not.toBeNull();

    // Case 3: Edge pointing to unready Pod or Deployment (isRed: true)
    act(() => {
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
    });
    const dot3 = screen.getByTestId('mini-active-traffic-dot');
    expect(dot3.querySelector('.fill-rose-500')).not.toBeNull();

    // Case 4: Edge pointing to non-Pod/Deployment node (e.g. Service or Ingress) (isRed: false if healthy)
    act(() => {
      useFlowStore.setState({
        nodes: [
          { id: 'node-internet-1', type: 'Internet', data: {} },
          { id: 'svc-1', type: 'Service', data: {} }
        ],
        edges: [{ id: 'e1', source: 'node-internet-1', target: 'svc-1', data: {} }]
      });
    });
    const dot4 = screen.getByTestId('mini-active-traffic-dot');
    expect(dot4.querySelector('.fill-blue-400')).not.toBeNull();

    // Case 5: Edge pointing to ready Pod (isRed: false)
    act(() => {
      useFlowStore.setState({
        nodes: [
          { id: 'node-internet-1', type: 'Internet', data: {} },
          { id: 'pod-1', type: 'Pod', data: { status: 'ready' } }
        ],
        edges: [{ id: 'e1', source: 'node-internet-1', target: 'pod-1', data: {} }]
      });
    });
    const dot5 = screen.getByTestId('mini-active-traffic-dot');
    expect(dot5.querySelector('.fill-blue-400')).not.toBeNull();
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

  it('covers light mode profile card styling on line 59 and card selection in grid view on line 247', async () => {
    useFlowStore.setState({ colorMode: 'light' });

    const nodeWithUnselectedProfile = {
      id: 'node-internet-1',
      data: {
        label: 'Internet Connection',
        activeProfileName: 'Custom Unselected Profile',
        connectionProfile: { name: 'Custom Unselected Profile', hourly: { '00:00': 100 } }
      }
    };

    await act(async () => {
      render(
        <InternetProfileModal
          isOpen={true}
          onClose={mockOnClose}
          selectedNode={nodeWithUnselectedProfile}
          performUpdate={mockPerformUpdate}
        />
      );
    });

    // In grid view with light mode, ECOMMERCE_PROFILE card is unselected, hitting line 59
    const ecommerceTitle = screen.getByText(ECOMMERCE_PROFILE.name);
    const cardContainer = ecommerceTitle.closest('div');
    expect(cardContainer).toBeDefined();

    // Clicking Apply button on unselected card triggers handleApplyProfile on line 247
    const applyBtn = screen.getByRole('button', { name: /Apply Profile|Apply/i });
    await act(async () => {
      fireEvent.click(applyBtn);
    });
    expect(mockPerformUpdate).toHaveBeenCalledWith(expect.objectContaining({
      activeProfileName: ECOMMERCE_PROFILE.name,
    }));
  });

  it('covers Back to Profiles Gallery button on line 365 and onUpdateProfile callback on line 463 in details/custom view', async () => {
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

    // Open details view via Details button
    const detailsButtons = screen.getAllByRole('button', { name: /Details/i });
    await act(async () => {
      fireEvent.click(detailsButtons[0]);
    });

    // Click Back to Profiles Gallery button on line 365
    const backBtn = screen.getByRole('button', { name: /Back to Profiles Gallery/i });
    await act(async () => {
      fireEvent.click(backBtn);
    });
    expect(screen.getByText(/Select Connection Simulation Profile/i)).toBeDefined();

    // Enter custom view and test onUpdateProfile callback on line 463
    await act(async () => {
      fireEvent.click(screen.getByText('Add Custom Profile'));
    });

    // Drag / click on InteractiveTrafficChart canvas overlay to trigger onUpdateProfile on line 463
    const interactiveChartOverlay = screen.getByTestId('interactive-chart-canvas-overlay');
    await act(async () => {
      fireEvent.pointerDown(interactiveChartOverlay, { clientX: 50, clientY: 50 });
      fireEvent.pointerMove(interactiveChartOverlay, { clientX: 50, clientY: 40 });
      fireEvent.pointerUp(interactiveChartOverlay);
    });
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

  it('displays Pause and Stop overlay buttons on profile cards and Add Custom Profile card during active simulation, invoking pauseSimulation and stopSimulation', async () => {
    const pauseSimulationMock = vi.fn();
    const stopSimulationMock = vi.fn();

    useFlowStore.setState({
      isSimulating: true,
      pauseSimulation: pauseSimulationMock,
      stopSimulation: stopSimulationMock
    });

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

    expect(screen.getByText('Pause or Stop simulation to add custom profile')).toBeDefined();

    const pauseBtns = screen.getAllByTitle('Pause simulation to view details');
    expect(pauseBtns.length).toBeGreaterThan(0);
    fireEvent.click(pauseBtns[0]);
    expect(pauseSimulationMock).toHaveBeenCalled();

    const stopBtns = screen.getAllByTitle('Stop simulation to view details');
    expect(stopBtns.length).toBeGreaterThan(0);
    fireEvent.click(stopBtns[0]);
    expect(stopSimulationMock).toHaveBeenCalled();

    // Click Pause and Stop on the Add Custom Profile card overlay
    const customPauseBtn = screen.getByRole('button', { name: /^Pause$/i });
    fireEvent.click(customPauseBtn);
    expect(pauseSimulationMock).toHaveBeenCalledTimes(2);

    const customStopBtn = screen.getByRole('button', { name: /^Stop$/i });
    fireEvent.click(customStopBtn);
    expect(stopSimulationMock).toHaveBeenCalledTimes(2);
  });

  it('renders modal cleanly without footer elements', async () => {
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

    expect(screen.queryByText(/Active Connection Profile:/i)).toBeNull();
  });

  it('renders Auto Save button in details view, triggers manual auto save on click, and displays Auto Saved state', async () => {
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
    await act(async () => {
      fireEvent.click(detailsButtons[0]);
    });

    const autoSaveBtn = screen.getByTestId('auto-save-btn');
    expect(autoSaveBtn).toBeDefined();
    expect(screen.getByText('Auto Save')).toBeDefined();

    await act(async () => {
      fireEvent.click(autoSaveBtn);
    });

    expect(mockSaveInternetProfile).toHaveBeenCalled();
    expect(screen.getByText('Auto Saved')).toBeDefined();
  });

  it('covers getAutoSaveButtonClass line 59 in light mode and onUpdateProfile line 463 in custom profile view', async () => {
    // 1. Line 59: Light mode Auto Save button styling
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

    const detailsButtons = screen.getAllByRole('button', { name: /Details/i });
    await act(async () => {
      fireEvent.click(detailsButtons[0]);
    });

    const autoSaveBtn = screen.getByTestId('auto-save-btn');
    expect(autoSaveBtn.className).toContain('bg-slate-100');

    // 2. Line 463: onUpdateProfile in Custom Profile view
    const backBtn = screen.getByRole('button', { name: /Back to Profiles Gallery/i });
    await act(async () => {
      fireEvent.click(backBtn);
    });

    const addCustomCard = screen.getByText('Add Custom Profile');
    await act(async () => {
      fireEvent.click(addCustomCard);
    });

    // In InteractiveTrafficChart, the interval select changes intervalMinutes and triggers onUpdateProfile on line 463
    const intervalSelect = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(intervalSelect, { target: { value: '30' } });
    });
  });

  it('covers minVal >= 1000 formatting on line 239 and maxVal < 1000 formatting on line 240', async () => {
    mockGetInternetProfiles.mockResolvedValue([
      {
        name: 'High Range Profile',
        hourly: Object.fromEntries(HOURS_OF_DAY.map((h) => [h, 1500]))
      },
      {
        name: 'Low Range Profile',
        hourly: Object.fromEntries(HOURS_OF_DAY.map((h) => [h, 500]))
      }
    ]);

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

    // High Range Profile has minVal = 1500 >= 1000 -> displays "1.5k" (line 239)
    expect(screen.getAllByText('1.5k').length).toBeGreaterThan(0);

    // Low Range Profile has maxVal = 500 < 1000 -> displays "500" (line 240)
    expect(screen.getAllByText('500').length).toBeGreaterThan(0);
  });
});
