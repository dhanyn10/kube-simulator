import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { BackstageContextMenu, BackstageContextMenuProps } from '@/components/Layout/BackstageContextMenu';
import { RecentFileItem } from '@/activities/layout/fileBackstageHelpers';

describe('BackstageContextMenu', () => {
  const dummyFileItem: RecentFileItem = {
    id: 1,
    name: 'Test Profile',
    updatedAt: '2025-01-01',
    location: 'local',
    fullPath: '/path/to/test.infra',
    isAutosave: false,
  };

  const defaultProps: BackstageContextMenuProps = {
    contextMenu: { x: 100, y: 150, item: dummyFileItem },
    contextMenuRef: { current: null },
    colorMode: 'dark',
    toggleColorMode: vi.fn(),
    setContextMenu: vi.fn(),
    handleRestoreFile: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders null when contextMenu is null', () => {
    const { container } = render(
      <BackstageContextMenu {...defaultProps} contextMenu={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders context menu in dark mode with item and handles Change Theme, Load Profile, and Exit button clicks', () => {
    const toggleColorMode = vi.fn();
    const setContextMenu = vi.fn();
    const handleRestoreFile = vi.fn();
    const onClose = vi.fn();

    render(
      <BackstageContextMenu
        {...defaultProps}
        colorMode="dark"
        toggleColorMode={toggleColorMode}
        setContextMenu={setContextMenu}
        handleRestoreFile={handleRestoreFile}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Change Theme')).toBeInTheDocument();
    expect(screen.getByText('Load Profile')).toBeInTheDocument();
    expect(screen.getByText('Exit')).toBeInTheDocument();

    // Click Change Theme
    fireEvent.click(screen.getByText('Change Theme'));
    expect(toggleColorMode).toHaveBeenCalled();
    expect(setContextMenu).toHaveBeenCalledWith(null);

    // Click Load Profile
    fireEvent.click(screen.getByText('Load Profile'));
    expect(handleRestoreFile).toHaveBeenCalledWith(dummyFileItem);

    // Click Exit
    fireEvent.click(screen.getByText('Exit'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders context menu in light mode without item and hides Load Profile, Open Folder, and Delete Document buttons', () => {
    render(
      <BackstageContextMenu
        {...defaultProps}
        colorMode="light"
        contextMenu={{ x: 50, y: 50, item: null }}
      />
    );

    expect(screen.getByText('Change Theme')).toBeInTheDocument();
    expect(screen.queryByText('Load Profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Open Folder Location')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete Document')).not.toBeInTheDocument();
    expect(screen.getByText('Exit')).toBeInTheDocument();
  });

  it('renders Open Folder Location and Delete Document when handlers are provided and triggers their callbacks', () => {
    const handleOpenFolder = vi.fn();
    const handleDeleteFile = vi.fn();
    const setContextMenu = vi.fn();

    render(
      <BackstageContextMenu
        {...defaultProps}
        setContextMenu={setContextMenu}
        handleOpenFolder={handleOpenFolder}
        handleDeleteFile={handleDeleteFile}
      />
    );

    const openFolderBtn = screen.getByText('Open Folder Location');
    const deleteDocBtn = screen.getByText('Delete Document');

    expect(openFolderBtn).toBeInTheDocument();
    expect(deleteDocBtn).toBeInTheDocument();

    // Click Open Folder Location
    fireEvent.click(openFolderBtn);
    expect(handleOpenFolder).toHaveBeenCalledWith(dummyFileItem);

    // Click Delete Document
    fireEvent.click(deleteDocBtn);
    expect(handleDeleteFile).toHaveBeenCalledWith(dummyFileItem);
  });
});
