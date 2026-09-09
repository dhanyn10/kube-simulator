import React, { useState } from 'react';
import { User, Trash2, CheckCircle2, ArrowLeft, UserCheck, Clock, Shield, Edit3 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useFlowStore } from '../../../store';
import { KubeIAMPolicy, KubeIAMUser } from '../../../types';
import { AttachedRoleInfo, formatDateWithSeconds, getLastUsedActivityClass } from '../../../activity/modals';
import { IAMUserEditView } from './IAMUserEditView';

export interface IAMUserSummaryCardsProps {
  readonly user: KubeIAMUser;
  readonly isActive: boolean;
  readonly isDark: boolean;
  readonly formattedDate: string;
}

export const IAMUserSummaryCards: React.FC<IAMUserSummaryCardsProps> = ({
  user,
  isActive,
  isDark,
  formattedDate,
}) => (
  <div className="grid grid-cols-3 gap-3">
    <div className={cn('p-3 rounded-lg border space-y-1', isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
        <Shield size={12} className="text-emerald-400" />
        Access Type
      </span>
      <p className="text-xs font-semibold text-emerald-400">{user.accessType}</p>
    </div>

    <div className={cn('p-3 rounded-lg border space-y-1', isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
        <Clock size={12} className="text-indigo-400" />
        Created At
      </span>
      <p className={cn('text-[11px] font-semibold font-mono', isDark ? 'text-slate-200' : 'text-slate-800')}>
        {formattedDate}
      </p>
    </div>

    <div className={cn('p-3 rounded-lg border space-y-1', isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
        <UserCheck size={12} className="text-purple-400" />
        Last Used Activity
      </span>
      <p className={cn('text-xs font-semibold', getLastUsedActivityClass(isActive, isDark))}>
        {isActive ? 'Active Session' : 'Never / Inactive'}
      </p>
    </div>
  </div>
);

export interface IAMUserPolicyTableProps {
  readonly policies: readonly KubeIAMPolicy[];
  readonly isDark: boolean;
}

export const IAMUserPolicyTable: React.FC<IAMUserPolicyTableProps> = ({ policies, isDark }) => (
  <div className="space-y-2">
    <span className={cn('text-xs font-semibold block', isDark ? 'text-slate-300' : 'text-slate-700')}>
      Attached IAM Policies ({policies.length})
    </span>
    <div className={cn('border rounded-lg overflow-hidden', isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white')}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className={cn('text-[10px] font-semibold uppercase tracking-wider border-b', isDark ? 'bg-slate-800/80 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500')}>
            <th className="py-2 px-3">Policy Name</th>
            <th className="py-2 px-3">Type</th>
            <th className="py-2 px-3">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {policies.map((p) => (
            <tr key={p.name} className="text-xs">
              <td className="py-2 px-3 font-semibold text-emerald-400">{p.name}</td>
              <td className="py-2 px-3">
                <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium border', isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500')}>
                  {p.type}
                </span>
              </td>
              <td className={cn('py-2 px-3 text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
                {p.description || 'Standard IAM Policy'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export interface IAMUserRoleBindingsTableProps {
  readonly user: KubeIAMUser;
  readonly attachedRoles: readonly AttachedRoleInfo[];
  readonly isDark: boolean;
  readonly formatDateWithSeconds: (ts?: number) => string;
  readonly onNavigateToRole: (nodeId: string, nodeLabel: string) => void;
}

export const IAMUserRoleBindingsTable: React.FC<IAMUserRoleBindingsTableProps> = ({
  user,
  attachedRoles,
  isDark,
  formatDateWithSeconds: formatTs,
  onNavigateToRole,
}) => (
  <div className="space-y-2">
    <span className={cn('text-xs font-semibold block', isDark ? 'text-slate-300' : 'text-slate-700')}>
      RoleBindings / Canvas Resource Assignments ({attachedRoles.length})
    </span>
    {attachedRoles.length === 0 ? (
      <div className={cn('p-3 rounded-lg border text-xs text-center', isDark ? 'bg-slate-900/40 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500')}>
        No specific RoleBindings assigned on the canvas.
      </div>
    ) : (
      <div className={cn('border rounded-lg overflow-hidden', isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white')}>
        <table className="w-full text-left border-collapse font-mono text-xs">
          <thead>
            <tr className={cn('text-[10px] font-semibold uppercase tracking-wider border-b font-sans', isDark ? 'bg-slate-800/80 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500')}>
              <th className="py-2 px-3">Binding ID</th>
              <th className="py-2 px-3">IAM Profile</th>
              <th className="py-2 px-3">Target Element</th>
              <th className="py-2 px-3">Role Ref</th>
              <th className="py-2 px-3">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {attachedRoles.map((r) => {
              const bindingId = `${r.roleName}-rb-${r.nodeId.split('-')[0]}`;
              const createdDate = formatTs(r.createdAt);
              return (
                <tr
                  key={`${r.nodeId}-${r.roleId}`}
                  onClick={() => onNavigateToRole(r.nodeId, r.nodeLabel)}
                  className={cn(
                    'transition-colors cursor-pointer',
                    isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                  )}
                >
                  <td className="py-2 px-3 text-slate-400 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => onNavigateToRole(r.nodeId, r.nodeLabel)}
                      className="text-left font-mono hover:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {bindingId}
                    </button>
                  </td>
                  <td className="py-2 px-3 font-sans font-semibold text-emerald-400">{user.username}</td>
                  <td className="py-2 px-3 font-sans">
                    <span className="font-semibold text-slate-200">{r.nodeLabel}</span>
                    {r.nodeType && (
                      <span className="text-[10px] text-slate-500 ml-1">({r.nodeType})</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium border bg-indigo-500/10 border-indigo-500/30 text-indigo-300">
                      {r.roleName}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400 text-[11px] font-mono">{createdDate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export interface IAMUserDetailViewProps {
  readonly user: KubeIAMUser;
  readonly isActive: boolean;
  readonly isDark: boolean;
  readonly attachedRoles: readonly AttachedRoleInfo[];
  readonly onBack: () => void;
  readonly onSelectActive: (username: string) => void;
  readonly onDeleteUser: (id: string) => void;
  readonly onNavigateToRole: (nodeId: string, nodeLabel: string) => void;
}

export const IAMUserDetailView: React.FC<IAMUserDetailViewProps> = ({
  user,
  isActive,
  isDark,
  attachedRoles,
  onBack,
  onSelectActive,
  onDeleteUser,
  onNavigateToRole,
}) => {
  const updateIamUser = useFlowStore((state) => state.updateIamUser);
  const activeIdentity = useFlowStore((state) => state.activeIdentity);
  const setActiveIdentity = useFlowStore((state) => state.setActiveIdentity);

  const [isEditing, setIsEditing] = useState(false);

  const handleFinishEdit = (newUsername: string, finalPolicies: KubeIAMPolicy[]) => {
    const isFull = finalPolicies.some((p) => p.name === 'AdministratorAccess');

    updateIamUser(user.id, {
      username: newUsername,
      accessType: isFull ? 'Full Access' : 'Managed Access',
      policies: finalPolicies,
    });

    if (activeIdentity === user.username) {
      setActiveIdentity(newUsername);
    }

    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <IAMUserEditView
        user={user}
        isDark={isDark}
        onCancel={() => setIsEditing(false)}
        onFinish={handleFinishEdit}
      />
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header with Back & Edit Buttons */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              'p-1.5 rounded-lg border transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer',
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            )}
          >
            <ArrowLeft size={14} />
            Back to Users
          </button>
          <div>
            <h3 className={cn('text-sm font-bold flex items-center gap-2', isDark ? 'text-slate-100' : 'text-slate-800')}>
              <User size={16} className="text-emerald-400" />
              {user.username}
            </h3>
            <p className={cn('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
              IAM User Summary & Access Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs cursor-pointer"
          >
            <Edit3 size={13} />
            Edit Profile
          </button>

          <button
            type="button"
            onClick={() => onSelectActive(user.username)}
            disabled={isActive}
            data-testid={`detail-use-profile-btn-${user.username}`}
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
                <span>Active Context</span>
              </>
            ) : (
              <>
                <UserCheck size={13} />
                <span>Set Active Profile</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onDeleteUser(user.id);
              onBack();
            }}
            className={cn(
              'p-1.5 rounded-md text-slate-400 hover:text-rose-400 transition-colors cursor-pointer',
              isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200'
            )}
            title="Delete User"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <IAMUserSummaryCards
        user={user}
        isActive={isActive}
        isDark={isDark}
        formattedDate={formatDateWithSeconds(user.createdAt)}
      />

      <IAMUserPolicyTable
        policies={user.policies || []}
        isDark={isDark}
      />

      <IAMUserRoleBindingsTable
        user={user}
        attachedRoles={attachedRoles}
        isDark={isDark}
        formatDateWithSeconds={formatDateWithSeconds}
        onNavigateToRole={onNavigateToRole}
      />
    </div>
  );
};
