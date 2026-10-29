import React from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { K8sSecretItem } from '@/types';

export interface SecretImportDataDropdownProps {
  readonly isOpen: boolean;
  readonly onToggleOpen: () => void;
  readonly existingSecrets: readonly K8sSecretItem[];
  readonly onImport: (sec: K8sSecretItem) => void;
  readonly isDark: boolean;
  readonly dropdownRef: React.RefObject<HTMLDivElement | null>;
}

export const SecretImportDataDropdown: React.FC<SecretImportDataDropdownProps> = ({
  isOpen,
  onToggleOpen,
  existingSecrets,
  onImport,
  isDark,
  dropdownRef,
}) => {
  if (existingSecrets.length === 0) return null;

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        data-testid="btn-add-from-existing-sec"
        onClick={onToggleOpen}
        className={cn(
          "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer font-medium",
          isDark
            ? "bg-slate-900 border-slate-700 text-rose-400 hover:bg-slate-800"
            : "bg-white border-slate-300 text-rose-600 hover:bg-slate-50"
        )}
        title="Use an existing Secret"
      >
        <Layers size={13} />
        <span>Use Existing</span>
      </button>

      {isOpen && (
        <div
          data-testid="import-existing-sec-menu"
          className={cn(
            "absolute right-0 mt-1.5 w-60 rounded-lg shadow-2xl border p-1 z-30 text-xs animate-in fade-in-50 zoom-in-95 duration-100 max-h-52 overflow-y-auto custom-scrollbar",
            isDark
              ? "bg-slate-900 border-slate-700 text-slate-200"
              : "bg-white border-slate-200 text-slate-800"
          )}
        >
          <div className="py-0.5">
            {existingSecrets.map((sec) => {
              const keyCount = sec.secretData?.length || 0;
              return (
                <button
                  key={`import-sec-item-${sec.id}`}
                  type="button"
                  data-testid={`import-option-${sec.name || sec.id}`}
                  onClick={() => onImport(sec)}
                  className={cn(
                    "w-full px-2.5 py-1.5 flex items-center justify-between text-left rounded transition-colors cursor-pointer",
                    isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
                  )}
                >
                  <span className="font-semibold text-xs text-rose-400 truncate mr-2">
                    {sec.name || sec.id}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {keyCount} {keyCount === 1 ? 'key' : 'keys'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
