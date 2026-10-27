import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MenuItem,
  MenuBarDropdownProps,
  MenuItemButtonProps,
  useMenuBarDropdown,
} from '@/activities/menubar';

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

export const MenuBarDropdown = (props: MenuBarDropdownProps) => {
  const { menu, colorMode } = props;
  const {
    isOpen,
    isDark,
    buttonClasses,
    hasIconsOrChecks,
    handleHeaderClick,
    handleMouseEnter,
    handleItemClick,
  } = useMenuBarDropdown(props);

  return (
    <div className="relative" style={{ '--wails-draggable': 'no-drag' }}>
      <button
        type="button"
        onClick={handleHeaderClick}
        onMouseEnter={handleMouseEnter}
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
