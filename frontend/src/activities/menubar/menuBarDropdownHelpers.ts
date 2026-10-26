import { cn } from '@/lib/utils';

export interface MenuItem {
  label: string;
  icon?: any;
  onClick: () => void;
  shortcut?: string;
  type?: 'separator';
  checked?: boolean;
}

export interface MenuBarDropdownProps {
  readonly menu: {
    readonly label: string;
    readonly items: readonly MenuItem[];
  };
  readonly activeMenu: string | null;
  readonly setActiveMenu: (label: string | null) => void;
  readonly colorMode: 'dark' | 'light';
  readonly onMenuClick?: (label: string) => void;
}

export interface MenuItemButtonProps {
  readonly item: MenuItem;
  readonly isDark: boolean;
  readonly hasIconsOrChecks: boolean;
  readonly onItemClick: (item: MenuItem) => void;
}

/**
 * Checks if any item in the menu has an icon or a checked state.
 * When true, items will align vertically with a dedicated 16px slot.
 */
export const hasIconsOrCheckmarks = (items: readonly MenuItem[]): boolean => {
  return items.some((item) => item.icon !== undefined || typeof item.checked === 'boolean');
};

/**
 * Returns the CSS classes for the menubar dropdown header button.
 */
export const getDropdownTriggerClasses = (isOpen: boolean, isDark: boolean): string => {
  const activeClasses = isDark ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-900";
  const inactiveClasses = isDark ? "hover:bg-slate-800" : "hover:bg-slate-200";

  return cn("menubar-dropdown-btn", isOpen ? activeClasses : inactiveClasses);
};

/**
 * Resolves the next active menu label when a dropdown header button is clicked.
 */
export const resolveNextActiveMenu = (
  menuLabel: string,
  currentActiveMenu: string | null,
  onMenuClick?: (label: string) => void
): string | null => {
  if (onMenuClick) {
    onMenuClick(menuLabel);
  }
  if (menuLabel === 'File') {
    return null;
  }
  return currentActiveMenu === menuLabel ? null : menuLabel;
};

/**
 * Executes the click handler for a menu item and closes the dropdown if it is not a checkbox toggle.
 */
export const executeMenuItemClick = (
  item: MenuItem,
  closeMenu: () => void
): void => {
  item.onClick();
  if (typeof item.checked !== 'boolean') {
    closeMenu();
  }
};
