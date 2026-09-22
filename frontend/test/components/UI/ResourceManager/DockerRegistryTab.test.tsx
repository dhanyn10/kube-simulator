import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DockerRegistryTab, DockerRegistryTabProps } from '@/components/UI/ResourceManager/DockerRegistryTab';
import { DEFAULT_REGISTRY_IMAGES } from '@/constants/config';

// Mock Wails App functions
const mockFetchDockerHubPopular = vi.fn();
const mockSearchDockerHub = vi.fn();
const mockFetchDockerHubTags = vi.fn();

(globalThis as any).go = {
  main: {
    App: {
      FetchDockerHubPopular: mockFetchDockerHubPopular,
      SearchDockerHub: mockSearchDockerHub,
      FetchDockerHubTags: mockFetchDockerHubTags,
    },
  },
};

describe('DockerRegistryTab', () => {
  const defaultProps: DockerRegistryTabProps = {
    dockerSearch: '',
    setDockerSearch: vi.fn(),
    colorMode: 'dark',
    customImages: [],
    addCustomImage: vi.fn(),
    deleteCustomImage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFetchDockerHubPopular.mockResolvedValue(JSON.stringify({
      results: [
        { name: 'nginx', description: 'Official build of Nginx.' },
        { name: 'redis', description: 'In-memory data structure store' }
      ]
    }));
    mockSearchDockerHub.mockResolvedValue(JSON.stringify({
      results: [
        { repo_name: 'my-custom-app', short_description: 'My custom app' }
      ]
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders default registry images initially and fetches popular images in dark mode', async () => {
    render(<DockerRegistryTab {...defaultProps} colorMode="dark" />);

    expect(screen.getByText('Docker Hub Registry')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search Docker Hub...')).toBeInTheDocument();

    // Advance timer for 400ms debounce
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(mockFetchDockerHubPopular).toHaveBeenCalled();
    expect(screen.getByText('nginx')).toBeInTheDocument();
    expect(screen.getByText('redis')).toBeInTheDocument();
  });

  it('renders in light mode with proper styling classes', async () => {
    render(<DockerRegistryTab {...defaultProps} colorMode="light" />);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    const input = screen.getByPlaceholderText('Search Docker Hub...');
    expect(input.className).toContain('bg-slate-50');
  });

  it('handles user search input change', async () => {
    const setDockerSearch = vi.fn();
    render(<DockerRegistryTab {...defaultProps} setDockerSearch={setDockerSearch} />);

    const input = screen.getByPlaceholderText('Search Docker Hub...');
    fireEvent.change(input, { target: { value: 'my-custom-app' } });

    expect(setDockerSearch).toHaveBeenCalledWith('my-custom-app');
  });

  it('fetches search results when dockerSearch is non-empty', async () => {
    render(<DockerRegistryTab {...defaultProps} dockerSearch="my-custom-app" />);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(mockSearchDockerHub).toHaveBeenCalledWith('my-custom-app');
    expect(screen.getByText('my-custom-app')).toBeInTheDocument();
  });

  it('resets to default registry images when popular fetch returns empty results', async () => {
    mockFetchDockerHubPopular.mockResolvedValue(JSON.stringify({ results: [] }));

    render(<DockerRegistryTab {...defaultProps} dockerSearch="" />);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(mockFetchDockerHubPopular).toHaveBeenCalled();
    expect(screen.getByText(DEFAULT_REGISTRY_IMAGES[0].name)).toBeInTheDocument();
  });

  it('handles empty data returned from backend rawData as null', async () => {
    mockFetchDockerHubPopular.mockResolvedValue(null);

    render(<DockerRegistryTab {...defaultProps} dockerSearch="" />);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // When dockerSearch is empty and API fails, it falls back to DEFAULT_REGISTRY_IMAGES
    expect(screen.getByText(DEFAULT_REGISTRY_IMAGES[0].name)).toBeInTheDocument();
  });

  it('handles search API failure with custom error message', async () => {
    mockSearchDockerHub.mockRejectedValue(new Error('Rate limit exceeded'));

    render(<DockerRegistryTab {...defaultProps} dockerSearch="error-query" />);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText('Offline / API Limit Exceeded')).toBeInTheDocument();
  });

  it('handles search API failure when error object lacks message property', async () => {
    mockSearchDockerHub.mockRejectedValue({});

    render(<DockerRegistryTab {...defaultProps} dockerSearch="no-message-query" />);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText('Offline / API Limit Exceeded')).toBeInTheDocument();
  });

  it('handles search API returning empty list of images', async () => {
    mockSearchDockerHub.mockResolvedValue(JSON.stringify({ results: [] }));

    render(<DockerRegistryTab {...defaultProps} dockerSearch="nonexistent-term" />);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText('No images matched "nonexistent-term"')).toBeInTheDocument();
  });

  it('handles unmounting component while fetch is pending (!active branch)', async () => {
    let resolvePromise: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockFetchDockerHubPopular.mockReturnValue(pendingPromise);

    const { unmount } = render(<DockerRegistryTab {...defaultProps} dockerSearch="" />);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Unmount before promise resolves
    unmount();

    // Resolve promise after unmount
    await act(async () => {
      resolvePromise(JSON.stringify({ results: [{ name: 'post-unmount-img' }] }));
    });
  });

  it('handles unmounting component when API call rejects (!active in catch block)', async () => {
    let rejectPromise: (err: any) => void = () => {};
    const pendingPromise = new Promise((_, reject) => {
      rejectPromise = reject;
    });
    mockFetchDockerHubPopular.mockReturnValue(pendingPromise);

    const { unmount } = render(<DockerRegistryTab {...defaultProps} dockerSearch="" />);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Unmount before promise rejects
    unmount();

    // Reject promise after unmount
    await act(async () => {
      rejectPromise(new Error('Unmounted error'));
    });
  });

  it('handles clicking on an image card to navigate to TagsView and clicking back to return', async () => {
    mockFetchDockerHubTags.mockResolvedValue(JSON.stringify({
      results: [{ name: 'latest' }, { name: 'alpine' }]
    }));

    render(<DockerRegistryTab {...defaultProps} />);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    const card = screen.getByText('nginx');
    fireEvent.click(card);

    expect(screen.getByText('Tags for nginx')).toBeInTheDocument();

    // Click back button in TagsView
    const backButton = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backButton);

    expect(screen.getByText('Docker Hub Registry')).toBeInTheDocument();
  });
});
