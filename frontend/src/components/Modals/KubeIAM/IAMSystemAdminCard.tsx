import React from 'react';
import { ShieldCheck, CheckCircle2, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAdminCardBgClass } from '@/activity/modals';

export interface IAMSystemAdminCardProps {
  readonly isActive: boolean;
  readonly isDark: boolean;
  readonly onSelectActive: (username: string) => void;
}

export const IAMSystemAdminCard: React.FC<IAMSystemAdminCardProps> = ({ isActive, isDark, onSelectActive }) => (
  <div
    className={cn(
      'flex items-center justify-between p-3 rounded-lg border transition-colors',
      getAdminCardBgClass(isActive, isDark)
    )}
  >
    <div className="flex items-start gap-3">
      <div className={cn('p-2 rounded-md mt-0.5', isDark ? 'bg-slate-900 text-amber-400' : 'bg-white text-amber-600 border border-slate-200')}>
        <ShieldCheck size={16} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold font-mono', isDark ? 'text-slate-200' : 'text-slate-800')}>
            system:admin
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Cluster Admin
          </span>
        </div>
        <p className={cn('text-[11px] mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
          Default cluster superuser account with unrestricted API Server permissions.
        </p>
      </div>
    </div>

    <button
      type="button"
      onClick={() => onSelectActive('system:admin')}
      disabled={isActive}
      data-testid="use-profile-btn-system-admin"
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
  </div>
);
