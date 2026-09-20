import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { InternetProfileModal } from '@/components/Modals/InternetProfileModal';
import { ECOMMERCE_PROFILE } from '@/activities/modals';

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
      profile: {
        name: ECOMMERCE_PROFILE.name,
        daily: ECOMMERCE_PROFILE.daily
      }
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
    expect(screen.getByText(/Weekly Connection Simulation Profile Templates/i)).toBeDefined();
  });

  it('displays default Ecommerce profile template card and badge', () => {
    render(
      <InternetProfileModal
        isOpen={true}
        onClose={mockOnClose}
        selectedNode={dummyNode}
        performUpdate={mockPerformUpdate}
      />
    );

    const matches = screen.getAllByText(ECOMMERCE_PROFILE.name);
    expect(matches.length).toBeGreaterThan(0);

    // Verify applied checkmark badge (only icon, no text label)
    const badge = screen.getByTestId(`applied-badge-${ECOMMERCE_PROFILE.name.replaceAll(/\s+/g, '-')}`);
    expect(badge).toBeDefined();
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

  it('allows switching to custom profile creation view', () => {
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

    expect(screen.getByText('Create Custom Connection Profile Template')).toBeDefined();
  });
});
