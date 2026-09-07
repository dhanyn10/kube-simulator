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

(globalThis as any).go = {
  main: {
    App: {
      GetProjects: mockGetProjects,
      SaveProject: mockSaveProject,
      LoadProject: mockLoadProject,
      UpdateProject: mockUpdateProject,
      DeleteProject: mockDeleteProject,
      FetchDockerHubPopular: vi.fn().mockResolvedValue(JSON.stringify({
        results: [
          { name: 'nginx', description: 'Official build of Nginx.' },
          { name: 'redis', description: 'In-memory data structure store' }
        ]
      })),
      SearchDockerHub: vi.fn().mockResolvedValue(JSON.stringify({
        results: [
          { repo_name: 'nginx', short_description: 'Official build of Nginx.' }
        ]
      })),
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

  it('returns null when isOpen is false', () => {
    const { container } = render(<ResourceManager isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders and fetches projects on open in dark and light modes', async () => {
    mockGetProjects.mockResolvedValueOnce([{ id: 1, name: 'Project 1', updatedAt: Date.now() / 1000 }]);

    const { rerender } = render(<ResourceManager isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeDefined();
    });
    expect(mockGetProjects).toHaveBeenCalled();

    // Rerender in light mode
    act(() => {
      useFlowStore.setState({ colorMode: 'light' });
    });
    rerender(<ResourceManager isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Project 1')).toBeDefined();
  });

  it('handles saving a new project and handles empty project name', async () => {
    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    const saveButton = screen.getByText('Save New');
    // Save with empty input -> returns early
    await act(async () => {
      fireEvent.click(saveButton);
    });
    expect(mockSaveProject).not.toHaveBeenCalled();

    const input = screen.getByPlaceholderText('Enter new architecture name...');
    fireEvent.change(input, { target: { value: 'My New Project' } });

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockSaveProject).toHaveBeenCalledWith('My New Project', expect.any(String));
  });

  it('handles loading a project and handles empty project content gracefully', async () => {
    const project = { id: 1, name: 'Project 1', content: JSON.stringify({ nodes: [], edges: [] }), updatedAt: Date.now() / 1000 };
    mockGetProjects.mockResolvedValue([project]);
    mockLoadProject.mockResolvedValue(project);

    const onClose = vi.fn();
    render(<ResourceManager isOpen={true} onClose={onClose} />);

    await waitFor(() => screen.getByText('Open'));
    const openButton = screen.getByText('Open');

    await act(async () => {
      fireEvent.click(openButton);
    });

    expect(mockLoadProject).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalled();

    // Test load returning null/falsy content
    mockLoadProject.mockResolvedValueOnce(null);
    await act(async () => {
      render(<ResourceManager isOpen={true} onClose={onClose} />);
    });
  });

  it('handles active project without changes (no Update button) and updating active project with changes', async () => {
    const activeContent = JSON.stringify({ nodes: [], edges: [] });
    const project1 = { id: 1, name: 'Project 1', content: activeContent, updatedAt: Date.now()/1000 };
    useFlowStore.setState({
      currentProject: { id: 1, name: 'Project 1' },
      nodes: [],
      edges: [],
      lastSavedSnapshot: activeContent
    });
    mockGetProjects.mockResolvedValue([project1]);

    const { rerender } = render(<ResourceManager isOpen={true} onClose={() => {}} />);

    await waitFor(() => screen.getByText('Project 1'));
    expect(screen.queryByText('Update')).toBeNull();

    // Now introduce changes so hasChanges becomes true
    const newContent = JSON.stringify({ nodes: [{ id: 'n1', type: 'Pod', data: {} }], edges: [] });
    act(() => {
      useFlowStore.setState({
        nodes: [{ id: 'n1', type: 'Pod', data: {} } as any]
      });
    });

    rerender(<ResourceManager isOpen={true} onClose={() => {}} />);

    await waitFor(() => screen.getByText('Update'));
    fireEvent.click(screen.getByText('Update'));
    expect(mockUpdateProject).toHaveBeenCalledWith(1, newContent);
  });

  it('handles inactive project when canvas is empty or matching content (no Overwrite button)', async () => {
    const matchingContent = JSON.stringify({ nodes: [], edges: [] });
    const project = { id: 1, name: 'Project 1', content: matchingContent, updatedAt: Date.now()/1000 };
    useFlowStore.setState({
      currentProject: null,
      nodes: [],
      edges: [],
      lastSavedSnapshot: matchingContent
    });
    mockGetProjects.mockResolvedValue([project]);

    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    await waitFor(() => screen.getByText('Project 1'));
    expect(screen.queryByText('Overwrite')).toBeNull();
  });

  it('handles updating an active project and overwrite confirmation flow', async () => {
    const project = { id: 1, name: 'Project 1', content: JSON.stringify({ nodes: [{ id: 'n2' }], edges: [] }), updatedAt: Date.now()/1000 };
    useFlowStore.setState({
      currentProject: { id: 2, name: 'Project 2' },
      nodes: [{ id: 'n1', type: 'Pod', data: {} } as any],
      lastSavedSnapshot: JSON.stringify({ nodes: [], edges: [] })
    });
    mockGetProjects.mockResolvedValue([project]);

    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    await waitFor(() => screen.getByText('Overwrite'));
    fireEvent.click(screen.getByText('Overwrite'));

    expect(screen.getByText('OVERWRITE?')).toBeDefined();

    // Cancel overwrite
    fireEvent.click(screen.getByText('NO'));
    expect(screen.queryByText('OVERWRITE?')).toBeNull();

    // Confirm overwrite
    fireEvent.click(screen.getByText('Overwrite'));
    fireEvent.click(screen.getByText('YES'));
    expect(mockUpdateProject).toHaveBeenCalledWith(1, expect.any(String));
  });

  it('filters sidebar tabs using search input', async () => {
    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    const searchInput = screen.getByPlaceholderText('Search tabs...');
    fireEvent.change(searchInput, { target: { value: 'Docker' } });

    expect(screen.getAllByText('Docker Hub Registry').length).toBeGreaterThan(0);
    expect(screen.queryByText('Saved Architectures')).toBeNull();

    fireEvent.change(searchInput, { target: { value: 'NonexistentTab' } });
    expect(screen.getByText('No categories found')).toBeDefined();
  });

  it('handles deleting a project and resets current project if active project deleted', async () => {
    mockGetProjects.mockResolvedValue([{ id: 1, name: 'Project 1', updatedAt: Date.now() / 1000 }]);
    useFlowStore.setState({
      currentProject: { id: 1, name: 'Project 1' },
      lastSavedSnapshot: 'content',
    });

    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    await waitFor(() => screen.getByTitle('Delete project'));
    const deleteButton = screen.getByTitle('Delete project');

    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(mockDeleteProject).toHaveBeenCalledWith(1);
    expect(useFlowStore.getState().currentProject).toBeNull();
    expect(useFlowStore.getState().lastSavedSnapshot).toBeNull();
  });

  it('switches between tabs in light and dark modes', async () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getAllByText('Docker Hub Registry')[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search Docker Hub...')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Local & Custom Images'));
    expect(screen.getByText('Local & Private Images')).toBeDefined();
  });

  it('manages custom images and prevents empty custom image submission', async () => {
    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getByText('Local & Custom Images'));

    const addButton = screen.getByText('Add Image');
    // Clicking add with empty input
    fireEvent.click(addButton);
    expect(useFlowStore.getState().customImages).toHaveLength(0);

    const input = screen.getByPlaceholderText(/e.g. my-app/);
    fireEvent.change(input, { target: { value: 'custom-img:v1' } });

    fireEvent.click(addButton);

    expect(useFlowStore.getState().customImages).toContain('custom-img:v1');

    // Delete image
    const deleteButton = screen.getByTitle('Delete image option');
    fireEvent.click(deleteButton);
    expect(useFlowStore.getState().customImages).not.toContain('custom-img:v1');
  });

  it('filters docker images and handles null/empty API responses', async () => {
    vi.useFakeTimers();
    (globalThis as any).go.main.App.FetchDockerHubPopular = vi.fn().mockResolvedValue(null);

    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getAllByText('Docker Hub Registry')[0]);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    const searchInput = screen.getByPlaceholderText('Search Docker Hub...');

    (globalThis as any).go.main.App.SearchDockerHub = vi.fn().mockResolvedValue(null);

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'nginx' } });
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByText('Offline / API Limit Exceeded')).toBeDefined();
    });
  });

  it('handles viewing tags and registering tags for docker images in light mode', async () => {
    useFlowStore.setState({ colorMode: 'light' });
    (globalThis as any).go.main.App.FetchDockerHubPopular = vi.fn().mockResolvedValue(JSON.stringify({
      results: [{ name: 'nginx', description: 'Nginx image' }]
    }));
    (globalThis as any).go.main.App.FetchDockerHubTags = vi.fn().mockResolvedValue(JSON.stringify({
      results: [
        { name: 'latest' },
        { name: 'alpine' }
      ]
    }));

    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getAllByText('Docker Hub Registry')[0]);

    await waitFor(() => {
      expect(screen.getAllByText('VIEW TAGS →').length).toBeGreaterThan(0);
    });

    const viewTagsBtn = screen.getAllByText('VIEW TAGS →')[0];
    await act(async () => {
      fireEvent.click(viewTagsBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Tags for nginx')).toBeDefined();
    });

    expect(screen.getByText('nginx:latest')).toBeDefined();
    expect(screen.getByText('nginx:alpine')).toBeDefined();

    const addBtn = screen.getAllByText('+ ADD OPTION')[0];
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(useFlowStore.getState().customImages).toContain('nginx:latest');

    // Click Back button
    const backBtn = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backBtn);
    expect(screen.getAllByText('Docker Hub Registry').length).toBeGreaterThan(0);
  });

  it('handles null rawData from FetchDockerHubTags in TagsView', async () => {
    (globalThis as any).go.main.App.FetchDockerHubPopular = vi.fn().mockResolvedValue(JSON.stringify({
      results: [{ name: 'nginx', description: 'Nginx image' }]
    }));
    (globalThis as any).go.main.App.FetchDockerHubTags = vi.fn().mockResolvedValue(null);

    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getAllByText('Docker Hub Registry')[0]);

    await waitFor(() => {
      expect(screen.getAllByText('VIEW TAGS →').length).toBeGreaterThan(0);
    });

    const viewTagsBtn = screen.getAllByText('VIEW TAGS →')[0];
    await act(async () => {
      fireEvent.click(viewTagsBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to load tags')).toBeDefined();
      expect(screen.getByText('Failed to retrieve tags from backend')).toBeDefined();
    });
  });

  it('handles already added tags and deletes them in TagsView', async () => {
    (globalThis as any).go.main.App.FetchDockerHubPopular = vi.fn().mockResolvedValue(JSON.stringify({
      results: [{ name: 'nginx', description: 'Nginx image' }]
    }));
    (globalThis as any).go.main.App.FetchDockerHubTags = vi.fn().mockResolvedValue(JSON.stringify({
      results: [{ name: 'latest' }]
    }));

    useFlowStore.setState({
      customImages: ['nginx:latest']
    });

    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getAllByText('Docker Hub Registry')[0]);

    await waitFor(() => {
      expect(screen.getAllByText('VIEW TAGS →').length).toBeGreaterThan(0);
    });

    const viewTagsBtn = screen.getAllByText('VIEW TAGS →')[0];
    await act(async () => {
      fireEvent.click(viewTagsBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('ADDED')).toBeDefined();
    });

    const addedBtn = screen.getByText('ADDED');
    await act(async () => {
      fireEvent.click(addedBtn);
    });

    expect(useFlowStore.getState().customImages).not.toContain('nginx:latest');
  });

  it('handles API errors in TagsView gracefully', async () => {
    (globalThis as any).go.main.App.FetchDockerHubPopular = vi.fn().mockResolvedValue(JSON.stringify({
      results: [{ name: 'nginx', description: 'Nginx image' }]
    }));
    (globalThis as any).go.main.App.FetchDockerHubTags = vi.fn().mockRejectedValue(new Error('Network failure'));

    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getAllByText('Docker Hub Registry')[0]);

    await waitFor(() => {
      expect(screen.getAllByText('VIEW TAGS →').length).toBeGreaterThan(0);
    });

    const viewTagsBtn = screen.getAllByText('VIEW TAGS →')[0];
    await act(async () => {
      fireEvent.click(viewTagsBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to load tags')).toBeDefined();
    });
  });

  it('handles empty tags from Docker Hub in TagsView gracefully', async () => {
    (globalThis as any).go.main.App.FetchDockerHubPopular = vi.fn().mockResolvedValue(JSON.stringify({
      results: [{ name: 'nginx', description: 'Nginx image' }]
    }));
    (globalThis as any).go.main.App.FetchDockerHubTags = vi.fn().mockResolvedValue(JSON.stringify({
      results: []
    }));

    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getAllByText('Docker Hub Registry')[0]);

    await waitFor(() => {
      expect(screen.getAllByText('VIEW TAGS →').length).toBeGreaterThan(0);
    });

    const viewTagsBtn = screen.getAllByText('VIEW TAGS →')[0];
    await act(async () => {
      fireEvent.click(viewTagsBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/No tags found for/i)).toBeDefined();
    });
  });

  it('handles empty results from search', async () => {
    (globalThis as any).go.main.App.SearchDockerHub = vi.fn().mockResolvedValue(JSON.stringify({
      results: []
    }));

    vi.useFakeTimers();
    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getAllByText('Docker Hub Registry')[0]);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    const searchInput = screen.getByPlaceholderText('Search Docker Hub...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'nonexistent-app-xyz' } });
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByText(/No images matched "nonexistent-app-xyz"/i)).toBeDefined();
    });
  });

  it('handles API errors in Docker Registry gracefully', async () => {
    (globalThis as any).go.main.App.SearchDockerHub = vi.fn().mockRejectedValue(new Error('API Rate Limit Exceeded'));

    vi.useFakeTimers();
    render(<ResourceManager isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getAllByText('Docker Hub Registry')[0]);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    const searchInput = screen.getByPlaceholderText('Search Docker Hub...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'error-trigger' } });
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByText('Offline / API Limit Exceeded')).toBeDefined();
    });
  });
});
