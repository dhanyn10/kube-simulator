import React from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { KubeIAMPolicy } from '../../../types';
import { DEFAULT_POLICIES, IAMStep, getStepBadgeClass, getStepTextClass, getPolicyRowClass } from '../../../activity/modals';

export interface IAMStepperProps {
  readonly currentStep: IAMStep;
  readonly colorMode: string;
  readonly isEditMode?: boolean;
  readonly onReset: () => void;
}

export const IAMStepper: React.FC<IAMStepperProps> = ({ currentStep, colorMode, isEditMode = false, onReset }) => {
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
          'flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors pt-4 border-t cursor-pointer',
          isDark ? 'border-slate-800' : 'border-slate-200'
        )}
      >
        <ArrowLeft size={12} />
        {isEditMode ? 'Cancel Editing' : 'Cancel Wizard'}
      </button>
    </div>
  );
};

export interface IAMStep1DetailsProps {
  readonly username: string;
  readonly usernameError: string;
  readonly colorMode: string;
  readonly onUsernameChange: (value: string) => void;
}

export const IAMStep1Details: React.FC<IAMStep1DetailsProps> = ({
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

export interface IAMStep2PermissionsProps {
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

export const IAMStep2Permissions: React.FC<IAMStep2PermissionsProps> = ({
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
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => onTogglePolicy(p.name)}
                        className="font-semibold text-emerald-400 hover:underline cursor-pointer disabled:cursor-not-allowed disabled:no-underline"
                      >
                        {p.name}
                      </button>
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

export interface IAMStep3ReviewProps {
  readonly username: string;
  readonly computedAccessType: string;
  readonly selectedPolicies: readonly string[];
  readonly colorMode: string;
  readonly isEditMode?: boolean;
}

export const IAMStep3Review: React.FC<IAMStep3ReviewProps> = ({
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

export interface IAMWizardFooterProps {
  readonly currentStep: IAMStep;
  readonly colorMode: string;
  readonly isEditMode?: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onFinish: () => void;
}

export const IAMWizardFooter: React.FC<IAMWizardFooterProps> = ({
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
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer',
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
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm cursor-pointer"
        >
          Next
          <ArrowRight size={14} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onFinish}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm cursor-pointer"
        >
          <CheckCircle2 size={14} />
          {isEditMode ? 'Update User' : 'Create User'}
        </button>
      )}
    </div>
  );
};
