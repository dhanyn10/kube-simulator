import React from 'react';
import { User, ExternalLink, X } from 'lucide-react';
import { KubeIAMUser } from '@/types';
import { cn } from '@/lib/utils';
import { RoleUserOptionRow } from './RoleUserOptionRow';
import { isUserFullAccess } from '@/activity/modals';

/**
 * Props for RoleSubjectsSection component.
 */
export interface RoleSubjectsSectionProps {
  readonly iamUsers: readonly KubeIAMUser[];
  readonly assignedUsers: readonly string[];
  readonly userSearchQuery: string;
  readonly isUserDropdownOpen: boolean;
  readonly colorMode: string;
  readonly filteredAvailableUsers: readonly KubeIAMUser[];
  readonly userDropdownRef: React.RefObject<HTMLDivElement | null>;
  readonly onOpenIamModal: () => void;
  readonly onSearchChange: (value: string) => void;
  readonly onDropdownOpenChange: (isOpen: boolean) => void;
  readonly onToggleAssignment: (username: string) => void;
}

/**
 * RoleSubjectsSection renders the Subject/IAM user assignment section of RoleModal.
 *
 * @param props RoleSubjectsSectionProps
 * @returns JSX Element
 */
export const RoleSubjectsSection: React.FC<RoleSubjectsSectionProps> = ({
  iamUsers,
  assignedUsers,
  userSearchQuery,
  isUserDropdownOpen,
  colorMode,
  filteredAvailableUsers,
  userDropdownRef,
  onOpenIamModal,
  onSearchChange,
  onDropdownOpenChange,
  onToggleAssignment,
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
        <User size={14} className="text-emerald-400" />
        RoleBinding Subjects / IAM Users ({assignedUsers.length})
      </span>
      <button
        type="button"
        onClick={onOpenIamModal}
        className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
      >
        <ExternalLink size={12} />
        Manage Kube IAM Users
      </button>
    </div>

    {iamUsers.length === 0 ? (
      <div className={cn('p-3 rounded-lg border text-xs flex items-center justify-between', colorMode === 'dark' ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600')}>
        <span>No Kube IAM users created yet.</span>
        <button
          type="button"
          onClick={onOpenIamModal}
          className="text-emerald-400 hover:underline text-[11px] font-medium cursor-pointer"
        >
          Go to Kube IAM Management
        </button>
      </div>
    ) : (
      <div ref={userDropdownRef} className="relative">
        <label
          htmlFor="assigned-users-input"
          className={cn(
            "min-h-[42px] p-1.5 rounded-lg border flex flex-wrap items-center gap-1.5 cursor-text transition-all",
            isUserDropdownOpen ? "ring-2 ring-indigo-500/50 border-indigo-500/80" : "border-slate-700/60",
            colorMode === 'dark' ? "bg-slate-950" : "bg-white"
          )}
        >
          {assignedUsers.map((uname) => {
            const uobj = iamUsers.find((u) => u.username === uname);
            const isFull = uobj ? isUserFullAccess(uobj) : false;
            return (
              <span
                key={`assigned-chip-${uname}`}
                className={cn(
                  "px-2 py-0.5 rounded-md text-xs font-mono font-semibold flex items-center gap-1 border shadow-xs transition-all animate-in fade-in zoom-in-95 duration-150",
                  isFull
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                    : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                )}
              >
                <User size={10} />
                <span>{uname}</span>
                {isFull ? (
                  <span className="text-[9px] opacity-70 font-normal ml-0.5">(Full Access)</span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleAssignment(uname);
                    }}
                    className="hover:opacity-80 p-0.5 rounded-full transition-opacity cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            );
          })}

          <input
            id="assigned-users-input"
            type="text"
            value={userSearchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              onDropdownOpenChange(true);
            }}
            onFocus={() => onDropdownOpenChange(true)}
            placeholder={assignedUsers.length === 0 ? "Type to search or add IAM users..." : "Add user..."}
            className={cn(
              "flex-1 min-w-[140px] bg-transparent text-xs font-mono outline-none py-0.5 px-1",
              colorMode === 'dark' ? "text-slate-100 placeholder-slate-500" : "text-slate-800 placeholder-slate-400"
            )}
          />
        </label>

        {isUserDropdownOpen && (
          <div className={cn(
            "absolute left-0 right-0 top-full mt-1 z-50 max-h-48 overflow-y-auto rounded-lg border shadow-xl p-1 animate-in fade-in zoom-in-95 duration-100 custom-scrollbar font-mono text-xs",
            colorMode === 'dark' ? "bg-slate-900 border-slate-700/80 text-slate-200" : "bg-white border-slate-300 text-slate-800"
          )}>
            {filteredAvailableUsers.length === 0 ? (
              <div className="p-2.5 text-center text-xs text-slate-400">
                No matching IAM users available for this card type.
              </div>
            ) : (
              filteredAvailableUsers.map((user) => (
                <RoleUserOptionRow
                  key={user.id}
                  user={user}
                  isChecked={assignedUsers.includes(user.username)}
                  isFullAccess={isUserFullAccess(user)}
                  colorMode={colorMode}
                  onToggle={onToggleAssignment}
                />
              ))
            )}
          </div>
        )}
      </div>
    )}
  </div>
);
