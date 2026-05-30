import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MenuItem {
  label: string;
  icon?: any;
  onClick: () => void;
  shortcut?: string;
  type?: 'separator';
  checked?: boolean;
}

interface MenuBarDropdownProps {
  menu: {
    label: string;
    items: MenuItem[];
  };
  activeMenu: string | null;
  setActiveMenu: (label: string | null) => void;
  colorMode: 'dark' | 'light';
}

export const MenuBarDropdown = ({
  menu,
  activeMenu,
  setActiveMenu,
  colorMode
}: MenuBarDropdownProps) => {
  const isOpen = activeMenu === menu.label;
  const isDark = colorMode === 'dark';

  const activeClasses = isDark ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-900";
  const inactiveClasses = isDark ? "hover:bg-slate-800" : "hover:bg-slate-200";

  const buttonClasses = cn(
    "px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1",
    isOpen ? activeClasses : inactiveClasses
  );

  return (
    <div className="relative" style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}>
      <button
        onClick={() => setActiveMenu(isOpen ? null : menu.label)}
        onMouseEnter={() => activeMenu && setActiveMenu(menu.label)}
        className={buttonClasses}
      >
        {menu.label}
      </button>

      {isOpen && (
        <div className={cn(
          "absolute top-full left-0 mt-1 w-48 rounded-md shadow-lg border py-1 z-[100]",
          colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          {menu.items.map((item, idx) => {
            const isSeparator = item.type === 'separator';
            if (isSeparator) {
              const sepClass = colorMode === 'dark' ? "bg-slate-800" : "bg-slate-200";
              return (
                <div 
                  key={`sep-${menu.label}-${item.label || idx}`} 
                  className={cn("h-px my-1", sepClass)} 
                />
              );
            }

            let checkboxClass = isDark ? "border-slate-700" : "border-slate-300";
            if (item.checked) {
              checkboxClass = "bg-blue-500 border-blue-500 text-white";
            }

            return (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  if (typeof item.checked !== 'boolean') setActiveMenu(null);
                }}
                className={cn(
                  "w-full px-4 py-1.5 text-xs flex items-center justify-between transition-colors group",
                  isDark ? "hover:bg-blue-600 text-slate-300 hover:text-white" : "hover:bg-blue-50 text-slate-700 hover:text-blue-700"
                )}
              >
                <div className="flex items-center gap-2">
                  {item.icon && <item.icon size={12} className="opacity-70" />}
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.shortcut && (
                    <span className="text-[10px] opacity-50 font-mono group-hover:opacity-100">{item.shortcut}</span>
                  )}
                  {typeof item.checked === 'boolean' && (
                    <div className={cn(
                      "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                      checkboxClass
                    )}>
                      {item.checked && <Check size={10} />}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
