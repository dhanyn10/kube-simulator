import { Sun, Moon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export { useSidebarContextMenu } from '@/activity/ui';

interface SidebarContextMenuProps {
  readonly x: number;
  readonly y: number;
  readonly colorMode: 'dark' | 'light';
  readonly toggleColorMode: () => void;
  readonly onCloseSidebar?: () => void;
  readonly onCloseContextMenu: () => void;
  readonly testId?: string;
  readonly changeThemeTestId?: string;
  readonly closeTestId?: string;
}

export function SidebarContextMenu({
  x,
  y,
  colorMode,
  toggleColorMode,
  onCloseSidebar,
  onCloseContextMenu,
  testId = 'sidebar-context-menu',
  changeThemeTestId = 'context-menu-change-theme',
  closeTestId = 'context-menu-close-sidebar',
}: SidebarContextMenuProps) {
  const isDark = colorMode === 'dark';

  return (
    <div
      data-testid={testId}
      style={{ top: y, left: x }}
      className={cn(
        "fixed z-[3000] min-w-[150px] py-1 rounded-lg border shadow-2xl animate-in fade-in zoom-in-95 duration-100",
        isDark ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
      )}
    >
      <button
        type="button"
        data-testid={changeThemeTestId}
        onClick={(e) => {
          e.stopPropagation();
          toggleColorMode();
          onCloseContextMenu();
        }}
        className={cn(
          "w-full px-3 py-1.5 text-xs font-medium flex items-center gap-2 transition-colors text-left",
          isDark ? "hover:bg-slate-800 hover:text-white" : "hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        {isDark ? <Sun size={14} className="text-yellow-400" /> : <Moon size={14} className="text-blue-600" />}
        Change Theme
      </button>
      <div className={cn("h-px my-1", isDark ? "bg-slate-800" : "bg-slate-200")} />
      <button
        type="button"
        data-testid={closeTestId}
        onClick={(e) => {
          e.stopPropagation();
          if (onCloseSidebar) {
            onCloseSidebar();
          }
          onCloseContextMenu();
        }}
        className={cn(
          "w-full px-3 py-1.5 text-xs font-medium flex items-center gap-2 transition-colors text-left text-red-500",
          isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
        )}
      >
        <X size={14} />
        Exit
      </button>
    </div>
  );
}
