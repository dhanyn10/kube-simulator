import React, { useState } from 'react';
import { User, UserPlus, Trash2, CheckCircle2, Search, ArrowRight, ArrowLeft, Check, UserCheck, ShieldCheck, ChevronRight, Clock, Shield, Edit3, Save, X } from 'lucide-react';
import { Modal } from './Modal';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { KubeIAMPolicy, KubeIAMUser } from '../../types';
import { useKubeIamWizard, DEFAULT_POLICIES, IAMStep } from '../../activity/modals';

/**
 * Computes step badge styling class based on active step state.
 */
function getStepBadgeClass(step: number, currentStep: number, isDark: boolean): string {
  if (currentStep === step) {
    return 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/20';
  }
  if (currentStep > step) {
    return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
  }
  if (isDark) {
    return 'bg-slate-800 text-slate-500';
  }
  return 'bg-slate-100 text-slate-400';
}

/**
 * Computes step text styling class based on active step state.
 */
function getStepTextClass(step: number, currentStep: number, isDark: boolean): string {
  if (currentStep === step) {
    return 'text-emerald-400';
  }
  if (isDark) {
    return 'text-slate-300';
  }
  return 'text-slate-700';
}

/**
 * Computes policy table row styling class based on selection state.
 */
function getPolicyRowClass(isSelected: boolean, isDark: boolean): string {
  if (isSelected) {
    return isDark ? 'bg-emerald-500/10 text-slate-200' : 'bg-emerald-50 text-slate-900';
  }
  return isDark ? 'hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-50 text-slate-700';
}

interface AttachedRoleInfo {
  readonly nodeId: string;
  readonly nodeLabel: string;
  readonly nodeType?: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly createdAt?: number;
}

interface IAMUserCardProps {
  readonly user: KubeIAMUser;
  readonly isActive: boolean;
  readonly isDark: boolean;
  readonly onSelectUser: (user: KubeIAMUser) => void;
  readonly onSelectActive: (username: string) => void;
  readonly onDeleteUser: (id: string) => void;
}

function getUserCardBgClass(isActive: boolean, isDark: boolean): string {
  if (isActive) {
    return isDark
      ? 'bg-emerald-950/30 border-emerald-500/50 hover:bg-emerald-900/40'
      : 'bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100/60';
  }
  return isDark
    ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800'
    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80';
}

const IAMUserCard: React.FC<IAMUserCardProps> = ({
  user,
  isActive,
  isDark,
  onSelectUser,
  onSelectActive,
  onDeleteUser,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectUser(user);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'w-full text-left flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer group outline-none focus:ring-2 focus:ring-emerald-500/50',
        getUserCardBgClass(isActive, isDark)
      )}
      onClick={() => onSelectUser(user)}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-md', isDark ? 'bg-slate-900 text-emerald-400' : 'bg-white text-emerald-600 border border-slate-200')}>
          <User size={16} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-semibold group-hover:text-emerald-400 transition-colors', isDark ? 'text-slate-200' : 'text-slate-800')}>
              {user.username}
            </span>
            <span className={cn(
              'px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider',
              user.accessType === 'Full Access'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            )}>
              {user.accessType}
            </span>
          </div>
          <p className={cn('text-[11px] mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {user.policies?.length || 0} attached policy / policies • Click for details
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
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
            'p-1.5 rounded-md text-slate-400 hover:text-rose-400 transition-colors',
            isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'
          )}
          title="Delete User"
        >
          <Trash2 size={14} />
        </button>

        <ChevronRight size={16} className={cn('text-slate-400 group-hover:text-emerald-400 transition-colors ml-1')} />
      </div>
    </div>
  );
};

interface IAMUserEditWizardProps {
  readonly user: KubeIAMUser;
  readonly isDark: boolean;
  readonly editStep: IAMStep;
  readonly editUsername: string;
  readonly editUsernameError: string;
  readonly editPolicies: readonly string[];
  readonly editPolicySearch: string;
  readonly filteredEditPolicies: readonly KubeIAMPolicy[];
  readonly isEditAdminSelected: boolean;
  readonly isEditOtherSelected: boolean;
  readonly editComputedAccessType: IAMAccessType;
  readonly onCancel: () => void;
  readonly onUsernameChange: (val: string) => void;
  readonly onPolicySearchChange: (val: string) => void;
  readonly onTogglePolicy: (policyName: string) => void;
  readonly onPrevious: () => void;
  readonly onNextStep1: () => void;
  readonly onNextStep2: () => void;
  readonly onFinishEdit: () => void;
}

