import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TagInput } from '@/components/Modals/role/TagInput';
import { useFlowStore } from '@/store';

describe('TagInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders existing tags, including empty string as Core API, and custom placeholder', () => {
    const onChange = vi.fn();
    render(
      <TagInput
        id="test-tag-input"
        tags={['', 'apps', 'custom-tag']}
        onChange={onChange}
        placeholder="Select resources..."
        colorMode="dark"
      />
    );

    expect(screen.getByText('Core API')).toBeInTheDocument();
    expect(screen.getByText('apps')).toBeInTheDocument();
    expect(screen.getByText('custom-tag')).toBeInTheDocument();
  });

  it('removes tag and stops propagation when remove button is clicked', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TagInput
        tags={['pods', 'deployments', 'services']}
        onChange={onChange}
        colorMode="dark"
      />
    );

    // Each tag has a remove button containing an X icon
    const removeButtons = container.querySelectorAll('button[type="button"]');
    expect(removeButtons).toHaveLength(3);

    // Click remove button on the second tag ('deployments')
    fireEvent.click(removeButtons[1]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['pods', 'services']);
  });

  it('removes last tag on Backspace key when input is empty', () => {
    const onChange = vi.fn();
    render(
      <TagInput
        tags={['pods', 'services']}
        onChange={onChange}
        colorMode="dark"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Backspace' });

    expect(onChange).toHaveBeenCalledWith(['pods']);
  });

  it('adds tags using Enter and comma keys, trimming whitespace and ignoring duplicates', () => {
    const onChange = vi.fn();
    render(
      <TagInput
        tags={['pods']}
        onChange={onChange}
        colorMode="light"
      />
    );

    const input = screen.getByRole('textbox');

    // Add new tag with Enter
    fireEvent.change(input, { target: { value: 'services' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['pods', 'services']);

    // Attempt to add duplicate tag
    fireEvent.change(input, { target: { value: 'pods' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);

    // Add tag with comma
    fireEvent.change(input, { target: { value: 'deployments' } });
    fireEvent.keyDown(input, { key: ',' });
    expect(onChange).toHaveBeenCalledWith(['pods', 'deployments']);

    // Add empty input does nothing
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('converts "Core API" and "core" input to empty string tag', () => {
    const onChange = vi.fn();
    render(
      <TagInput
        tags={[]}
        onChange={onChange}
        colorMode="dark"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'core api' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['']);

    fireEvent.change(input, { target: { value: 'core' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['']);
  });

  it('instantiates missing resource on canvas when adding known K8s resource and logs action', () => {
    const addNode = vi.fn();
    const addLog = vi.fn();
    useFlowStore.setState({
      nodes: [],
      addNode,
      addLog,
    });

    const onChange = vi.fn();
    render(
      <TagInput
        tags={[]}
        onChange={onChange}
        colorMode="dark"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'pods' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(addNode).toHaveBeenCalledWith('Pod');
    expect(addLog).toHaveBeenCalledWith(
      'info',
      expect.stringContaining("Instantiated missing resource 'Pod'"),
      'UI'
    );
  });

  it('does not instantiate resource if it is already present on canvas', () => {
    const addNode = vi.fn();
    const addLog = vi.fn();
    useFlowStore.setState({
      nodes: [{ id: 'pod-1', type: 'Pod', data: {} } as any],
      addNode,
      addLog,
    });

    const onChange = vi.fn();
    render(
      <TagInput
        tags={[]}
        onChange={onChange}
        colorMode="dark"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'pods' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(addNode).not.toHaveBeenCalled();
  });

  it('displays suggestions in dropdown and handles hover and click selection', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TagInput
        tags={['deployments']}
        suggestions={['pods', 'deployments', 'services', '']}
        onChange={onChange}
        colorMode="dark"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    // 'deployments' is already in tags, so pods, services, and Core API should show up
    expect(screen.getByText('pods')).toBeInTheDocument();
    expect(screen.getByText('services')).toBeInTheDocument();
    expect(screen.getByText('Core API')).toBeInTheDocument();

    // Hovering over an item triggers onHoverIndex (line 229)
    const itemRows = container.querySelectorAll('[data-item-index]');
    expect(itemRows.length).toBeGreaterThan(0);
    fireEvent.mouseEnter(itemRows[1]);

    // Clicking an item in dropdown triggers onSelect
    const podsButton = screen.getByText('pods');
    fireEvent.mouseDown(podsButton);

    expect(onChange).toHaveBeenCalledWith(['deployments', 'pods']);
  });

  it('navigates autocomplete dropdown with arrow keys and selects via Enter or Tab', () => {
    const onChange = vi.fn();
    render(
      <TagInput
        tags={[]}
        suggestions={['pods', 'services', 'configmaps']}
        onChange={onChange}
        colorMode="dark"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    // Arrow down to highlight second suggestion ('services')
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Arrow up to go back to first suggestion ('pods')
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    // Enter to select
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['pods']);
  });

  it('selects suggestion via Tab key and cycles navigation on boundary', () => {
    const onChange = vi.fn();
    render(
      <TagInput
        tags={[]}
        suggestions={['pods', 'services']}
        onChange={onChange}
        colorMode="dark"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    // Arrow up from 0 cycles to last item ('services')
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    // Tab key selects highlighted item
    fireEvent.keyDown(input, { key: 'Tab' });

    expect(onChange).toHaveBeenCalledWith(['services']);
  });

  it('closes dropdown on Escape key', () => {
    render(
      <TagInput
        tags={[]}
        suggestions={['pods', 'services']}
        onChange={vi.fn()}
        colorMode="dark"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    expect(screen.getByText('pods')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('pods')).not.toBeInTheDocument();
  });

  it('closes dropdown after blur timeout of 150ms', () => {
    vi.useFakeTimers();

    render(
      <TagInput
        tags={[]}
        suggestions={['pods']}
        onChange={vi.fn()}
        colorMode="dark"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    expect(screen.getByText('pods')).toBeInTheDocument();

    fireEvent.blur(input);
    // Before timeout finishes, dropdown remains
    expect(screen.getByText('pods')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    // After 150ms timeout, dropdown is closed
    expect(screen.queryByText('pods')).not.toBeInTheDocument();
  });

  it('supports custom tagBgClass and renders placeholder when tags array is empty', () => {
    render(
      <TagInput
        tags={[]}
        onChange={vi.fn()}
        placeholder="Enter custom tag..."
        tagBgClass="custom-bg-class"
        colorMode="light"
      />
    );

    const input = screen.getByPlaceholderText('Enter custom tag...');
    expect(input).toBeInTheDocument();
  });

  it('calculates openUpward position based on container bounding rect and scroll parent', () => {
    const { container } = render(
      <div className="overflow-y-auto" style={{ height: '300px' }}>
        <TagInput
          tags={[]}
          suggestions={['pods']}
          onChange={vi.fn()}
          colorMode="dark"
        />
      </div>
    );

    // Mock getBoundingClientRect
    const containerEl = container.querySelector('.space-y-1');
    const scrollParentEl = container.querySelector('.overflow-y-auto');

    if (containerEl && scrollParentEl) {
      vi.spyOn(containerEl, 'getBoundingClientRect').mockReturnValue({
        bottom: 280,
        top: 240,
        left: 0,
        right: 200,
        width: 200,
        height: 40,
        x: 0,
        y: 240,
        toJSON: () => {},
      });
      vi.spyOn(scrollParentEl, 'getBoundingClientRect').mockReturnValue({
        bottom: 300,
        top: 0,
        left: 0,
        right: 200,
        width: 200,
        height: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
    }

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'p' } });

    expect(screen.getByText('pods')).toBeInTheDocument();
  });
});
