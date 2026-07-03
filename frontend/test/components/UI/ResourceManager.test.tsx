import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ResourceManager } from '@/components/UI/ResourceManager';
import { useFlowStore } from '@/store';

// Mock Wails App
const mockGetProjects = vi.fn().mockResolvedValue([]);
const mockSaveProject = vi.fn().mockResolvedValue(1);
const mockLoadProject = vi.fn().mockResolvedValue({ content: JSON.stringify({ nodes: [], edges: [] }) });
const mockUpdateProject = vi.fn().mockResolvedValue(true);
const mockDeleteProject = vi.fn().mockResolvedValue(true);

(window as any).go = {
  main: {
    App: {
      GetProjects: mockGetProjects,
      SaveProject: mockSaveProject,
      LoadProject: mockLoadProject,
      UpdateProject: mockUpdateProject,
      DeleteProject: mockDeleteProject,
    },
  },
};

// Mock useFitView
vi.mock('@/hooks/useFitView', () => ({
  useFitView: () => vi.fn(),
}));

describe('ResourceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      currentProject: null,
      lastSavedSnapshot: null,
      customImages: [],
      colorMode: 'dark',
    });
  });

  it('renders and fetches projects on open', async () => {
    mockGetProjects.mockResolvedValueOnce([{ id: 1, name: 'Project 1', updatedAt: Date.now() / 1000 }]);

    await act(async () => {
        render(<ResourceManager isOpen={true} onClose={() => {}} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeDefined();
    });
    expect(mockGetProjects).toHaveBeenCalled();
  });

  it('handles saving a new project', async () => {
    await act(async () => {
        render(<ResourceManager isOpen={true} onClose={() => {}} />);
    });

    const input = screen.getByPlaceholderText('Enter new architecture name...');
    fireEvent.change(input, { target: { value: 'My New Project' } });

    const saveButton = screen.getByText('Save New');
    await act(async () => {
        fireEvent.click(saveButton);
    });

    expect(mockSaveProject).toHaveBeenCalledWith('My New Project', expect.any(String));
  });

  it('handles loading a project', async () => {
    const project = { id: 1, name: 'Project 1', content: JSON.stringify({ nodes: [], edges: [] }), updatedAt: Date.now() / 1000 };
    mockGetProjects.mockResolvedValue([project]);
    mockLoadProject.mockResolvedValue(project);

    const onClose = vi.fn();
    await act(async () => {
        render(<ResourceManager isOpen={true} onClose={onClose} />);
    });

    await waitFor(() => screen.getByText('Open'));
    const openButton = screen.getByText('Open');

    await act(async () => {
        fireEvent.click(openButton);
    });

    expect(mockLoadProject).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('handles updating an active project', async () => {
    const project = { id: 1, name: 'Project 1' };
    useFlowStore.setState({
        currentProject: project,
        nodes: [{ id: 'n1', type: 'Pod', data: {} } as any],
        lastSavedSnapshot: JSON.stringify({ nodes: [], edges: [] })
    });
    mockGetProjects.mockResolvedValue([{ ...project, updatedAt: Date.now()/1000 }]);

    await act(async () => {
        render(<ResourceManager isOpen={true} onClose={() => {}} />);
    });

    await waitFor(() => screen.getByText('Update'));
    const updateButton = screen.getByText('Update');

    await act(async () => {
        fireEvent.click(updateButton);
    });

    expect(mockUpdateProject).toHaveBeenCalledWith(1, expect.any(String));
  });

  it('handles deleting a project', async () => {
    mockGetProjects.mockResolvedValue([{ id: 1, name: 'Project 1', updatedAt: Date.now() / 1000 }]);

    await act(async () => {
        render(<ResourceManager isOpen={true} onClose={() => {}} />);
    });

    await waitFor(() => screen.getByTitle('Delete project'));
    const deleteButton = screen.getByTitle('Delete project');

    await act(async () => {
        fireEvent.click(deleteButton);
    });

    expect(mockDeleteProject).toHaveBeenCalledWith(1);
  });

  it('switches between tabs', async () => {
    await act(async () => {
        render(<ResourceManager isOpen={true} onClose={() => {}} />);
    });

    fireEvent.click(screen.getByText('Docker Hub Registry'));
    expect(screen.getByText('Docker Hub Official Images')).toBeDefined();

    fireEvent.click(screen.getByText('Local & Custom Images'));
    expect(screen.getByText('Local & Private Images')).toBeDefined();
  });

  it('manages custom images', async () => {
    await act(async () => {
        render(<ResourceManager isOpen={true} onClose={() => {}} />);
    });

    fireEvent.click(screen.getByText('Local & Custom Images'));

    const input = screen.getByPlaceholderText(/e.g. my-app/);
    fireEvent.change(input, { target: { value: 'custom-img:v1' } });

    fireEvent.click(screen.getByText('Add Image'));

    expect(useFlowStore.getState().customImages).toContain('custom-img:v1');

    // Delete image
    const deleteButton = screen.getByTitle('Delete image option');
    fireEvent.click(deleteButton);
    expect(useFlowStore.getState().customImages).not.toContain('custom-img:v1');
  });

  it('filters docker images', async () => {
    await act(async () => {
        render(<ResourceManager isOpen={true} onClose={() => {}} />);
    });

    fireEvent.click(screen.getByText('Docker Hub Registry'));

    const searchInput = screen.getByPlaceholderText('Search images...');
    fireEvent.change(searchInput, { target: { value: 'nginx' } });

    expect(screen.getAllByText(/nginx/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/redis/i)).toBeNull();
  });
});
