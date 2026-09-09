import React from 'react';
import { User, Trash2, CheckCircle2, UserCheck, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KubeIAMUser } from '@/types';
import { getUserCardBgClass } from '@/activity/modals';

export interface IAMUserCardProps {
  readonly user: KubeIAMUser;
  readonly isActive: boolean;
  readonly isDark: boolean;
  readonly onSelectUser: (user: KubeIAMUser) => void;
  readonly onSelectActive: (username: string) => void;
  readonly onDeleteUser: (id: string) => void;
}

export const IAMUserCard: React.FC<IAMUserCardProps> = ({
  user,
  isActive,
  isDark,
  onSelectUser,
  onSelectActive,
  onDeleteUser,
}) => {
  const isFullAccess = user.accessType === 'Full Access';
  const badgeClass = isFullAccess
    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';

  return (
    <div
      className={cn(
        'w-full text-left flex items-center justify-between p-3 rounded-lg border transition-colors group',
        getUserCardBgClass(isActive, isDark)
      )}
    >
      <button
        type="button"
        onClick={() => onSelectUser(user)}
        className="flex items-center gap-3 flex-1 text-left cursor-pointer outline-none focus:ring-2 focus:ring-emerald-500/50 rounded-md p-1 -m-1"
      >
        <div className={cn('p-2 rounded-md', isDark ? 'bg-slate-900 text-emerald-400' : 'bg-white text-emerald-600 border border-slate-200')}>
          <User size={16} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-semibold group-hover:text-emerald-400 transition-colors', isDark ? 'text-slate-200' : 'text-slate-800')}>
              {user.username}
            </span>
            <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider', badgeClass)}>
              {user.accessType}
            </span>
          </div>
          <p className={cn('text-[11px] mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {user.policies?.length || 0} attached policy / policies • Click for details
          </p>
        </div>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectActive(user.username)}
          disabled={isActive}
          data-testid={`use-profile-btn-${user.username}`}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
            isActive
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 cursor-default'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
          )}
        >
          {isActive ? (
            <>
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>Active Profile</span>
            </>
          ) : (
            <>
              <UserCheck size={13} />
              <span>Use this profile</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onDeleteUser(user.id)}
          className={cn(
            'p-1.5 rounded-md text-slate-400 hover:text-rose-400 transition-colors cursor-pointer',
            isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'
          )}
          title="Delete User"
        >
          <Trash2 size={14} />
        </button>

        <button
          type="button"
          onClick={() => onSelectUser(user)}
          aria-label={`View details for ${user.username}`}
          className="p-1 rounded-md text-slate-400 group-hover:text-emerald-400 transition-colors cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
