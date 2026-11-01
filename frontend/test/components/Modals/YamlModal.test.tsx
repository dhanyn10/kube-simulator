import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { YamlModal } from '@/components/Modals/YamlModal';
import '@testing-library/jest-dom';

describe('YamlModal', () => {
  const content = 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: my-pod';
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders content correctly', () => {
    render(<YamlModal content={content} colorMode="dark" onClose={mockOnClose} />);
    expect(screen.getByText(/apiVersion: v1/)).toBeDefined();
    expect(screen.getByText('Kubernetes Manifest Output')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    render(<YamlModal content={content} colorMode="dark" onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('copies content to clipboard', async () => {
    render(<YamlModal content={content} colorMode="dark" onClose={mockOnClose} />);
    const copyBtn = screen.getByText('Copy');

    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(content);

    await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeDefined();
    });
  });

  it('closes on Escape key or backdrop click and ignores non-Escape keys', () => {
    render(<YamlModal content={content} colorMode="light" onClose={mockOnClose} />);

    // Click backdrop
    const backdrop = document.querySelector('button.fixed.inset-0');
    if (backdrop) fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Non-Escape key should not trigger onClose
    fireEvent.keyDown(globalThis, { key: 'Enter' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Escape key triggers onClose
    fireEvent.keyDown(globalThis, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  it('renders default message when content is empty and handles copy failure', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard write error')),
      },
    });

    render(<YamlModal content="" colorMode="light" onClose={mockOnClose} />);
    expect(screen.getByText('# No resources generated yet.')).toBeDefined();

    const copyBtn = screen.getByText('Copy');
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('');
  });

  it('displays auto-beautified badge and automatically formats JSON manifests into clean YAML', () => {
    const rawJsonManifest = JSON.stringify([
      { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'my-cm' }, data: { ENV: 'prod' } }
    ]);
    render(<YamlModal content={rawJsonManifest} colorMode="dark" onClose={mockOnClose} />);

    expect(screen.getByTestId('auto-beautified-badge')).toBeInTheDocument();
    expect(screen.getByText('Auto-Beautified')).toBeInTheDocument();
    expect(screen.getByText(/kind: ConfigMap/)).toBeInTheDocument();
    expect(screen.getByText(/name: my-cm/)).toBeInTheDocument();
  });

  it('copies auto-beautified YAML to clipboard even if raw input was unformatted JSON', async () => {
    const rawJsonManifest = JSON.stringify({ apiVersion: 'v1', kind: 'Secret', metadata: { name: 'sec' } });
    render(<YamlModal content={rawJsonManifest} colorMode="dark" onClose={mockOnClose} />);

    const copyBtn = screen.getByText('Copy');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "apiVersion: v1\nkind: Secret\nmetadata:\n  name: sec"
    );
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeDefined();
    });
  });

  describe('Manifest Search feature', () => {
    const yamlSample = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: web
        image: nginx:latest
        ports:
        - containerPort: 80`;

    it('allows user to search keywords, highlights matches, and displays match counter', () => {
      render(<YamlModal content={yamlSample} colorMode="dark" onClose={mockOnClose} />);

      const searchInput = screen.getByTestId('yaml-search-input');
      expect(searchInput).toBeInTheDocument();

      // Search for keyword 'web-app' (appears twice in name and labels)
      fireEvent.change(searchInput, { target: { value: 'web-app' } });

      expect(screen.getByTestId('yaml-search-count')).toHaveTextContent('1 of 2');

      const matches = document.querySelectorAll('mark[data-match-index]');
      expect(matches).toHaveLength(2);
      expect(matches[0]).toHaveAttribute('data-active-match', 'true');
      expect(matches[1]).not.toHaveAttribute('data-active-match');
    });

    it('navigates next and previous matches using buttons and Enter/Shift+Enter keys', () => {
      render(<YamlModal content={yamlSample} colorMode="light" onClose={mockOnClose} />);

      const searchInput = screen.getByTestId('yaml-search-input');
      fireEvent.change(searchInput, { target: { value: 'web-app' } });

      const nextBtn = screen.getByTestId('yaml-search-next');
      const prevBtn = screen.getByTestId('yaml-search-prev');

      // Click next -> match 2 of 2
      fireEvent.click(nextBtn);
      expect(screen.getByTestId('yaml-search-count')).toHaveTextContent('2 of 2');

      // Click next again -> wraps to 1 of 2
      fireEvent.click(nextBtn);
      expect(screen.getByTestId('yaml-search-count')).toHaveTextContent('1 of 2');

      // Click prev -> wraps back to 2 of 2
      fireEvent.click(prevBtn);
      expect(screen.getByTestId('yaml-search-count')).toHaveTextContent('2 of 2');

      // Enter key -> advances to 1 of 2
      fireEvent.keyDown(searchInput, { key: 'Enter', shiftKey: false });
      expect(screen.getByTestId('yaml-search-count')).toHaveTextContent('1 of 2');

      // Shift + Enter key -> goes back to 2 of 2
      fireEvent.keyDown(searchInput, { key: 'Enter', shiftKey: true });
      expect(screen.getByTestId('yaml-search-count')).toHaveTextContent('2 of 2');
    });

    it('handles no matches gracefully and disables navigation buttons', () => {
      render(<YamlModal content={yamlSample} colorMode="dark" onClose={mockOnClose} />);

      const searchInput = screen.getByTestId('yaml-search-input');
      fireEvent.change(searchInput, { target: { value: 'nonexistent-config-key' } });

      expect(screen.getByTestId('yaml-search-count')).toHaveTextContent('No matches');
      expect(screen.getByTestId('yaml-search-next')).toBeDisabled();
      expect(screen.getByTestId('yaml-search-prev')).toBeDisabled();
    });

    it('clears search query using clear button and Escape key inside search input', () => {
      render(<YamlModal content={yamlSample} colorMode="dark" onClose={mockOnClose} />);

      const searchInput = screen.getByTestId('yaml-search-input');
      fireEvent.change(searchInput, { target: { value: 'replicas' } });
      expect(screen.getByTestId('yaml-search-count')).toHaveTextContent('1 of 1');

      // Clear via clear button
      const clearBtn = screen.getByTestId('yaml-search-clear');
      fireEvent.click(clearBtn);
      expect(searchInput).toHaveValue('');
      expect(screen.queryByTestId('yaml-search-count')).not.toBeInTheDocument();

      // Type again and clear via Escape key
      fireEvent.change(searchInput, { target: { value: 'image' } });
      expect(screen.getByTestId('yaml-search-count')).toBeInTheDocument();
      fireEvent.keyDown(searchInput, { key: 'Escape' });
      expect(searchInput).toHaveValue('');
      expect(screen.queryByTestId('yaml-search-count')).not.toBeInTheDocument();
      // Modal should not close when Escape is used to clear search input
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
