import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ResourceManager, applyImageToSelectedNode } from '@/components/Modals/resource-manager/ResourceManager';
import { useFlowStore } from '@/store';

describe('ResourceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      customImages: ['custom-app:v1'],
      configuringNodeId: 'node-1',
      updateNodeData: vi.fn(),
      addCustomImage: vi.fn(),
      resourceManagerTargetImage: null,
    });
  });

  it('renders nothing when isOpen is false', () => {
    render(<ResourceManager isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Runtime & Container Image Manager')).toBeNull();
  });

  it('renders runtime setup images with numerical simulator variables when open', () => {
    render(<ResourceManager isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Resource Manager')).toBeDefined();
    expect(screen.getByText('openjdk:21-jdk-slim')).toBeDefined();
    expect(screen.getByText('golang:1.24-alpine')).toBeDefined();
    expect(screen.getByText('custom-app:v1')).toBeDefined();

    // Verify presence of numerical engine variable badges
    expect(screen.getAllByText(/TRF:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/RAM:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/START:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CPU:/i).length).toBeGreaterThan(0);
  });

  it('filters setup images via search input', () => {
    render(<ResourceManager isOpen={true} onClose={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/Filter runtime setup images/i);
    fireEvent.change(searchInput, { target: { value: 'golang' } });

    expect(screen.getByText('golang:1.24-alpine')).toBeDefined();
    expect(screen.queryByText('openjdk:21-jdk-slim')).toBeNull();
  });

  it('highlights target image and displays focused badge when targetImage prop is set', () => {
    const scrollIntoViewMock = vi.fn();
    globalThis.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(
      <ResourceManager
        isOpen={true}
        onClose={vi.fn()}
        targetImage="openjdk:21-jdk-slim"
      />
    );

    const targetCard = screen.getByTestId('resource-manager-item-openjdk:21-jdk-slim');
    expect(targetCard).toBeDefined();
    expect(targetCard.className).toContain('ring-2 ring-blue-500');
    expect(screen.getByText('Focused')).toBeDefined();
  });

  it('highlights target image from store state and handles light mode styling', () => {
    useFlowStore.setState({
      colorMode: 'light',
      resourceManagerTargetImage: 'golang:1.24-alpine',
    });

    render(<ResourceManager isOpen={true} onClose={vi.fn()} />);

    const targetCard = screen.getByTestId('resource-manager-item-golang:1.24-alpine');
    expect(targetCard).toBeDefined();
    expect(targetCard.className).toContain('ring-2 ring-blue-500');
    expect(screen.getByText('Focused')).toBeDefined();
  });

  it('applies image to active configuring workload node on Apply click', () => {
    const onClose = vi.fn();
    const updateNodeData = vi.fn();
    const addCustomImage = vi.fn();

    useFlowStore.setState({
      configuringNodeId: 'pod-1',
      updateNodeData,
      addCustomImage,
    });

    render(<ResourceManager isOpen={true} onClose={onClose} />);

    const applyBtns = screen.getAllByRole('button', { name: /Apply Image/i });
    expect(applyBtns.length).toBeGreaterThan(0);

    fireEvent.click(applyBtns[0]);

    expect(addCustomImage).toHaveBeenCalled();
    expect(updateNodeData).toHaveBeenCalledWith('pod-1', {
      image: expect.any(String),
      status: 'ready',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('handles image selection when configuringNodeId is null', () => {
    const onClose = vi.fn();
    const updateNodeData = vi.fn();
    const addCustomImage = vi.fn();

    useFlowStore.setState({
      configuringNodeId: null,
      updateNodeData,
      addCustomImage,
    });

    render(<ResourceManager isOpen={true} onClose={onClose} />);

    expect(screen.queryByRole('button', { name: /Apply Image/i })).toBeNull();
  });

  it('renders empty state when search matches no images', () => {
    render(<ResourceManager isOpen={true} onClose={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/Filter runtime setup images/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent-custom-image-xyz' } });

    expect(
      screen.getByText('No runtime images matched "nonexistent-custom-image-xyz"')
    ).toBeInTheDocument();
  });

  it('renders light-mode copy buttons and resets the copied state after the timeout', () => {
    vi.useFakeTimers();
    try {
      useFlowStore.setState({
        colorMode: 'light',
        configuringNodeId: null,
      });

      render(<ResourceManager isOpen={true} onClose={vi.fn()} />);

      const copyButtons = screen.getAllByRole('button', { name: /^Copy$/ });
      expect(copyButtons[0].className).toContain('bg-slate-100');

      fireEvent.click(copyButtons[0]);
      expect(screen.getAllByText('Copied')).toHaveLength(1);

      const remainingCopyButtons = screen.getAllByRole('button', { name: /^Copy$/ });
      fireEvent.click(remainingCopyButtons[0]);

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(screen.queryByText('Copied')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies an image only when a configuring node is selected', () => {
    const addCustomImage = vi.fn();
    const updateNodeData = vi.fn();

    applyImageToSelectedNode('golang:1.24-alpine', null, updateNodeData, addCustomImage);
    expect(addCustomImage).toHaveBeenCalledWith('golang:1.24-alpine');
    expect(updateNodeData).not.toHaveBeenCalled();

    applyImageToSelectedNode('golang:1.24-alpine', 'pod-1', updateNodeData, addCustomImage);
    expect(updateNodeData).toHaveBeenCalledWith('pod-1', {
      image: 'golang:1.24-alpine',
      status: 'ready',
    });
  });

  it('scrolls to and focuses the target image after opening', () => {
    vi.useFakeTimers();
    try {
      const scrollIntoViewMock = vi.fn();
      globalThis.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      render(
        <ResourceManager
          isOpen={true}
          onClose={vi.fn()}
          targetImage="golang:1.24-alpine"
        />
      );

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
