import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfigMapComponentSection } from '@/components/Modals/ConfigMapComponentSection';

describe('ConfigMapComponentSection (Tagify)', () => {
  const defaultProps = {
    attachedComponents: [{ id: 'dep-1', label: 'web-api', type: 'Deployment' }, { id: 'pod-1', label: 'nginx', type: 'Pod' }],
    availableComponents: [{ id: 'dep-1', label: 'web-api', type: 'Deployment' }, { id: 'pod-1', label: 'nginx', type: 'Pod' }, { id: 'stateful-1', label: 'redis-db', type: 'StatefulSet' }],
    onRemoveComponent: vi.fn(),
    onAttachComponent: vi.fn(),
    isDark: true,
  };

  it('renders attached component tag chips with X remove button like Tagify', () => {
    render(<ConfigMapComponentSection {...defaultProps} />);

    expect(screen.getByText('Related Components')).toBeInTheDocument();
    expect(screen.queryByText(/Komponen Terkait/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('attached-component-tag-dep-1')).toHaveTextContent('Deployment:web-api');
    expect(screen.getByTestId('attached-component-tag-pod-1')).toHaveTextContent('Pod:nginx');

    const removeBtn = screen.getByTestId('remove-component-tag-dep-1');
    expect(removeBtn).toBeInTheDocument();

    fireEvent.click(removeBtn);
    expect(defaultProps.onRemoveComponent).toHaveBeenCalledWith('dep-1');
  });

  it('opens Tagify suggestions dropdown when focusing input and attaches selected component', () => {
    const onAttach = vi.fn();
    render(<ConfigMapComponentSection {...defaultProps} onAttachComponent={onAttach} />);

    const input = screen.getByPlaceholderText('Add more components...');
    fireEvent.focus(input);

    // Dropdown shows unattached component 'redis-db'
    expect(screen.getByTestId('tagify-suggestions-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('tagify-suggestion-stateful-1')).toHaveTextContent('StatefulSetredis-db');

    // Click suggestion onMouseDown
    fireEvent.mouseDown(screen.getByTestId('tagify-suggestion-stateful-1'));
    expect(onAttach).toHaveBeenCalledWith({
      id: 'stateful-1',
      label: 'redis-db',
      type: 'StatefulSet',
    });
  });

  it('handles keyboard navigation and Enter to select from Tagify suggestions', () => {
    const onAttach = vi.fn();
    render(<ConfigMapComponentSection {...defaultProps} onAttachComponent={onAttach} />);

    const input = screen.getByPlaceholderText('Add more components...');
    fireEvent.focus(input);

    // Press ArrowDown then Enter
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAttach).toHaveBeenCalledWith({
      id: 'stateful-1',
      label: 'redis-db',
      type: 'StatefulSet',
    });
  });

  it('handles Backspace on empty input to remove the last attached component like Tagify', () => {
    const onRemove = vi.fn();
    render(<ConfigMapComponentSection {...defaultProps} onRemoveComponent={onRemove} />);

    const input = screen.getByPlaceholderText('Add more components...');
    fireEvent.keyDown(input, { key: 'Backspace' });

    expect(onRemove).toHaveBeenCalledWith('pod-1');
  });

  it('renders empty placeholder when no components are attached and handles escape', () => {
    render(<ConfigMapComponentSection {...defaultProps} attachedComponents={[]} />);

    const input = screen.getByPlaceholderText('Attach component (e.g. Deployment, Pod)...');
    expect(input).toBeInTheDocument();

    fireEvent.focus(input);
    expect(screen.getByTestId('tagify-suggestions-dropdown')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('tagify-suggestions-dropdown')).not.toBeInTheDocument();
  });

  it('filters suggestions by text input, highlights with mouseEnter and handles ArrowUp and Tab', () => {
    vi.useFakeTimers();
    const onAttach = vi.fn();
    render(
      <ConfigMapComponentSection
        {...defaultProps}
        onAttachComponent={onAttach}
        accentColor="indigo"
        isDark={false}
      />
    );

    const input = screen.getByPlaceholderText('Add more components...');
    fireEvent.focus(input);

    // Filter by typing 'redis'
    fireEvent.change(input, { target: { value: 'redis' } });
    const suggestion = screen.getByTestId('tagify-suggestion-stateful-1');
    expect(suggestion).toBeInTheDocument();

    // Hover mouse
    fireEvent.mouseEnter(suggestion);

    // ArrowUp then Tab
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onAttach).toHaveBeenCalledWith({
      id: 'stateful-1',
      label: 'redis-db',
      type: 'StatefulSet',
    });

    // Filter by non-matching query
    fireEvent.change(input, { target: { value: 'nomatch' } });
    expect(screen.getByText(/No matching components found for "nomatch"/i)).toBeInTheDocument();

    // Blur input with delay
    fireEvent.blur(input);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByTestId('tagify-suggestions-dropdown')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('displays "All available components attached" message when all components are in attached list', () => {
    const allAttached = [
      { id: 'dep-1', label: 'web-api', type: 'Deployment' },
      { id: 'pod-1', label: 'nginx', type: 'Pod' },
      { id: 'stateful-1', label: 'redis-db', type: 'StatefulSet' },
    ];
    render(
      <ConfigMapComponentSection
        {...defaultProps}
        attachedComponents={allAttached}
        accentColor="teal"
        isDark={true}
      />
    );

    const input = screen.getByPlaceholderText('Add more components...');
    fireEvent.focus(input);

    expect(screen.getByText('All available components attached')).toBeInTheDocument();
  });

  it('renders light mode with teal and rose accents and unselected suggestions', () => {
    const { rerender } = render(
      <ConfigMapComponentSection
        {...defaultProps}
        attachedComponents={[{ id: 'dep-1', label: 'web-api', type: 'Deployment' }]}
        availableComponents={[
          { id: 'dep-1', label: 'web-api', type: 'Deployment' },
          { id: 'pod-1', label: 'nginx', type: 'Pod' },
          { id: 'stateful-1', label: 'redis-db', type: 'StatefulSet' },
        ]}
        accentColor="teal"
        isDark={false}
      />
    );

    const input = screen.getByPlaceholderText('Add more components...');
    fireEvent.focus(input);

    expect(screen.getByTestId('tagify-suggestion-pod-1')).toBeInTheDocument();
    expect(screen.getByTestId('tagify-suggestion-stateful-1')).toBeInTheDocument();

    // Rerender with rose accent
    rerender(
      <ConfigMapComponentSection
        {...defaultProps}
        attachedComponents={[{ id: 'dep-1', label: 'web-api', type: 'Deployment' }]}
        availableComponents={[
          { id: 'dep-1', label: 'web-api', type: 'Deployment' },
          { id: 'pod-1', label: 'nginx', type: 'Pod' },
        ]}
        accentColor="rose"
        isDark={false}
      />
    );
    expect(screen.getByTestId('attached-component-tag-dep-1')).toBeInTheDocument();
  });
});
