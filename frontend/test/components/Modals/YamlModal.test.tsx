import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  it('closes on Escape key or backdrop click', () => {
    render(<YamlModal content={content} colorMode="light" onClose={mockOnClose} />);

    // Click backdrop
    const backdrop = document.querySelector('button.fixed.inset-0');
    if (backdrop) fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalled();

    fireEvent.keyDown(globalThis, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
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
});
