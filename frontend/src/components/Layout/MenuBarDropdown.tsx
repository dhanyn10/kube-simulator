import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
  label: string;
  icon?: any;
  onClick: () => void;
  shortcut?: string;
  type?: 'separator';
  checked?: boolean;
}

interface MenuBarDropdownProps {
  readonly menu: {
    readonly label: string;
    readonly items: readonly MenuItem[];
  };
  readonly activeMenu: string | null;
  readonly setActiveMenu: (label: string | null) => void;
  readonly colorMode: 'dark' | 'light';
  readonly onMenuClick?: (label: string) => void;
}

interface MenuItemButtonProps {
  readonly item: MenuItem;
  readonly isDark: boolean;
  readonly hasIconsOrChecks: boolean;
  readonly onItemClick: (item: MenuItem) => void;
}

const renderItemIconSlot = (item: MenuItem) => {
  if (typeof item.checked === 'boolean') {
    return item.checked ? <Check size={14} className="stroke-[2.5]" /> : null;
  }
  if (item.icon) {
    const IconComponent = item.icon;
    return <IconComponent size={13} className="opacity-70" />;
  }
  return null;
};

const MenuItemButton = ({ item, isDark, hasIconsOrChecks, onItemClick }: MenuItemButtonProps) => {
  return (
    <button
      type="button"
      aria-checked={typeof item.checked === 'boolean' ? item.checked : undefined}
      data-testid={`menubar-item-${item.label}`}
      onClick={() => onItemClick(item)}
      className={cn(
        "menubar-dropdown-item group",
        isDark ? "hover:bg-blue-600 text-slate-300 hover:text-white" : "hover:bg-blue-50 text-slate-700 hover:text-blue-700"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {hasIconsOrChecks && (
          <span
            data-testid={`menubar-check-slot-${item.label}`}
            className="menubar-check-slot"
          >
            {renderItemIconSlot(item)}
          </span>
        )}
        <span className="truncate">{item.label}</span>
      </div>
      {item.shortcut && (
        <span className="menubar-dropdown-shortcut">
          {item.shortcut}
        </span>
      )}
    </button>
  );
};

export const MenuBarDropdown = ({
  menu,
  activeMenu,
  setActiveMenu,
  colorMode,
  onMenuClick,
}: MenuBarDropdownProps) => {
  const isOpen = activeMenu === menu.label;
  const isDark = colorMode === 'dark';

  const activeClasses = isDark ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-900";
  const inactiveClasses = isDark ? "hover:bg-slate-800" : "hover:bg-slate-200";

  const buttonClasses = cn(
    "menubar-dropdown-btn",
    isOpen ? activeClasses : inactiveClasses
  );

  const handleHeaderClick = () => {
    if (onMenuClick) {
      onMenuClick(menu.label);
    }
    if (menu.label === 'File') {
      setActiveMenu(null);
    } else {
      setActiveMenu(isOpen ? null : menu.label);
    }
  };

  const handleItemClick = (item: MenuItem) => {
    item.onClick();
    if (typeof item.checked !== 'boolean') {
      setActiveMenu(null);
    }
  };

  const hasIconsOrChecks = menu.items.some((i) => i.icon || typeof i.checked === 'boolean');

  return (
    <div className="relative" style={{ '--wails-draggable': 'no-drag' }}>
      <button
        type="button"
        onClick={handleHeaderClick}
        onMouseEnter={() => activeMenu && menu.label !== 'File' && setActiveMenu(menu.label)}
        className={buttonClasses}
      >
        {menu.label}
      </button>

      {isOpen && (
        <div className={cn(
          "menubar-dropdown-panel",
          colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          {menu.items.map((item, idx) => {
            if (item.type === 'separator') {
              const sepClass = colorMode === 'dark' ? "bg-slate-800" : "bg-slate-200";
              return (
                <div 
                  key={`sep-${menu.label}-${item.label || idx}`} 
                  className={cn("menubar-dropdown-separator", sepClass)} 
                />
              );
            }

            return (
              <MenuItemButton
                key={item.label}
                item={item}
                isDark={isDark}
                hasIconsOrChecks={hasIconsOrChecks}
                onItemClick={handleItemClick}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
