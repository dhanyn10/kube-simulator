import React, { useState, useRef, useEffect } from 'react';
import { FileCode, Save, Upload, FolderOpen, HelpCircle, Info, Bug, ChevronDown } from 'lucide-react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';

interface MenuBarProps {
  onExportYaml: () => void;
  onImportFile: () => void;
  onSaveFile: () => void;
  onOpenProjects: () => void;
}

export const MenuBar = ({
  onExportYaml,
  onImportFile,
  onSaveFile,
  onOpenProjects
}: MenuBarProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    {
      label: 'File',
      items: [
        { label: 'Save', icon: Save, onClick: onSaveFile, shortcut: 'Ctrl+S' },
        { label: 'Import', icon: Upload, onClick: onImportFile },
        { label: 'Export', icon: FileCode, onClick: onExportYaml },
      ]
    },
    {
      label: 'Project',
      items: [
        { label: 'Open', icon: FolderOpen, onClick: onOpenProjects },
      ]
    },
    {
      label: 'Help',
      items: [
        { label: 'About', icon: Info, onClick: () => alert('InfraStack Architect v1.0.0') },
        { label: 'Report Issue', icon: Bug, onClick: () => window.open('https://github.com', '_blank') },
      ]
    }
  ];

  return (
    <div
      ref={menuRef}
      className={cn(
        "h-10 border-b flex items-center px-4 justify-between z-50 select-none",
        colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
      )}
    >
      <div className="flex items-center gap-1">
        {menuItems.map((menu) => (
          <div key={menu.label} className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === menu.label ? null : menu.label)}
              onMouseEnter={() => activeMenu && setActiveMenu(menu.label)}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1",
                activeMenu === menu.label
                  ? (colorMode === 'dark' ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-900")
                  : (colorMode === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-200")
              )}
            >
              {menu.label}
            </button>

            {activeMenu === menu.label && (
              <div className={cn(
                "absolute top-full left-0 mt-1 w-48 rounded-md shadow-lg border py-1 z-[100]",
                colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
              )}>
                {menu.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      item.onClick();
                      setActiveMenu(null);
                    }}
                    className={cn(
                      "w-full px-4 py-1.5 text-xs flex items-center justify-between transition-colors",
                      colorMode === 'dark' ? "hover:bg-blue-600 text-slate-300 hover:text-white" : "hover:bg-blue-50 text-slate-700 hover:text-blue-700"
                    )}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className="text-[10px] opacity-50 font-mono ml-4">{item.shortcut}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <h1 className={cn(
          "text-[11px] font-bold uppercase tracking-[0.3em]",
          colorMode === 'dark' ? "text-blue-400" : "text-blue-600"
        )}>
          InfraStack Architect
        </h1>
      </div>

      <div className="flex items-center gap-4 text-[10px] font-medium opacity-50">
        {/* Placeholder for right-side status if needed */}
      </div>
    </div>
  );
};
