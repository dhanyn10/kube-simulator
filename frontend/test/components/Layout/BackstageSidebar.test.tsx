import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { BackstageSidebar, BackstageSidebarProps } from '@/components/Layout/BackstageSidebar';

describe('BackstageSidebar', () => {
  const defaultProps: BackstageSidebarProps = {
    colorMode: 'dark',
    activeTab: 'home',
    setActiveTab: vi.fn(),
    isSettingsExpanded: false,
    setIsSettingsExpanded: vi.fn(),
    isCanvasEmpty: false,
    onClose: vi.fn(),
    onQuickSaveCurrent: vi.fn(),
    onSaveAs: vi.fn(),
    onImportFile: vi.fn(),
    onExportYaml: vi.fn(),
    toggleColorMode: vi.fn(),
  };

  it('renders sidebar in dark mode and handles nav item clicks', () => {
    const setActiveTab = vi.fn();
    const onClose = vi.fn();
    const onQuickSaveCurrent = vi.fn();
    const onSaveAs = vi.fn();
    const onImportFile = vi.fn();
    const onExportYaml = vi.fn();

    render(
      <BackstageSidebar
        {...defaultProps}
        colorMode="dark"
        activeTab="settings-view"
        setActiveTab={setActiveTab}
        onClose={onClose}
        onQuickSaveCurrent={onQuickSaveCurrent}
        onSaveAs={onSaveAs}
        onImportFile={onImportFile}
        onExportYaml={onExportYaml}
      />
    );

    expect(screen.getByText('File Menu')).toBeInTheDocument();

    // Click Home
    fireEvent.click(screen.getByText('Home'));
    expect(setActiveTab).toHaveBeenCalledWith('home');

    // Click Save
    fireEvent.click(screen.getByText('Save'));
    expect(onQuickSaveCurrent).toHaveBeenCalled();

    // Click Save As...
    fireEvent.click(screen.getByText('Save As...'));
    expect(onClose).toHaveBeenCalled();
    expect(onSaveAs).toHaveBeenCalled();

    // Click Import
    fireEvent.click(screen.getByText('Import'));
    expect(onClose).toHaveBeenCalled();
    expect(onImportFile).toHaveBeenCalled();

    // Click Export YAML
    fireEvent.click(screen.getByText('Export YAML'));
    expect(onClose).toHaveBeenCalled();
    expect(onExportYaml).toHaveBeenCalled();
  });

  it('renders in light mode, disables Save button when canvas is empty, and toggles theme mode', () => {
    const toggleColorMode = vi.fn();

    render(
      <BackstageSidebar
        {...defaultProps}
        colorMode="light"
        isCanvasEmpty={true}
        toggleColorMode={toggleColorMode}
      />
    );

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    expect(saveButton).toBeDisabled();

    const themeToggle = screen.getByText('Theme Mode');
    fireEvent.click(themeToggle);
    expect(toggleColorMode).toHaveBeenCalled();
  });

  it('expands settings accordion and selects settings-view if activeTab is home', () => {
    const setIsSettingsExpanded = vi.fn();
    const setActiveTab = vi.fn();

    render(
      <BackstageSidebar
        {...defaultProps}
        activeTab="home"
        isSettingsExpanded={false}
        setIsSettingsExpanded={setIsSettingsExpanded}
        setActiveTab={setActiveTab}
      />
    );

    const settingsBtn = screen.getByRole('button', { name: /Settings/i });
    fireEvent.click(settingsBtn);

    expect(setIsSettingsExpanded).toHaveBeenCalledWith(true);
    expect(setActiveTab).toHaveBeenCalledWith('settings-view');
  });

  it('renders expanded settings submenu and handles sub-item clicks', () => {
    const setActiveTab = vi.fn();

    render(
      <BackstageSidebar
        {...defaultProps}
        activeTab="settings-view"
        isSettingsExpanded={true}
        setActiveTab={setActiveTab}
      />
    );

    expect(screen.getByText('View & Layout')).toBeInTheDocument();
    expect(screen.getByText('Canvas Grid')).toBeInTheDocument();

    fireEvent.click(screen.getByText('View & Layout'));
    expect(setActiveTab).toHaveBeenCalledWith('settings-view');

    fireEvent.click(screen.getByText('Canvas Grid'));
    expect(setActiveTab).toHaveBeenCalledWith('settings-canvas');
  });
});