const IAMUserEditWizard: React.FC<IAMUserEditWizardProps> = ({
  user,
  isDark,
  editStep,
  editUsername,
  editUsernameError,
  editPolicies,
  editPolicySearch,
  filteredEditPolicies,
  isEditAdminSelected,
  isEditOtherSelected,
  editComputedAccessType,
  onCancel,
  onUsernameChange,
  onPolicySearchChange,
  onTogglePolicy,
  onPrevious,
  onNextStep1,
  onNextStep2,
  onFinishEdit,
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/50">
        <div>
          <h3 className={cn('text-sm font-bold flex items-center gap-2', isDark ? 'text-slate-100' : 'text-slate-800')}>
            <Edit3 size={16} className="text-indigo-400" />
            Edit User Profile ({user.username})
          </h3>
          <p className={cn('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Modify user credentials and permission policy assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            'px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer',
            isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
          )}
        >
          <X size={14} />
          Cancel Editing
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <IAMStepper
          currentStep={editStep}
          colorMode={isDark ? 'dark' : 'light'}
          isEditMode={true}
          onReset={onCancel}
        />

        <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
          {editStep === 1 && (
            <IAMStep1Details
              username={editUsername}
              usernameError={editUsernameError}
              colorMode={isDark ? 'dark' : 'light'}
              onUsernameChange={onUsernameChange}
            />
          )}

          {editStep === 2 && (
            <IAMStep2Permissions
              username={editUsername}
              selectedPolicies={editPolicies}
              policySearch={editPolicySearch}
              filteredPolicies={filteredEditPolicies}
              isAdminSelected={isEditAdminSelected}
              isOtherSelected={isEditOtherSelected}
              colorMode={isDark ? 'dark' : 'light'}
              onPolicySearchChange={onPolicySearchChange}
              onTogglePolicy={onTogglePolicy}
            />
          )}

          {editStep === 3 && (
            <IAMStep3Review
              username={editUsername}
              computedAccessType={editComputedAccessType}
              selectedPolicies={editPolicies}
              colorMode={isDark ? 'dark' : 'light'}
              isEditMode={true}
            />
          )}

          <IAMWizardFooter
            currentStep={editStep}
            colorMode={isDark ? 'dark' : 'light'}
            isEditMode={true}
            onPrevious={onPrevious}
            onNext={editStep === 1 ? onNextStep1 : onNextStep2}
            onFinish={onFinishEdit}
          />
        </div>
      </div>
    </div>
  );
};

interface IAMUserDetailViewProps {
  readonly user: KubeIAMUser;
  readonly isActive: boolean;
  readonly isDark: boolean;
  readonly attachedRoles: readonly AttachedRoleInfo[];
  readonly onBack: () => void;
  readonly onSelectActive: (username: string) => void;
  readonly onDeleteUser: (id: string) => void;
  readonly onNavigateToRole: (nodeId: string, nodeLabel: string) => void;
}

/**
 * AWS IAM-style User Detail Page / View displaying summary, permissions policies, and canvas RoleBindings.
 */
