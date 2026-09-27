import { describe, it, expect, beforeEach, vi } from 'vitest';
import { centerDropdownItem } from '@/lib/autocompleteUtils';

describe('autocompleteUtils centerDropdownItem', () => {
  let container: HTMLDivElement;
  let items: HTMLDivElement[];

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(container, 'scrollHeight', { value: 300, configurable: true });
    container.scrollTop = 0;
    container.scrollTo = vi.fn(({ top }: ScrollToOptions) => {
      container.scrollTop = top ?? 0;
    });

    items = [];
    for (let i = 0; i < 6; i++) {
      const item = document.createElement('div');
      item.setAttribute('data-item-index', i.toString());
      Object.defineProperty(item, 'offsetHeight', { value: 50, configurable: true });
      Object.defineProperty(item, 'offsetTop', { value: i * 50, configurable: true });

      vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({
        top: i * 50,
        bottom: (i + 1) * 50,
        left: 0,
        right: 100,
        width: 100,
        height: 50,
        x: 0,
        y: i * 50,
        toJSON: () => {},
      });

      container.appendChild(item);
      items.push(item);
    }

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 100,
      left: 0,
      right: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
  });

  it('scrolls to 0 with smooth behavior when selectedIndex is 0 (top end item)', () => {
    container.scrollTop = 50;
    centerDropdownItem(container, 0, 6);
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(container.scrollTop).toBe(0);
  });

  it('scrolls to maxScroll with smooth behavior when selectedIndex is the last item (bottom end item)', () => {
    centerDropdownItem(container, 5, 6);
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 200, behavior: 'smooth' });
    expect(container.scrollTop).toBe(200); // 300 - 100 = 200
  });

  it('centers middle items vertically with smooth scroll behavior', () => {
    // For item 2 (top 100, height 50, center = 125):
    // targetScroll = 125 - 100 / 2 = 75
    centerDropdownItem(container, 2, 6);
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 75, behavior: 'smooth' });
    expect(container.scrollTop).toBe(75);
  });

  it('handles null or invalid parameters safely', () => {
    expect(() => centerDropdownItem(null, 0, 5)).not.toThrow();
    expect(() => centerDropdownItem(container, -1, 0)).not.toThrow();
  });
});
