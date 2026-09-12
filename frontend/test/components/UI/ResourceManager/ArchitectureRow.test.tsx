import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ArchitectureRow, Project } from '@/components/UI/ResourceManager/ArchitectureRow';

describe('ArchitectureRow', () => {
  const project: Project = {
    id: 1,
    name: 'Test Project',
    content: '{"nodes":[]}',
    createdAt: 1000,
    updatedAt: 1000,
  };

  it('returns null when neither p nor proj is provided', () => {
    const { container } = render(<ArchitectureRow colorMode="dark" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders using proj prop fallback and supports onSelect button wrapper', () => {
    const onSelect = vi.fn();

    render(
      <ArchitectureRow
        proj={{ ...project, id: 2, name: 'Proj Fallback' }}
        onSelect={onSelect}
        colorMode="dark"
      />
    );

    expect(screen.getByText('Proj Fallback')).toBeInTheDocument();

    const selectContainer = screen.getByRole('button', { name: /Proj Fallback/i });
    fireEvent.click(selectContainer);
    expect(onSelect).toHaveBeenCalled();
  });

  it('renders active project with changes and light mode and handles delete', () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();

    render(
      <ArchitectureRow
        p={project}
        isActive={true}
        hasChanges={true}
        isCanvasEmpty={false}
        currentContent='{"nodes":[{"id":"1"}]}'
        confirmOverwriteId={null}
        setConfirmOverwriteId={vi.fn()}
        onOverwrite={vi.fn()}
        onUpdate={onUpdate}
        onLoad={vi.fn()}
        onDelete={onDelete}
        colorMode="light"
      />
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    const updateBtn = screen.getByRole('button', { name: /update/i });
    fireEvent.click(updateBtn);
    expect(onUpdate).toHaveBeenCalled();

    const deleteBtn = screen.getByTitle('Delete project');
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('renders inactive project with overwrite button when canvas is not empty and content differs', () => {
    const setConfirmOverwriteId = vi.fn();
    const onLoad = vi.fn();
    const onDelete = vi.fn();

    render(
      <ArchitectureRow
        p={{ ...project, updated_at: '2025-01-01T12:00:00Z' } as any}
        isLoaded={false}
        isSelected={true}
        hasChanges={false}
        isCanvasEmpty={false}
        currentContent='{"nodes":[{"id":"different"}]}'
        confirmOverwriteId={null}
        setConfirmOverwriteId={setConfirmOverwriteId}
        onOverwrite={vi.fn()}
        onUpdate={vi.fn()}
        onLoad={onLoad}
        onDelete={onDelete}
        colorMode="dark"
      />
    );

    const overwriteBtn = screen.getByRole('button', { name: /overwrite/i });
    expect(overwriteBtn).toBeInTheDocument();
    fireEvent.click(overwriteBtn);
    expect(setConfirmOverwriteId).toHaveBeenCalledWith(1);

    const openBtn = screen.getByRole('button', { name: /open/i });
    fireEvent.click(openBtn);
    expect(onLoad).toHaveBeenCalledWith(1, 'Test Project');

    const deleteBtn = screen.getByTitle('Delete project');
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('renders confirmation prompt when confirmOverwriteId matches project id', () => {
    const onOverwrite = vi.fn();
    const setConfirmOverwriteId = vi.fn();

    render(
      <ArchitectureRow
        p={project}
        isActive={false}
        hasChanges={false}
        isCanvasEmpty={false}
        currentContent='{"nodes":[{"id":"different"}]}'
        confirmOverwriteId={1}
        setConfirmOverwriteId={setConfirmOverwriteId}
        onOverwrite={onOverwrite}
        onUpdate={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        colorMode="dark"
      />
    );

    expect(screen.getByText('OVERWRITE?')).toBeInTheDocument();

    const yesBtn = screen.getByRole('button', { name: /^YES$/i });
    fireEvent.click(yesBtn);
    expect(onOverwrite).toHaveBeenCalledWith(1);

    const noBtn = screen.getByRole('button', { name: /^NO$/i });
    fireEvent.click(noBtn);
    expect(setConfirmOverwriteId).toHaveBeenCalledWith(null);
  });
});
