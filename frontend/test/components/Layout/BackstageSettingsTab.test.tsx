import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { BackstageSettingsTab, BackstageSettingsTabProps } from '@/components/Layout/BackstageSettingsTab';

describe('BackstageSettingsTab', () => {
  const defaultProps: BackstageSettingsTabProps = {
    activeTab: 'settings-view',
    colorMode: 'dark',
    isSidebarVisible: true,
    isRightSidebarVisible: true,
    isMonitoringOpen: false,
    isAutofocusEnabled: true,
    canvasBgVariant: 'dots',
    canvasBgColor: 'default',
    canvasBgOpacity: 0.8,
    setSidebarVisible: vi.fn(),
    setRightSidebarVisible: vi.fn(),
    setMonitoringOpen: vi.fn(),
    toggleAutofocus: vi.fn(),
    setCanvasBgVariant: vi.fn(),
    setCanvasBgColor: vi.fn(),
    setCanvasBgOpacity: vi.fn(),
  };

  it('renders null when activeTab is neither settings-view nor settings-canvas', () => {
    const { container } = render(
      <BackstageSettingsTab {...defaultProps} activeTab={'home' as any} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders view & layout settings tab in dark mode and handles toggle checkboxes', () => {
    const setSidebarVisible = vi.fn();
    const setRightSidebarVisible = vi.fn();
    const setMonitoringOpen = vi.fn();
    const toggleAutofocus = vi.fn();

    render(
      <BackstageSettingsTab
        {...defaultProps}
        activeTab="settings-view"
        colorMode="dark"
        isSidebarVisible={true}
        isRightSidebarVisible={false}
        isMonitoringOpen={true}
        isAutofocusEnabled={false}
        setSidebarVisible={setSidebarVisible}
        setRightSidebarVisible={setRightSidebarVisible}
        setMonitoringOpen={setMonitoringOpen}
        toggleAutofocus={toggleAutofocus}
      />
    );

    expect(screen.getByText('View & Layout Settings')).toBeInTheDocument();

    const componentsCheckbox = screen.getByLabelText('Components Sidebar');
    fireEvent.click(componentsCheckbox);
    expect(setSidebarVisible).toHaveBeenCalledWith(false);

    const utilitiesCheckbox = screen.getByLabelText('Utilities Sidebar');
    fireEvent.click(utilitiesCheckbox);
    expect(setRightSidebarVisible).toHaveBeenCalledWith(true);

    const simulationCheckbox = screen.getByLabelText('Simulation Panel');
    fireEvent.click(simulationCheckbox);
    expect(setMonitoringOpen).toHaveBeenCalledWith(false);

    const autofocusCheckbox = screen.getByLabelText('Autofocus');
    fireEvent.click(autofocusCheckbox);
    expect(toggleAutofocus).toHaveBeenCalled();
  });

  it('renders view & layout settings tab in light mode', () => {
    render(
      <BackstageSettingsTab
        {...defaultProps}
        activeTab="settings-view"
        colorMode="light"
      />
    );

    expect(screen.getByText('View & Layout Settings')).toBeInTheDocument();
  });

  it('renders canvas grid customization tab with default color in dark mode', () => {
    const setCanvasBgVariant = vi.fn();
    const setCanvasBgOpacity = vi.fn();

    render(
      <BackstageSettingsTab
        {...defaultProps}
        activeTab="settings-canvas"
        colorMode="dark"
        canvasBgVariant="dots"
        canvasBgColor="default"
        canvasBgOpacity={0.8}
        setCanvasBgVariant={setCanvasBgVariant}
        setCanvasBgOpacity={setCanvasBgOpacity}
      />
    );

    expect(screen.getByText('Canvas Grid Customization')).toBeInTheDocument();
    expect(screen.queryByText('Reset Color')).not.toBeInTheDocument();

    const dotsButton = screen.getByRole('button', { name: 'Dots Pattern' });
    const linesButton = screen.getByRole('button', { name: 'Lines Grid' });

    fireEvent.click(dotsButton);
    expect(setCanvasBgVariant).toHaveBeenCalledWith('dots');

    fireEvent.click(linesButton);
    expect(setCanvasBgVariant).toHaveBeenCalledWith('lines');

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(setCanvasBgOpacity).toHaveBeenCalledWith(0.5);
  });

  it('renders canvas grid customization tab in light mode with custom color and allows reset', () => {
    const setCanvasBgColor = vi.fn();

    render(
      <BackstageSettingsTab
        {...defaultProps}
        activeTab="settings-canvas"
        colorMode="light"
        canvasBgColor="#123456"
        setCanvasBgColor={setCanvasBgColor}
      />
    );

    const resetButton = screen.getByRole('button', { name: /Reset Color/i });
    expect(resetButton).toBeInTheDocument();

    fireEvent.click(resetButton);
    expect(setCanvasBgColor).toHaveBeenCalledWith('default');
  });
});
