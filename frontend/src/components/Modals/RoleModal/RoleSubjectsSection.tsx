import React from 'react';
import { User, ExternalLink, X } from 'lucide-react';
import { KubeIAMUser } from '@/types';
import { cn } from '@/lib/utils';
import { RoleUserOptionRow } from './RoleUserOptionRow';
import { isUserFullAccess } from '@/activities/modals';

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
      <span className={colorMode === 'dark' ? "text-xs font-semibold text-slate-300 flex items-center gap-1.5" : "text-xs font-semibold text-slate-800 flex items-center gap-1.5"}>
        <User size={14} className={colorMode === 'dark' ? "text-slate-300" : "text-slate-700"} />
        RoleBinding Subjects / IAM Users ({assignedUsers.length})
      </span>
      <button
        type="button"
        onClick={onOpenIamModal}
        className={
          colorMode === 'dark'
            ? "flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700 px-2 py-0.5 rounded bg-slate-900"
            : "flex items-center gap-1 text-[11px] font-semibold text-slate-800 hover:text-black transition-colors cursor-pointer border border-slate-300 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
        }
      >
        <ExternalLink size={12} />
        Manage Kube IAM Users
      </button>
    </div>

    {iamUsers.length === 0 ? (
      <div className={cn('p-3 rounded-lg border text-xs flex items-center justify-between', colorMode === 'dark' ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-white border-slate-300 text-slate-700')}>
        <span>No Kube IAM users created yet.</span>
        <button
          type="button"
          onClick={onOpenIamModal}
          className={colorMode === 'dark' ? "text-slate-300 hover:underline text-[11px] font-medium cursor-pointer" : "text-slate-800 hover:underline text-[11px] font-medium cursor-pointer"}
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
            isUserDropdownOpen
              ? colorMode === 'dark'
                ? "ring-2 ring-slate-400 border-slate-400"
                : "ring-2 ring-slate-800 border-slate-800"
              : colorMode === 'dark'
                ? "border-slate-700"
                : "border-slate-300",
            colorMode === 'dark' ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"
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
                  colorMode === 'dark'
                    ? "bg-slate-900 border-slate-700 text-slate-200"
                    : "bg-slate-100 border-slate-400 text-slate-900"
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
