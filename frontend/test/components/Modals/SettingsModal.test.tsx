import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../../../src/components/Modals/SettingsModal';
import { useFlowStore } from '../../../src/store';

// Mock ResizeObserver for Headless UI Dialog
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      isSidebarVisible: true,
      isRightSidebarVisible: true,
      isMonitoringOpen: false,
      isAutofocusEnabled: false,
      canvasBgVariant: 'dots',
      canvasBgColor: 'default',
      canvasBgOpacity: 0.6,
    });

    // Mock globalThis.go for backend calls
    (globalThis as any).go = {
      main: {
        App: {
          SaveSetting: vi.fn().mockResolvedValue(true)
        }
      }
    };
  });

  it('renders correctly when open and switches tabs', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('Application Settings')).toBeDefined();

    // Left Sidebar navigation items
    const viewTabBtn = screen.getByRole('button', { name: 'View' });
    const canvasTabBtn = screen.getByRole('button', { name: 'Canvas' });
    expect(viewTabBtn).toBeDefined();
    expect(canvasTabBtn).toBeDefined();

    // Defaults to 'View' tab
    expect(screen.getByText('View & Layout Toggles')).toBeDefined();
    expect(screen.getByLabelText('Toggle Components Sidebar')).toBeDefined();
    expect(screen.queryByText('Canvas Customization')).toBeNull();

    // Click 'Canvas' tab
    fireEvent.click(canvasTabBtn);

    // Verify view toggles disappear and canvas customizations show up
    expect(screen.queryByText('View & Layout Toggles')).toBeNull();
    expect(screen.getByText('Canvas Customization')).toBeDefined();
    expect(screen.getByText('Dots')).toBeDefined();
    expect(screen.getByText('Lines')).toBeDefined();
  });

  it('toggles View properties and updates Zustand store', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    // Active tab is View
    const sidebarCheckbox = screen.getByLabelText('Toggle Components Sidebar');
    fireEvent.click(sidebarCheckbox);
    expect(useFlowStore.getState().isSidebarVisible).toBe(false);

    const rightSidebarCheckbox = screen.getByLabelText('Toggle Utilities Sidebar');
    fireEvent.click(rightSidebarCheckbox);
    expect(useFlowStore.getState().isRightSidebarVisible).toBe(false);

    const simPanelCheckbox = screen.getByLabelText('Toggle Simulation Panel');
    fireEvent.click(simPanelCheckbox);
    expect(useFlowStore.getState().isMonitoringOpen).toBe(true);

    const autofocusCheckbox = screen.getByLabelText('Toggle Autofocus');
    fireEvent.click(autofocusCheckbox);
    expect(useFlowStore.getState().isAutofocusEnabled).toBe(true);
  });

  it('updates canvas background variants on Canvas tab', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    // Click Canvas tab
    const canvasTabBtn = screen.getByRole('button', { name: 'Canvas' });
    fireEvent.click(canvasTabBtn);

    const linesBtn = screen.getByText('Lines');
    fireEvent.click(linesBtn);
    expect(useFlowStore.getState().canvasBgVariant).toBe('lines');

    const dotsBtn = screen.getByText('Dots');
    fireEvent.click(dotsBtn);
    expect(useFlowStore.getState().canvasBgVariant).toBe('dots');
  });

  it('updates canvas opacity correctly on Canvas tab', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    // Click Canvas tab
    const canvasTabBtn = screen.getByRole('button', { name: 'Canvas' });
    fireEvent.click(canvasTabBtn);

    const slider = screen.getByLabelText('Canvas Opacity') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(useFlowStore.getState().canvasBgOpacity).toBe(0.8);
  });

  it('updates background color and resets to default on Canvas tab', () => {
    render(<SettingsModal isOpen={true} onClose={() => {}} />);

    // Click Canvas tab
    const canvasTabBtn = screen.getByRole('button', { name: 'Canvas' });
    fireEvent.click(canvasTabBtn);

    // Select Red color (MATERIAL_COLORS[0].hex is var(--color-mat-red))
    const redBtn = screen.getByTitle('Red');
    fireEvent.click(redBtn);
    expect(useFlowStore.getState().canvasBgColor).toBe('var(--color-mat-red)');

    const resetBtn = screen.getByText('Reset to Default');
    fireEvent.click(resetBtn);
    expect(useFlowStore.getState().canvasBgColor).toBe('default');
  });
});
