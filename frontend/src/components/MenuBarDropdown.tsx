import React from 'react';
import { X as CloseIcon } from 'lucide-react';
import { cn } from '../lib/utils';

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

  return (
    <div className="relative" style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}>
      <button
        onClick={() => setActiveMenu(isOpen ? null : menu.label)}
        onMouseEnter={() => activeMenu && setActiveMenu(menu.label)}
        className={cn(
          "px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1",
          isOpen
            ? (colorMode === 'dark' ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-900")
            : (colorMode === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-200")
        )}
      >
        {menu.label}
      </button>

      {isOpen && (
        <div className={cn(
          "absolute top-full left-0 mt-1 w-48 rounded-md shadow-lg border py-1 z-[100]",
          colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          {menu.items.map((item, idx) => (
            item.type === 'separator' ? (
              <div key={`sep-${menu.label}-${idx}`} className={cn("h-px my-1", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-200")} />
            ) : (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  if (!item.checked) setActiveMenu(null);
                }}
                className={cn(
                  "w-full px-4 py-1.5 text-xs flex items-center justify-between transition-colors group",
                  colorMode === 'dark' ? "hover:bg-blue-600 text-slate-300 hover:text-white" : "hover:bg-blue-50 text-slate-700 hover:text-blue-700"
                )}
              >
                <div className="flex items-center gap-2">
                  {typeof item.checked === 'boolean' && (
                    <div className={cn(
                      "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                      item.checked
                        ? "bg-blue-500 border-blue-500 text-white"
                        : (colorMode === 'dark' ? "border-slate-700" : "border-slate-300")
                    )}>
                      {item.checked && <CloseIcon size={10} className="rotate-45" />}
                    </div>
                  )}
                  {item.icon && <item.icon size={12} className="opacity-70" />}
                  <span>{item.label}</span>
                </div>
                {item.shortcut && (
                  <span className="text-[10px] opacity-50 font-mono ml-4 group-hover:opacity-100">{item.shortcut}</span>
                )}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
};
