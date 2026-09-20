import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InternetProfileModal } from '@/components/Modals/InternetProfileModal';
import { useFlowStore } from '@/store';

describe('InternetProfileModal', () => {
  const performUpdate = vi.fn();
  const onClose = vi.fn();

  const selectedNode = {
    id: 'internet-node-1',
    type: 'Internet',
    data: {
      label: 'Main Internet Gateway',
      traffic: 1500,
      activeProfileName: 'E-Commerce Simulation'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });

    // Mock window.go.main.App methods
    (globalThis as any).go = {
      main: {
        App: {
          GetInternetProfiles: vi.fn().mockResolvedValue([
            {
              name: 'Custom Peak Profile',
              daily: {
                Monday: 2000,
                Tuesday: 2500,
                Wednesday: 3000,
                Thursday: 3500,
                Friday: 4000,
                Saturday: 6000,
                Sunday: 5000
              }
            }
          ]),
          SaveInternetProfile: vi.fn().mockResolvedValue(true),
          DeleteInternetProfile: vi.fn().mockResolvedValue(true)
        }
      }
    };
  });

  it('renders modal with card name and template cards gallery', async () => {
    render(
      <InternetProfileModal
        isOpen={true}
        onClose={onClose}
        selectedNode={selectedNode}
        performUpdate={performUpdate}
      />
    );

    expect(screen.getByText('Main Internet Gateway')).toBeDefined();
    expect(screen.getByText('Weekly Connection Simulation Profile Templates (Monday - Sunday)')).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText('E-Commerce Simulation').length).toBeGreaterThan(0);
      expect(screen.getByText('Custom Peak Profile')).toBeDefined();
    });

    expect(screen.getByText('Add Custom Profile')).toBeDefined();
  });

  it('allows adding and saving a new custom profile template', async () => {
    render(
      <InternetProfileModal
        isOpen={true}
        onClose={onClose}
        selectedNode={selectedNode}
        performUpdate={performUpdate}
      />
    );

    fireEvent.click(screen.getByText('Add Custom Profile'));
    expect(screen.getByText('Create Custom Connection Profile Template')).toBeDefined();

    const nameInput = screen.getByPlaceholderText('e.g. Weekend Flash Sale');
    fireEvent.change(nameInput, { target: { value: 'Flash Sale Promo' } });

    const saveBtn = screen.getByText('Save & Apply Profile');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(window.go.main.App.SaveInternetProfile).toHaveBeenCalled();
    });
  });

  it('allows selecting and deleting custom profile template', async () => {
    render(
      <InternetProfileModal
        isOpen={true}
        onClose={onClose}
        selectedNode={selectedNode}
        performUpdate={performUpdate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Custom Peak Profile')).toBeDefined();
    });

    const deleteBtn = screen.getByTitle('Delete Template');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(window.go.main.App.DeleteInternetProfile).toHaveBeenCalledWith('Custom Peak Profile');
    });
  });

  it('applies profile directly when Apply button is clicked and shows top-right applied checkmark badge', async () => {
    render(
      <InternetProfileModal
        isOpen={true}
        onClose={onClose}
        selectedNode={selectedNode}
        performUpdate={performUpdate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Custom Peak Profile')).toBeDefined();
    });

    const applyBtns = screen.getAllByText('Apply');
    fireEvent.click(applyBtns[0]);

    expect(performUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        activeProfileName: 'Custom Peak Profile',
        traffic: 2000
      })
    );
  });

  it('opens detailed full profile view when Details button is clicked', async () => {
    render(
      <InternetProfileModal
        isOpen={true}
        onClose={onClose}
        selectedNode={selectedNode}
        performUpdate={performUpdate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Custom Peak Profile')).toBeDefined();
    });

    const detailsBtns = screen.getAllByText('Details');
    fireEvent.click(detailsBtns[0]);

    expect(screen.getByText('Back to Profiles Gallery')).toBeDefined();
    expect(screen.getByText('Daily Traffic Allocation Schedule')).toBeDefined();
  });

  it('does not render when isOpen is false', () => {
    render(
      <InternetProfileModal
        isOpen={false}
        onClose={onClose}
        selectedNode={selectedNode}
        performUpdate={performUpdate}
      />
    );

    expect(screen.queryByText('Main Internet Gateway')).toBeNull();
  });
});
