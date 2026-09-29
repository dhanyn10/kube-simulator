import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TagsView, TagsViewProps } from '@/components/UI/ResourceManager/TagsView';

const mockFetchDockerHubTags = vi.fn();

vi.mock('@wailsjs/go/main/App', () => ({
  FetchDockerHubTags: (...args: any[]) => mockFetchDockerHubTags(...args),
}));

describe('TagsView', () => {
  const defaultProps: TagsViewProps = {
    repoName: 'library/nginx',
    onBack: vi.fn(),
    colorMode: 'dark',
    customImages: ['library/nginx:1.25'],
    addCustomImage: vi.fn(),
    deleteCustomImage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then tag items when data resolves', async () => {
    mockFetchDockerHubTags.mockResolvedValueOnce(
      JSON.stringify({
        results: [{ name: 'latest' }, { name: '1.25' }],
      })
    );

    render(<TagsView {...defaultProps} />);

    expect(screen.getByText(/Tags for library\/nginx/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('library/nginx:latest')).toBeInTheDocument();
      expect(screen.getByText('library/nginx:1.25')).toBeInTheDocument();
    });

    // Test back button
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    expect(defaultProps.onBack).toHaveBeenCalled();

    // Click "+ ADD OPTION" for latest
    fireEvent.click(screen.getByRole('button', { name: /\+ ADD OPTION/i }));
    expect(defaultProps.addCustomImage).toHaveBeenCalledWith('library/nginx:latest');

    // Click "ADDED" for 1.25
    fireEvent.click(screen.getByRole('button', { name: /ADDED/i }));
    expect(defaultProps.deleteCustomImage).toHaveBeenCalledWith('library/nginx:1.25');
  });

  it('renders error state when FetchDockerHubTags rejects or returns falsy rawData', async () => {
    mockFetchDockerHubTags.mockRejectedValueOnce(new Error('Network offline'));

    render(<TagsView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load tags')).toBeInTheDocument();
      expect(screen.getByText('Network offline')).toBeInTheDocument();
    });
  });

  it('renders fallback error message when error object has no message string', async () => {
    mockFetchDockerHubTags.mockRejectedValueOnce({});

    render(<TagsView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText('Failed to load tags')).toHaveLength(2);
    });
  });

  it('renders empty message when tags results array is empty or falsy', async () => {
    mockFetchDockerHubTags.mockResolvedValueOnce(JSON.stringify({ results: [] }));

    render(<TagsView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No tags found for "library/nginx"')).toBeInTheDocument();
    });
  });

  it('renders empty message when backend returns null/falsy rawData', async () => {
    mockFetchDockerHubTags.mockResolvedValueOnce(null);

    render(<TagsView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load tags')).toBeInTheDocument();
      expect(screen.getByText('Failed to retrieve tags from backend')).toBeInTheDocument();
    });
  });

  it('renders tags in light mode', async () => {
    mockFetchDockerHubTags.mockResolvedValueOnce(
      JSON.stringify({
        results: [{ name: 'alpine' }],
      })
    );

    render(<TagsView {...defaultProps} colorMode="light" customImages={[]} />);

    await waitFor(() => {
      expect(screen.getByText('library/nginx:alpine')).toBeInTheDocument();
    });
  });
});
