import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { YamlSearchBar } from '@/components/Modals/YamlSearchBar';

describe('YamlSearchBar', () => {
  it('renders search input with placeholder and header in dark and light modes', () => {
    const onQueryChange = vi.fn();
    const { rerender } = render(
      <YamlSearchBar
        query=""
        onQueryChange={onQueryChange}
        totalMatches={0}
        activeIndex={0}
        onNextMatch={vi.fn()}
        onPrevMatch={vi.fn()}
        onClear={vi.fn()}
        colorMode="dark"
      />
    );

    const input = screen.getByTestId('yaml-search-input');
    expect(input).toBeDefined();
    expect(screen.queryByTestId('yaml-search-count')).toBeNull();

    rerender(
      <YamlSearchBar
        query=""
        onQueryChange={onQueryChange}
        totalMatches={0}
        activeIndex={0}
        onNextMatch={vi.fn()}
        onPrevMatch={vi.fn()}
        onClear={vi.fn()}
        colorMode="light"
      />
    );
    expect(input).toBeDefined();
  });

  it('invokes onQueryChange when user types in the input', () => {
    const onQueryChange = vi.fn();
    render(
      <YamlSearchBar
        query="po"
        onQueryChange={onQueryChange}
        totalMatches={0}
        activeIndex={0}
        onNextMatch={vi.fn()}
        onPrevMatch={vi.fn()}
        onClear={vi.fn()}
        colorMode="dark"
      />
    );

    const input = screen.getByTestId('yaml-search-input');
    fireEvent.change(input, { target: { value: 'port' } });
    expect(onQueryChange).toHaveBeenCalledWith('port');
  });

  it('displays match count and navigates matches via buttons and shortcuts', () => {
    const onNextMatch = vi.fn();
    const onPrevMatch = vi.fn();
    const onClear = vi.fn();

    const { rerender } = render(
      <YamlSearchBar
        query="port"
        onQueryChange={vi.fn()}
        totalMatches={3}
        activeIndex={1}
        onNextMatch={onNextMatch}
        onPrevMatch={onPrevMatch}
        onClear={onClear}
        colorMode="dark"
      />
    );

    const countBadge = screen.getByTestId('yaml-search-count');
    expect(countBadge.textContent).toContain('2 of 3');
    expect(countBadge.className).toContain('text-amber-300');

    // Click Next
    fireEvent.click(screen.getByTestId('yaml-search-next'));
    expect(onNextMatch).toHaveBeenCalledTimes(1);

    // Click Prev
    fireEvent.click(screen.getByTestId('yaml-search-prev'));
    expect(onPrevMatch).toHaveBeenCalledTimes(1);

    // Click Clear
    fireEvent.click(screen.getByTestId('yaml-search-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);

    // Rerender with 0 matches in light mode
    rerender(
      <YamlSearchBar
        query="missing"
        onQueryChange={vi.fn()}
        totalMatches={0}
        activeIndex={0}
        onNextMatch={onNextMatch}
        onPrevMatch={onPrevMatch}
        onClear={onClear}
        colorMode="light"
      />
    );

    const countZeroBadge = screen.getByTestId('yaml-search-count');
    expect(countZeroBadge.className).toContain('text-rose-700');
    const nextBtn = screen.getByTestId('yaml-search-next') as HTMLButtonElement;
    const prevBtn = screen.getByTestId('yaml-search-prev') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
    expect(prevBtn.disabled).toBe(true);
  });

  it('handles keyboard shortcuts (Enter for next, Shift+Enter for prev, Escape for clear)', () => {
    const onNextMatch = vi.fn();
    const onPrevMatch = vi.fn();
    const onClear = vi.fn();

    render(
      <YamlSearchBar
        query="service"
        onQueryChange={vi.fn()}
        totalMatches={5}
        activeIndex={0}
        onNextMatch={onNextMatch}
        onPrevMatch={onPrevMatch}
        onClear={onClear}
        colorMode="dark"
      />
    );

    const input = screen.getByTestId('yaml-search-input');

    // Enter
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    expect(onNextMatch).toHaveBeenCalledTimes(1);

    // Shift + Enter
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onPrevMatch).toHaveBeenCalledTimes(1);

    // Escape
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClear).toHaveBeenCalledTimes(1);

    // Other key
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onNextMatch).toHaveBeenCalledTimes(1);
  });
});
