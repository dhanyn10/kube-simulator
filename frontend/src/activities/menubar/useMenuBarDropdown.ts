import {
  MenuItem,
  MenuBarDropdownProps,
  hasIconsOrCheckmarks,
  getDropdownTriggerClasses,
  resolveNextActiveMenu,
  executeMenuItemClick,
} from './menuBarDropdownHelpers';

export const useMenuBarDropdown = ({
  menu,
  activeMenu,
  setActiveMenu,
  colorMode,
  onMenuClick,
}: MenuBarDropdownProps) => {
  const isOpen = activeMenu === menu.label;
  const isDark = colorMode === 'dark';
  const hasIconsOrChecks = hasIconsOrCheckmarks(menu.items);
  const buttonClasses = getDropdownTriggerClasses(isOpen, isDark);

  const handleHeaderClick = () => {
    const nextActive = resolveNextActiveMenu(menu.label, activeMenu, onMenuClick);
    setActiveMenu(nextActive);
  };

  const handleMouseEnter = () => {
    if (activeMenu && menu.label !== 'File') {
      setActiveMenu(menu.label);
    }
  };

  const handleItemClick = (item: MenuItem) => {
    executeMenuItemClick(item, () => setActiveMenu(null));
  };

  return {
    isOpen,
    isDark,
    buttonClasses,
    hasIconsOrChecks,
    handleHeaderClick,
    handleMouseEnter,
    handleItemClick,
  };
};
