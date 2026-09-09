import React from 'react';
import { KubeIAMUser } from '@/types';
import { cn } from '@/lib/utils';

/**
 * Props for RoleUserOptionRow component.
 */
export interface RoleUserOptionRowProps {
  readonly user: KubeIAMUser;
  readonly isChecked: boolean;
  readonly isFullAccess: boolean;
  readonly colorMode: string;
  readonly onToggle: (username: string) => void;
}

/**
 * RoleUserOptionRow component renders an individual user option row in the role subjects dropdown.
 *
 * @param props RoleUserOptionRowProps
 * @returns JSX Element
 */
export const RoleUserOptionRow: React.FC<RoleUserOptionRowProps> = ({
  user,
  isChecked,
  isFullAccess,
  colorMode,
  onToggle,
}) => {
  const getDropdownRowClass = (): string => {
    if (isChecked) {
      return colorMode === 'dark'
        ? "bg-indigo-600/30 text-indigo-100 font-bold"
        : "bg-indigo-50 text-indigo-900 font-bold";
    }
    return colorMode === 'dark'
      ? "hover:bg-slate-800/60 text-slate-300 focus:bg-slate-800/60 outline-none"
      : "hover:bg-slate-50 text-slate-700 focus:bg-slate-50 outline-none";
  };

  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onToggle(user.username);
      }}
      onClick={() => onToggle(user.username)}
      className={cn(
        "w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors border-b last:border-b-0 border-slate-800/40 text-left outline-none focus:ring-1 focus:ring-indigo-500",
        getDropdownRowClass()
      )}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isChecked}
          disabled={isFullAccess}
          onChange={() => {}}
          aria-label={`Select ${user.username}`}
          className="rounded accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
        />
        <span className="font-semibold text-[11px]">{user.username}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {isFullAccess ? (
          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
            Full Access
          </span>
        ) : (
          user.policies.map((p) => (
            <span
              key={p.name}
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded border",
                colorMode === 'dark'
                  ? "bg-slate-800 border-slate-700 text-slate-400"
                  : "bg-slate-100 border-slate-200 text-slate-600"
              )}
            >
              {p.name}
            </span>
          ))
        )}
      </div>
    </button>
  );
};
