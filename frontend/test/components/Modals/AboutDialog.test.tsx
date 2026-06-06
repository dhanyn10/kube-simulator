import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AboutDialog from '../../../src/components/Modals/AboutDialog';
import { useFlowStore } from '../../../src/store';
import * as AppBindings from '../../../wailsjs/go/main/App';
import React from 'react';

// Mock Wails bindings
vi.mock('../../../wailsjs/go/main/App', () => ({
  GetSystemInfo: vi.fn(),
  CheckForUpdates: vi.fn(),
}));

// Mock ResizeObserver for Headless UI Dialog
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('AboutDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });

    (AppBindings.GetSystemInfo as any).mockResolvedValue({
      os: 'linux',
      arch: 'amd64',
      goVersion: 'go1.21.0',
      version: '1.2.3'
    });

    (AppBindings.CheckForUpdates as any).mockResolvedValue({
      updateAvailable: false,
      currentVersion: '1.2.3',
      latestVersion: '1.2.3'
    });
  });

  it('renders correctly when open', async () => {
    render(<AboutDialog isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('Kube Simulator')).toBeDefined();
    await waitFor(() => {
      expect(screen.queryAllByText(/1.2.3/).length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(/linux/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/amd64/).length).toBeGreaterThan(0);
  });

  it('shows update available message', async () => {
    (AppBindings.CheckForUpdates as any).mockResolvedValue({
      updateAvailable: true,
      latestVersion: '1.2.4',
      releaseUrl: 'https://github.com/test/release',
      isPrerelease: false
    });

    render(<AboutDialog isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/New version available: v1.2.4/)).toBeDefined();
    });
  });

  it('handles copy to clipboard', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    render(<AboutDialog isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Copy to Clipboard')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Copy to Clipboard'));

    expect(writeTextSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeDefined();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<AboutDialog isOpen={true} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: '' }); // The X button
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('handles fetch info error', async () => {
    (AppBindings.GetSystemInfo as any).mockRejectedValue(new Error('Fetch failed'));
    render(<AboutDialog isOpen={true} onClose={() => {}} />);
    // Should not crash
  });

  it('handles copy error', async () => {
    Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Copy failed')),
        },
    });

    render(<AboutDialog isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
        expect(screen.getByText('Copy to Clipboard')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Copy to Clipboard'));
    // Should not crash
  });
});