const IAMUserDetailView: React.FC<IAMUserDetailViewProps> = ({
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
  const [editStep, setEditStep] = useState<IAMStep>(1);
  const [editUsername, setEditUsername] = useState(user.username);
  const [editPolicies, setEditPolicies] = useState<string[]>(user.policies?.map((p) => p.name) || ['AdministratorAccess']);
  const [editPolicySearch, setEditPolicySearch] = useState('');
  const [editUsernameError, setEditUsernameError] = useState('');

  const iamUsers = useFlowStore((state) => state.iamUsers);

  const formatDateWithSeconds = (ts?: number): string => {
    if (!ts) return 'System Default';
    const date = new Date(ts);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  const handleStartEdit = () => {
    setEditUsername(user.username);
    setEditPolicies(user.policies?.map((p) => p.name) || ['AdministratorAccess']);
    setEditStep(1);
    setEditUsernameError('');
    setIsEditing(true);
  };

  const handleEditNextStep1 = () => {
    if (!editUsername.trim()) {
      setEditUsernameError('Username is required');
      return;
    }
    const exists = iamUsers.some((u) => u.id !== user.id && u.username.toLowerCase() === editUsername.trim().toLowerCase());
    if (exists) {
      setEditUsernameError('Username already exists');
      return;
    }
    setEditUsernameError('');
    setEditStep(2);
  };

  const handleEditNextStep2 = () => {
    if (editPolicies.length === 0) return;
    setEditStep(3);
  };

  const handleFinishEdit = () => {
    const finalPolicies = DEFAULT_POLICIES.filter((p) => editPolicies.includes(p.name));
    const isFull = editPolicies.includes('AdministratorAccess');

    updateIamUser(user.id, {
      username: editUsername.trim(),
      accessType: isFull ? 'Full Access' : 'Managed Access',
      policies: finalPolicies,
    });

    if (activeIdentity === user.username) {
      setActiveIdentity(editUsername.trim());
    }

    setIsEditing(false);
  };

  const isEditAdminSelected = editPolicies.includes('AdministratorAccess');
  const isEditOtherSelected = editPolicies.some((p) => p !== 'AdministratorAccess');

  const toggleEditPolicy = (policyName: string) => {
    if (policyName === 'AdministratorAccess') {
      setEditPolicies(isEditAdminSelected ? [] : ['AdministratorAccess']);
      return;
    }
    setEditPolicies((prev) => {
      const withoutAdmin = prev.filter((p) => p !== 'AdministratorAccess');
      return withoutAdmin.includes(policyName)
        ? withoutAdmin.filter((p) => p !== policyName)
        : [...withoutAdmin, policyName];
    });
  };

  const filteredEditPolicies = DEFAULT_POLICIES.filter((p) =>
    p.name.toLowerCase().includes(editPolicySearch.toLowerCase()) ||
    p.description.toLowerCase().includes(editPolicySearch.toLowerCase())
  );

  const editComputedAccessType: IAMAccessType = editPolicies.includes('AdministratorAccess')
    ? 'Full Access'
    : 'Managed Access';

  if (isEditing) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/50">
          <div>
            <h3 className={cn('text-sm font-bold flex items-center gap-2', isDark ? 'text-slate-100' : 'text-slate-800')}>
              <Edit3 size={16} className="text-indigo-400" />
              Edit User Profile ({user.username})
            </h3>
            <p className={cn('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
              Modify user credentials and permission policy assignments.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className={cn(
              'px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer',
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            )}
          >
            <X size={14} />
            Cancel Editing
          </button>
        </div>

        <div className="flex flex-1 gap-6 overflow-hidden">
          <IAMStepper
            currentStep={editStep}
            colorMode={isDark ? 'dark' : 'light'}
            onReset={() => setIsEditing(false)}
          />

          <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
            {editStep === 1 && (
              <IAMStep1Details
                username={editUsername}
                usernameError={editUsernameError}
                colorMode={isDark ? 'dark' : 'light'}
                onUsernameChange={(val) => {
                  setEditUsername(val);
                  if (editUsernameError) setEditUsernameError('');
                }}
              />
            )}

            {editStep === 2 && (
              <IAMStep2Permissions
                username={editUsername}
                selectedPolicies={editPolicies}
                policySearch={editPolicySearch}
                filteredPolicies={filteredEditPolicies}
                isAdminSelected={isEditAdminSelected}
                isOtherSelected={isEditOtherSelected}
                colorMode={isDark ? 'dark' : 'light'}
                onPolicySearchChange={setEditPolicySearch}
                onTogglePolicy={toggleEditPolicy}
              />
            )}

            {editStep === 3 && (
              <IAMStep3Review
                username={editUsername}
                computedAccessType={editComputedAccessType}
                selectedPolicies={editPolicies}
                colorMode={isDark ? 'dark' : 'light'}
                isEditMode={true}
              />
            )}

            <IAMWizardFooter
              currentStep={editStep}
              colorMode={isDark ? 'dark' : 'light'}
              isEditMode={true}
              onPrevious={() => setEditStep((prev) => (prev - 1) as 1 | 2)}
              onNext={editStep === 1 ? handleEditNextStep1 : handleEditNextStep2}
              onFinish={handleFinishEdit}
            />
          </div>
        </div>
      </div>
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
            onClick={handleStartEdit}
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
              'p-1.5 rounded-md text-slate-400 hover:text-rose-400 transition-colors',
              isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200'
            )}
            title="Delete User"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* AWS-Style Summary Cards */}
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
            {formatDateWithSeconds(user.createdAt)}
          </p>
        </div>

        <div className={cn('p-3 rounded-lg border space-y-1', isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
            <UserCheck size={12} className="text-purple-400" />
            Last Used Activity
          </span>
          <p className={cn('text-xs font-semibold', isActive ? 'text-emerald-400' : isDark ? 'text-slate-400' : 'text-slate-600')}>
            {isActive ? 'Active Session' : 'Never / Inactive'}
          </p>
        </div>
      </div>

      {/* Permissions Policies Table */}
      <div className="space-y-2">
        <span className={cn('text-xs font-semibold block', isDark ? 'text-slate-300' : 'text-slate-700')}>
          Attached IAM Policies ({user.policies?.length || 0})
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
              {user.policies?.map((p) => (
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

      {/* Attached Canvas RoleBindings Table */}
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
                  const createdDate = formatDateWithSeconds(r.createdAt);
                  return (
                    <tr
                      key={`${r.nodeId}-${r.roleId}`}
                      onClick={() => onNavigateToRole(r.nodeId, r.nodeLabel)}
                      className={cn(
                        'transition-colors cursor-pointer',
                        isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                      )}
                    >
                      <td className="py-2 px-3 text-slate-400 text-[11px] font-mono">{bindingId}</td>
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
    </div>
  );
};

interface IAMUserListViewProps {
  readonly iamUsers: readonly KubeIAMUser[];
  readonly filteredUsers: readonly KubeIAMUser[];
  readonly searchFilter: string;
  readonly colorMode: string;
  readonly onSearchChange: (value: string) => void;
  readonly onStartCreate: () => void;
  readonly onSelectUser: (user: KubeIAMUser) => void;
  readonly onDeleteUser: (id: string) => void;
}

const IAMUserListView: React.FC<IAMUserListViewProps> = ({
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
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
          {/* Default Cluster Admin Profile */}
          <div
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border transition-colors',
              activeIdentity === 'system:admin'
                ? isDark
                  ? 'bg-emerald-950/30 border-emerald-500/50'
                  : 'bg-emerald-50/80 border-emerald-300'
                : isDark
                  ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
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
              onClick={() => setActiveIdentity('system:admin')}
              disabled={activeIdentity === 'system:admin'}
              data-testid="use-profile-btn-system-admin"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                activeIdentity === 'system:admin'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
              )}
            >
              {activeIdentity === 'system:admin' ? (
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

interface IAMStepperProps {
  readonly currentStep: IAMStep;
  readonly colorMode: string;
  readonly isEditMode?: boolean;
  readonly onReset: () => void;
}

/**
 * Vertical stepper bar on the left side of the user creation / editing wizard.
 */
const IAMStepper: React.FC<IAMStepperProps> = ({ currentStep, colorMode, isEditMode = false, onReset }) => {
  const isDark = colorMode === 'dark';

  return (
    <div className={cn('w-48 pr-4 border-r flex flex-col justify-between py-1', isDark ? 'border-slate-800' : 'border-slate-200')}>
      <div className="space-y-6 relative">
        <div className={cn('absolute left-3.5 top-3 bottom-3 w-0.5 -z-0', isDark ? 'bg-slate-800' : 'bg-slate-200')} />

        <div className="flex items-start gap-3 relative z-10">
          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors', getStepBadgeClass(1, currentStep, isDark))}>
            {currentStep > 1 ? <Check size={14} /> : '1'}
          </div>
          <div>
            <p className={cn('text-xs font-semibold', getStepTextClass(1, currentStep, isDark))}>
              User Details
            </p>
            <p className={cn('text-[10px]', isDark ? 'text-slate-500' : 'text-slate-400')}>
              Specify username
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 relative z-10">
          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors', getStepBadgeClass(2, currentStep, isDark))}>
            {currentStep > 2 ? <Check size={14} /> : '2'}
          </div>
          <div>
            <p className={cn('text-xs font-semibold', getStepTextClass(2, currentStep, isDark))}>
              Set Permissions
            </p>
            <p className={cn('text-[10px]', isDark ? 'text-slate-500' : 'text-slate-400')}>
              Access policies
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 relative z-10">
          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors', getStepBadgeClass(3, currentStep, isDark))}>
            3
          </div>
          <div>
            <p className={cn('text-xs font-semibold', getStepTextClass(3, currentStep, isDark))}>
              {isEditMode ? 'Review & Update' : 'Review & Create'}
            </p>
            <p className={cn('text-[10px]', isDark ? 'text-slate-500' : 'text-slate-400')}>
              Confirm details
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className={cn(
          'flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors pt-4 border-t',
          isDark ? 'border-slate-800' : 'border-slate-200'
        )}
      >
        <ArrowLeft size={12} />
        {isEditMode ? 'Cancel Editing' : 'Cancel Wizard'}
      </button>
    </div>
  );
};

interface IAMStep1DetailsProps {
  readonly username: string;
  readonly usernameError: string;
  readonly colorMode: string;
  readonly onUsernameChange: (value: string) => void;
}

/**
 * Step 1 of the wizard: enter username.
 */
const IAMStep1Details: React.FC<IAMStep1DetailsProps> = ({
  username,
  usernameError,
  colorMode,
  onUsernameChange,
}) => {
  const isDark = colorMode === 'dark';

  return (
    <div className="space-y-4">
      <div>
        <h4 className={cn('text-sm font-semibold', isDark ? 'text-slate-200' : 'text-slate-800')}>
          User Details
        </h4>
        <p className={cn('text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
          Create a new user identity to grant access to cluster resources.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="kube-iam-username" className={cn('text-xs font-medium block', isDark ? 'text-slate-300' : 'text-slate-700')}>
          User name <span className="text-rose-400">*</span>
        </label>
        <input
          id="kube-iam-username"
          type="text"
          placeholder="e.g. dev-cluster-admin"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          className={cn(
            'w-full px-3 py-2 text-xs rounded-md border outline-none transition-colors',
            usernameError ? 'border-rose-500 focus:border-rose-500' : 'focus:border-emerald-500',
            isDark
              ? 'bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600'
              : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
          )}
        />
        {usernameError && (
          <p className="text-[11px] text-rose-400 font-medium">{usernameError}</p>
        )}
      </div>
    </div>
  );
};

interface IAMStep2PermissionsProps {
  readonly username: string;
  readonly selectedPolicies: readonly string[];
  readonly policySearch: string;
  readonly filteredPolicies: readonly KubeIAMPolicy[];
  readonly isAdminSelected: boolean;
  readonly isOtherSelected: boolean;
  readonly colorMode: string;
  readonly onPolicySearchChange: (value: string) => void;
  readonly onTogglePolicy: (policyName: string) => void;
}

/**
 * Step 2 of the wizard: policy selection.
 */
const IAMStep2Permissions: React.FC<IAMStep2PermissionsProps> = ({
  username,
  selectedPolicies,
  policySearch,
  filteredPolicies,
  isAdminSelected,
  isOtherSelected,
  colorMode,
  onPolicySearchChange,
  onTogglePolicy,
}) => {
  const isDark = colorMode === 'dark';

  return (
    <div className="space-y-4">
      <div>
        <h4 className={cn('text-sm font-semibold', isDark ? 'text-slate-200' : 'text-slate-800')}>
          Set Permissions
        </h4>
        <p className={cn('text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
          Select permission policies to attach to user <span className="text-emerald-400 font-semibold">{username}</span>.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={cn('text-xs font-semibold', isDark ? 'text-slate-300' : 'text-slate-700')}>
            Permissions Policies ({selectedPolicies.length} selected)
          </span>
          <div className="relative w-48">
            <Search size={12} className={cn('absolute left-2 top-1/2 -translate-y-1/2', isDark ? 'text-slate-500' : 'text-slate-400')} />
            <input
              type="text"
              placeholder="Search policies..."
              value={policySearch}
              onChange={(e) => onPolicySearchChange(e.target.value)}
              className={cn(
                'w-full pl-6 pr-2 py-1 text-[11px] rounded border outline-none',
                isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              )}
            />
          </div>
        </div>

        <div className={cn('border rounded-md overflow-hidden max-h-60 overflow-y-auto', isDark ? 'border-slate-700/80 bg-slate-900/50' : 'border-slate-200 bg-white')}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn('text-[10px] font-semibold uppercase tracking-wider border-b', isDark ? 'bg-slate-800/80 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500')}>
                <th className="py-1.5 px-3 w-8"></th>
                <th className="py-1.5 px-3">Policy Name</th>
                <th className="py-1.5 px-3 w-20">Type</th>
                <th className="py-1.5 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filteredPolicies.map((p) => {
                const isSelected = selectedPolicies.includes(p.name);
                const isDisabled = p.name === 'AdministratorAccess'
                  ? isOtherSelected
                  : isAdminSelected;

                return (
                  <tr
                    key={p.name}
                    onClick={() => {
                      if (!isDisabled) onTogglePolicy(p.name);
                    }}
                    className={cn('text-xs transition-colors cursor-pointer', getPolicyRowClass(isSelected, isDark))}
                  >
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => {}}
                        className="rounded accent-emerald-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                      />
                    </td>
                    <td className="py-2 px-3 font-semibold text-emerald-400">
                      {p.name}
                    </td>
                    <td className="py-2 px-3">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium border', isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500')}>
                        {p.type}
                      </span>
                    </td>
                    <td className={cn('py-2 px-3 text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
                      {p.description}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface IAMStep3ReviewProps {
  readonly username: string;
  readonly computedAccessType: string;
  readonly selectedPolicies: readonly string[];
  readonly colorMode: string;
  readonly isEditMode?: boolean;
}

/**
 * Step 3 of the wizard: review and confirm user specifications.
 */
const IAMStep3Review: React.FC<IAMStep3ReviewProps> = ({
  username,
  computedAccessType,
  selectedPolicies,
  colorMode,
  isEditMode = false,
}) => {
  const isDark = colorMode === 'dark';
  const finalPolicies = DEFAULT_POLICIES.filter((p) => selectedPolicies.includes(p.name));

  return (
    <div className="space-y-4">
      <div>
        <h4 className={cn('text-sm font-semibold', isDark ? 'text-slate-200' : 'text-slate-800')}>
          {isEditMode ? 'Review & Update' : 'Review & Create'}
        </h4>
        <p className={cn('text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
          {isEditMode
            ? 'Review updated specifications before saving changes to the Kube IAM user.'
            : 'Review user specifications before creating the Kube IAM user.'}
        </p>
      </div>

      <div className={cn('p-4 rounded-lg border space-y-3', isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200')}>
        <div className="flex justify-between items-center pb-2 border-b border-slate-700/40">
          <span className={cn('text-xs font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>User Name</span>
          <span className={cn('text-xs font-semibold', isDark ? 'text-slate-200' : 'text-slate-800')}>{username}</span>
        </div>

        <div className="flex justify-between items-center pb-2 border-b border-slate-700/40">
          <span className={cn('text-xs font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>Access Type</span>
          <span className="text-xs font-semibold text-emerald-400">{computedAccessType}</span>
        </div>

        <div>
          <span className={cn('text-xs font-medium block mb-1.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
            Attached Policies ({selectedPolicies.length})
          </span>
          <div className="space-y-1">
            {finalPolicies.map((p) => (
              <div key={p.name} className={cn('p-2 rounded border flex items-center justify-between text-xs', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}>
                <div>
                  <span className="font-semibold text-emerald-400">{p.name}</span>
                  <p className={cn('text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>{p.description}</p>
                </div>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', isDark ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500')}>
                  {p.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface IAMWizardFooterProps {
  readonly currentStep: IAMStep;
  readonly colorMode: string;
  readonly isEditMode?: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onFinish: () => void;
}

/**
 * Bottom control buttons (Previous / Next / Create or Update User) for the wizard.
 */
const IAMWizardFooter: React.FC<IAMWizardFooterProps> = ({
  currentStep,
  colorMode,
  isEditMode = false,
  onPrevious,
  onNext,
  onFinish,
}) => {
  const isDark = colorMode === 'dark';

  return (
    <div className="flex items-center justify-between pt-4 border-t border-slate-700/50 mt-4">
      {currentStep > 1 ? (
        <button
          type="button"
          onClick={onPrevious}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
            isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
          )}
        >
          <ArrowLeft size={14} />
          Previous
        </button>
      ) : <div />}

      {currentStep < 3 ? (
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
        >
          Next
          <ArrowRight size={14} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onFinish}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
        >
          <CheckCircle2 size={14} />
          {isEditMode ? 'Update User' : 'Create User'}
        </button>
      )}
    </div>
  );
};

export const KubeIAMModal: React.FC = () => {
  const {
    isOpen,
    colorMode,
    iamUsers,
    deleteIamUser,
    isCreatingUser,
    currentStep,
    setCurrentStep,
    searchFilter,
    setSearchFilter,
    username,
    selectedPolicies,
    policySearch,
    setPolicySearch,
    usernameError,
    computedAccessType,
    resetWizard,
    onClose,
    handleStartCreate,
    handleNextStep1,
    handleNextStep2,
    handleFinishCreate,
    isAdminSelected,
    isOtherSelected,
    togglePolicy,
    filteredUsers,
    filteredPolicies,
    handleUsernameChange,
  } = useKubeIamWizard();

  const [selectedUserDetail, setSelectedUserDetail] = useState<KubeIAMUser | null>(null);
  const nodes = useFlowStore((state) => state.nodes);
  const activeIdentity = useFlowStore((state) => state.activeIdentity);
  const setActiveIdentity = useFlowStore((state) => state.setActiveIdentity);
  const setRoleModalTargetNode = useFlowStore((state) => state.setRoleModalTargetNode);
  const setKubeIamModalOpen = useFlowStore((state) => state.setKubeIamModalOpen);

  const getAttachedRolesForUser = (uname: string): AttachedRoleInfo[] => {
    const rolesList: AttachedRoleInfo[] = [];
    for (const node of nodes) {
      if (!Array.isArray(node.data?.roles)) continue;
      for (const role of node.data.roles) {
        if (role.assignedUsers?.includes(uname)) {
          rolesList.push({
            nodeId: node.id,
            nodeLabel: node.data.label || node.id,
            nodeType: node.type,
            roleId: role.id,
            roleName: role.name,
            createdAt: role.createdAt,
          });
        }
      }
    }
    return rolesList;
  };

  const handleNavigateToRole = (nodeId: string, nodeLabel: string) => {
    setKubeIamModalOpen(false);
    setRoleModalTargetNode({ id: nodeId, label: nodeLabel });
  };

  const renderBodyContent = () => {
    if (selectedUserDetail) {
      return (
        <IAMUserDetailView
          user={selectedUserDetail}
          isActive={activeIdentity === selectedUserDetail.username}
          isDark={colorMode === 'dark'}
          attachedRoles={getAttachedRolesForUser(selectedUserDetail.username)}
          onBack={() => setSelectedUserDetail(null)}
          onSelectActive={setActiveIdentity}
          onDeleteUser={deleteIamUser}
          onNavigateToRole={handleNavigateToRole}
        />
      );
    }

    if (!isCreatingUser) {
      return (
        <IAMUserListView
          iamUsers={iamUsers}
          filteredUsers={filteredUsers}
          searchFilter={searchFilter}
          colorMode={colorMode}
          onSearchChange={setSearchFilter}
          onStartCreate={handleStartCreate}
          onSelectUser={(u) => setSelectedUserDetail(u)}
          onDeleteUser={deleteIamUser}
        />
      );
    }

    return (
      <div className="flex flex-1 gap-6 overflow-hidden">
        <IAMStepper
          currentStep={currentStep}
          colorMode={colorMode}
          onReset={resetWizard}
        />

        <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
          {currentStep === 1 && (
            <IAMStep1Details
              username={username}
              usernameError={usernameError}
              colorMode={colorMode}
              onUsernameChange={handleUsernameChange}
            />
          )}

          {currentStep === 2 && (
            <IAMStep2Permissions
              username={username}
              selectedPolicies={selectedPolicies}
              policySearch={policySearch}
              filteredPolicies={filteredPolicies}
              isAdminSelected={isAdminSelected}
              isOtherSelected={isOtherSelected}
              colorMode={colorMode}
              onPolicySearchChange={setPolicySearch}
              onTogglePolicy={togglePolicy}
            />
          )}

          {currentStep === 3 && (
            <IAMStep3Review
              username={username}
              computedAccessType={computedAccessType}
              selectedPolicies={selectedPolicies}
              colorMode={colorMode}
            />
          )}

          <IAMWizardFooter
            currentStep={currentStep}
            colorMode={colorMode}
            onPrevious={() => setCurrentStep((prev) => (prev - 1) as 1 | 2)}
            onNext={currentStep === 1 ? handleNextStep1 : handleNextStep2}
            onFinish={handleFinishCreate}
          />
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setSelectedUserDetail(null);
        onClose();
      }}
      title="Kube IAM Management"
      icon={UserCheck}
      iconColorClass="text-emerald-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="max-h-[85vh] h-[70vh]"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {renderBodyContent()}
      </div>
    </Modal>
  );
};
