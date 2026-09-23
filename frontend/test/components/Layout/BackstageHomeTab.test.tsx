import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { BackstageHomeTab, BackstageHomeTabProps } from '@/components/Layout/BackstageHomeTab';
import { RecentFileItem } from '@/activities/layout/fileBackstageHelpers';

describe('BackstageHomeTab', () => {
  const dummyFiles: RecentFileItem[] = [
    {
      id: 101,
      name: 'Active Project 1',
      updatedAt: '2025-01-01 10:00:00',
      location: '/local/projects/active.infra',
      fullPath: '/local/projects/active.infra',
      isAutosave: false,
    },
    {
      id: 102,
      name: 'Autosave Profile',
      updatedAt: '2025-01-01 11:00:00',
      location: '/local/autosaves/autosave-123.infra',
      fullPath: '/local/autosaves/autosave-123.infra',
      isAutosave: true,
    },
  ];

  const defaultProps: BackstageHomeTabProps = {
    colorMode: 'dark',
    isAutosaveEnabled: true,
    toggleAutosave: vi.fn(),
    newProjectName: 'My Project',
    setNewProjectName: vi.fn(),
    isCanvasEmpty: false,
    currentProjectId: 101,
    recentFiles: dummyFiles,
    activeContextItem: dummyFiles[1],
    handleQuickSaveCurrent: vi.fn(),
    onClose: vi.fn(),
    onSaveAs: vi.fn(),
    handleRowContextMenu: vi.fn(),
    handleRestoreFile: vi.fn(),
  };

  it('renders home tab title, autosave ON badge, and project input', () => {
    render(<BackstageHomeTab {...defaultProps} />);

    expect(screen.getByText('Home & Recent Profiles')).toBeInTheDocument();
    expect(screen.getByText('ON')).toBeInTheDocument();
    expect(screen.getByDisplayValue('My Project')).toBeInTheDocument();
  });

  it('handles Autosave toggle switch button click', () => {
    const toggleAutosave = vi.fn();
    render(<BackstageHomeTab {...defaultProps} isAutosaveEnabled={false} toggleAutosave={toggleAutosave} />);

    expect(screen.getByText('OFF')).toBeInTheDocument();
    const switchBtn = screen.getByRole('switch');
    fireEvent.click(switchBtn);

    expect(toggleAutosave).toHaveBeenCalled();
  });

  it('handles active project name input change and Save button click', () => {
    const setNewProjectName = vi.fn();
    const handleQuickSaveCurrent = vi.fn();

    render(
      <BackstageHomeTab
        {...defaultProps}
        setNewProjectName={setNewProjectName}
        handleQuickSaveCurrent={handleQuickSaveCurrent}
      />
    );

    const input = screen.getByDisplayValue('My Project');
    fireEvent.change(input, { target: { value: 'New Architecture Name' } });
    expect(setNewProjectName).toHaveBeenCalledWith('New Architecture Name');

    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveBtn);
    expect(handleQuickSaveCurrent).toHaveBeenCalled();
  });

  it('handles Save As button click (calling onClose and onSaveAs)', () => {
    const onClose = vi.fn();
    const onSaveAs = vi.fn();

    render(<BackstageHomeTab {...defaultProps} onClose={onClose} onSaveAs={onSaveAs} />);

    const saveAsBtn = screen.getByRole('button', { name: /Save As/i });
    fireEvent.click(saveAsBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onSaveAs).toHaveBeenCalled();
  });

  it('renders empty recent files table row when recentFiles is empty', () => {
    render(<BackstageHomeTab {...defaultProps} recentFiles={[]} />);

    expect(screen.getByText('No recent files or auto-saved profiles found')).toBeInTheDocument();
  });

  it('handles context menu and double click on recent file rows', () => {
    const handleRowContextMenu = vi.fn();
    const handleRestoreFile = vi.fn();

    render(
      <BackstageHomeTab
        {...defaultProps}
        handleRowContextMenu={handleRowContextMenu}
        handleRestoreFile={handleRestoreFile}
      />
    );

    const row = screen.getByText('Active Project 1').closest('tr')!;

    fireEvent.contextMenu(row);
    expect(handleRowContextMenu).toHaveBeenCalledWith(expect.any(Object), dummyFiles[0]);

    fireEvent.doubleClick(row);
    expect(handleRestoreFile).toHaveBeenCalledWith(dummyFiles[0]);
  });

  it('renders in light mode and handles active context item styling in light mode', () => {
    render(
      <BackstageHomeTab
        {...defaultProps}
        colorMode="light"
        currentProjectId={101}
        activeContextItem={dummyFiles[0]}
      />
    );

    expect(screen.getByText('Active Project 1')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Auto-Save')).toBeInTheDocument();

    const row = screen.getByText('Active Project 1').closest('tr')!;
    expect(row.className).toContain('bg-blue-100/80');
  });

  it('renders in light mode without active context item', () => {
    render(
      <BackstageHomeTab
        {...defaultProps}
        colorMode="light"
        currentProjectId={undefined}
        activeContextItem={null}
      />
    );

    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });
});
