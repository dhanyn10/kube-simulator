import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { ProjectsTab, ProjectsTabProps } from '@/components/UI/ResourceManager/ProjectsTab';
import { Project } from '@/components/UI/ResourceManager/ArchitectureRow';

describe('ProjectsTab', () => {
  const sampleProjects: Project[] = [
    { id: 1, name: 'Project Alpha', updated_at: '2025-01-01 10:00:00' },
    { id: 2, name: 'Project Beta', updated_at: '2025-01-02 11:00:00' },
  ];

  const defaultProps: ProjectsTabProps = {
    projectName: '',
    setProjectName: vi.fn(),
    handleSave: vi.fn(),
    projects: sampleProjects,
    currentProject: { id: 1, name: 'Project Alpha' },
    hasChanges: false,
    isCanvasEmpty: false,
    currentContent: '{}',
    confirmOverwriteId: null,
    setConfirmOverwriteId: vi.fn(),
    handleOverwrite: vi.fn(),
    handleUpdate: vi.fn(),
    handleLoad: vi.fn(),
    handleDelete: vi.fn(),
    colorMode: 'dark',
  };

  it('renders projects tab in dark mode without autosave banner or projects', () => {
    render(
      <ProjectsTab
        {...defaultProps}
        projects={[]}
        colorMode="dark"
      />
    );

    expect(screen.getByText('Architecture Archives')).toBeInTheDocument();
    expect(screen.getByText('No saved architectures found')).toBeInTheDocument();
    expect(screen.queryByText(/Auto-saved session profile restored/i)).not.toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /Save New/i });
    expect(saveButton).toBeDisabled();
  });

  it('renders projects tab in light mode with autosave banner and handles restore click', () => {
    const handleRestoreAutosave = vi.fn();

    render(
      <ProjectsTab
        {...defaultProps}
        colorMode="light"
        latestAutosaveKey="autosave-12092026"
        handleRestoreAutosave={handleRestoreAutosave}
      />
    );

    expect(screen.getByText('autosave-12092026')).toBeInTheDocument();

    const loadProfileBtn = screen.getByRole('button', { name: 'Load Profile' });
    fireEvent.click(loadProfileBtn);
    expect(handleRestoreAutosave).toHaveBeenCalled();
  });

  it('handles project name typing and clicking Save New button', () => {
    const setProjectName = vi.fn();
    const handleSave = vi.fn();

    render(
      <ProjectsTab
        {...defaultProps}
        projectName="New System Architecture"
        setProjectName={setProjectName}
        handleSave={handleSave}
      />
    );

    const input = screen.getByPlaceholderText('Enter new architecture name...');
    fireEvent.change(input, { target: { value: 'Updated Name' } });
    expect(setProjectName).toHaveBeenCalledWith('Updated Name');

    const saveButton = screen.getByRole('button', { name: /Save New/i });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);
    expect(handleSave).toHaveBeenCalled();
  });

  it('renders list of projects using ArchitectureRow', () => {
    render(<ProjectsTab {...defaultProps} projects={sampleProjects} />);

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });
});
