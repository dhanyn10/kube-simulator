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

    const saveBtn = screen.getByText('Save Profile Template');
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

    // Click the custom profile template card to select it
    fireEvent.click(screen.getByText('Custom Peak Profile'));

    const deleteBtn = screen.getByTitle('Delete Template');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(window.go.main.App.DeleteInternetProfile).toHaveBeenCalledWith('Custom Peak Profile');
    });
  });

  it('activates profile and triggers performUpdate when Activate Profile is clicked', async () => {
    render(
      <InternetProfileModal
        isOpen={true}
        onClose={onClose}
        selectedNode={selectedNode}
        performUpdate={performUpdate}
      />
    );

    const activateBtn = screen.getByText('Activate Profile');
    fireEvent.click(activateBtn);

    expect(performUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        activeProfileName: 'E-Commerce Simulation',
        traffic: 1500
      })
    );
    expect(onClose).toHaveBeenCalled();
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
