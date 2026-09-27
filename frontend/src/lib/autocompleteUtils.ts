/**
 * Center the active item in a scrollable autocomplete dropdown container.
 *
 * Requirements:
 * - When moving to another item, center it vertically in the dropdown viewport.
 * - Except for items at the top end (index 0) or bottom end (last index) of the list.
 *
 * @param container - The scrollable dropdown container element
 * @param selectedIndex - Index of the currently active/hovered item
 * @param totalItems - Total count of items in the dropdown
 */
export const centerDropdownItem = (
  container: HTMLDivElement | null,
  selectedIndex: number,
  totalItems: number
): void => {
  if (!container || totalItems <= 0) return;

  const activeItem = container.querySelector(`[data-item-index="${selectedIndex}"]`) as HTMLElement | null;
  if (!activeItem) return;

  const maxScroll = container.scrollHeight - container.clientHeight;

  if (selectedIndex === 0) {
    container.scrollTop = 0;
    return;
  }

  if (selectedIndex === totalItems - 1) {
    container.scrollTop = Math.max(0, maxScroll);
    return;
  }

  const itemRect = activeItem.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const itemTopRelativeToContainer = itemRect.top - containerRect.top + container.scrollTop;
  const itemCenter = itemTopRelativeToContainer + itemRect.height / 2;
  const targetScroll = itemCenter - container.clientHeight / 2;

  container.scrollTop = Math.max(0, Math.min(maxScroll, targetScroll));
};
