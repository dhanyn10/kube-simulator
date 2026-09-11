import { Minus, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWindowControls } from '@/activities/layout';

export const WindowControls = ({ colorMode }: { colorMode: string }) => {
  const { handleMinimize, handleMaximize, handleClose } = useWindowControls();

  return (
    <div className="flex items-center" style={{ '--wails-draggable': 'no-drag' }}>
      <button
        type="button"
        aria-label="minimize"
        onClick={handleMinimize}
        className={cn(
          "w-11 h-10 flex items-center justify-center transition-colors text-slate-500",
          colorMode === 'dark' ? "hover:bg-slate-800 hover:text-slate-200" : "hover:bg-slate-200 hover:text-slate-700"
        )}
      >
        <Minus size={16} />
      </button>
      <button
        type="button"
        aria-label="maximize"
        onClick={handleMaximize}
        className={cn(
          "w-11 h-10 flex items-center justify-center transition-colors text-slate-500",
          colorMode === 'dark' ? "hover:bg-slate-800 hover:text-slate-200" : "hover:bg-slate-200 hover:text-slate-700"
        )}
      >
        <Square size={12} />
      </button>
      <button
        type="button"
        aria-label="close"
        onClick={handleClose}
        className="w-11 h-10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors text-slate-500"
      >
        <X size={18} />
      </button>
    </div>
  );
};
