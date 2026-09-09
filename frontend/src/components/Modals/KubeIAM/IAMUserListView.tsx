import React from 'react';
import { User, UserPlus, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useFlowStore } from '../../../store';
import { KubeIAMUser } from '../../../types';
import { IAMUserCard } from './IAMUserCard';
import { IAMSystemAdminCard } from './IAMSystemAdminCard';

export interface IAMUserListViewProps {
  readonly iamUsers: readonly KubeIAMUser[];
  readonly filteredUsers: readonly KubeIAMUser[];
  readonly searchFilter: string;
  readonly colorMode: string;
  readonly onSearchChange: (value: string) => void;
  readonly onStartCreate: () => void;
  readonly onSelectUser: (user: KubeIAMUser) => void;
  readonly onDeleteUser: (id: string) => void;
}

export const IAMUserListView: React.FC<IAMUserListViewProps> = ({
  iamUsers,
  filteredUsers,
  searchFilter,
  colorMode,
  onSearchChange,
  onStartCreate,
  onSelectUser,
  onDeleteUser,
}) => {
  const isDark = colorMode === 'dark';
  const activeIdentity = useFlowStore((state) => state.activeIdentity);
  const setActiveIdentity = useFlowStore((state) => state.setActiveIdentity);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/50">
        <div>
          <h3 className={cn('text-sm font-semibold flex items-center gap-2', isDark ? 'text-slate-200' : 'text-slate-800')}>
            <User size={16} className="text-emerald-400" />
            Kube IAM Users ({iamUsers.length})
          </h3>
          <p className={cn('text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Manage user identities and access control policies for Kube cluster resources.
          </p>
        </div>
        <button
          type="button"
          onClick={onStartCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm cursor-pointer"
        >
          <UserPlus size={14} />
          Create User
        </button>
      </div>

      {iamUsers.length > 0 && (
        <div className="relative mb-3">
          <Search size={14} className={cn('absolute left-2.5 top-1/2 -translate-y-1/2', isDark ? 'text-slate-500' : 'text-slate-400')} />
          <input
            type="text"
            placeholder="Filter users by name..."
            value={searchFilter}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              'w-full pl-8 pr-3 py-1.5 text-xs rounded-md border outline-none transition-colors',
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-emerald-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-emerald-500'
            )}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="space-y-2">
          <IAMSystemAdminCard
            isActive={activeIdentity === 'system:admin'}
            isDark={isDark}
            onSelectActive={setActiveIdentity}
          />

          {filteredUsers.length === 0 && searchFilter ? (
            <div className={cn('flex flex-col items-center justify-center h-32 rounded-lg border border-dashed p-6 text-center', isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400')}>
              <User size={28} className="mb-2 opacity-40 text-emerald-400" />
              <p className="text-xs font-medium mb-1">No users match your filter</p>
              <p className="text-[11px] max-w-xs">Try clearing your search query.</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <IAMUserCard
                key={user.id}
                user={user}
                isActive={activeIdentity === user.username}
                isDark={isDark}
                onSelectUser={onSelectUser}
                onSelectActive={setActiveIdentity}
                onDeleteUser={onDeleteUser}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
