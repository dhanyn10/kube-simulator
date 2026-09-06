import React, { useState, useRef, useEffect } from 'react';
import { UserCheck, Plus, Trash2, Shield, UserPlus, KeyRound, Check, ChevronRight, ArrowLeft } from 'lucide-react';
import { Modal } from './Modal';
import { KubeIAMUser } from '../../types';
import { useFlowStore } from '../../store';
import { cn, sanitizeSlug } from '../../lib/utils';
import { AutocompleteDropdown, AutocompleteSuggestion } from '../UI/AutocompleteDropdown';

interface KubeIAMModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface IAMPolicyTemplate {
  name: string;
  accessType: 'Full' | 'Read-Only' | 'Custom';
  category: string;
  description: string;
}

const AWS_IAM_POLICY_TEMPLATES: IAMPolicyTemplate[] = [
  {
    name: 'AdministratorAccess',
    accessType: 'Full',
    category: 'AWS Managed Policy',
    description: 'Full access to all Kubernetes resources and cluster API groups.',
  },
  {
    name: 'ReadOnlyAccess',
    accessType: 'Read-Only',
    category: 'AWS Managed Policy',
    description: 'Read-only permissions across Pods, Deployments, Services, ConfigMaps, and Secrets.',
  },
  {
    name: 'PowerUserAccess',
    accessType: 'Custom',
    category: 'AWS Managed Policy',
    description: 'Full CRUD permissions for Workloads & Services without cluster admin rights.',
  },
  {
    name: 'ContainerDeveloperPolicy',
    accessType: 'Custom',
    category: 'Job Function Policy',
    description: 'Developer access for deploying and inspecting application containers and logs.',
  },
  {
    name: 'NetworkingAdminPolicy',
    accessType: 'Custom',
    category: 'Job Function Policy',
    description: 'Full management of network endpoints, Services, Ingresses, and routing.',
  },
  {
    name: 'StorageAdminPolicy',
    accessType: 'Custom',
    category: 'Job Function Policy',
    description: 'Storage administrator access for PersistentVolumeClaims and Volumes.',
  },
];

export const KubeIAMModal: React.FC<KubeIAMModalProps> = ({ isOpen, onClose }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const iamUsers = useFlowStore((state) => state.iamUsers);
  const addIamUser = useFlowStore((state) => state.addIamUser);
  const deleteIamUser = useFlowStore((state) => state.deleteIamUser);
  const addLog = useFlowStore((state) => state.addLog);

  // Creation Wizard Steps: 1 = User Details, 2 = Permissions, 3 = Review
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [username, setUsername] = useState('');
  const [selectedPolicyName, setSelectedPolicyName] = useState('');

  // Policy Search & Autocomplete state - initially empty
  const [policyInputValue, setPolicyInputValue] = useState('');
  const [isPolicyFocused, setIsPolicyFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openUpward, setOpenUpward] = useState(false);
  const policyContainerRef = useRef<HTMLDivElement>(null);

  const currentPolicy = AWS_IAM_POLICY_TEMPLATES.find((p) => p.name.toLowerCase() === selectedPolicyName.toLowerCase()) || {
    name: selectedPolicyName || 'CustomAccess',
    accessType: 'Custom' as const,
    category: 'Custom Policy',
    description: 'Custom access policy assigned to user',
  };

  useEffect(() => {
    if (isPolicyFocused && policyContainerRef.current) {
      const rect = policyContainerRef.current.getBoundingClientRect();
      const scrollParent = policyContainerRef.current.closest('.custom-scrollbar') || policyContainerRef.current.closest('.overflow-y-auto');

      let spaceBelow = window.innerHeight - rect.bottom;
      let spaceAbove = rect.top;

      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        spaceBelow = parentRect.bottom - rect.bottom;
        spaceAbove = rect.top - parentRect.top;
      }

      setOpenUpward(spaceBelow < 180 && spaceAbove > 120);
    }
  }, [isPolicyFocused, policyInputValue]);

  if (!isOpen) return null;

  // Show suggestions ONLY when the user starts typing (matching CLI console experience)
  const policySuggestions: AutocompleteSuggestion[] = !policyInputValue.trim()
    ? []
    : AWS_IAM_POLICY_TEMPLATES
        .map((p) => ({
          label: p.name,
          value: p.name,
          category: p.category,
          description: p.description,
        }))
        .filter((item) => {
          const lower = policyInputValue.toLowerCase().trim();
          return item.label.toLowerCase().includes(lower) || (item.description && item.description.toLowerCase().includes(lower));
        });

  const handleSelectPolicy = (policyName: string) => {
    setSelectedPolicyName(policyName);
    setPolicyInputValue(policyName);
    setIsPolicyFocused(false);
  };

  const handleCreateUser = () => {
    const cleanUsername = sanitizeSlug(username);
    if (!cleanUsername) return;

    if (iamUsers.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      addLog('warn', `[Kube IAM] User "${cleanUsername}" already exists!`, 'UI');
      return;
    }

    const newUser: KubeIAMUser = {
      id: `iam-user-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      username: cleanUsername,
      accessType: currentPolicy.accessType,
      createdAt: Date.now(),
    };

    addIamUser(newUser);
    addLog('info', `[Kube IAM] Created IAM User "${cleanUsername}" with Policy ${currentPolicy.name}`, 'UI');

    // Reset wizard
    setUsername('');
    setSelectedPolicyName('');
    setPolicyInputValue('');
    setCurrentStep(1);
  };

  const handleDeleteUser = (userId: string, uname: string) => {
    deleteIamUser(userId);
    addLog('info', `[Kube IAM] Deleted IAM User "${uname}"`, 'UI');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kube IAM (Identity & Access Management)"
      subtitle="AWS IAM Step-by-Step Creation Wizard: Create User -> Attach Access Policy -> Review"
      icon={UserCheck}
      iconColorClass="text-blue-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[75vh]"
    >
      <div className="space-y-5">
        {/* AWS IAM Stepper Header */}
        <div className={cn(
          "p-2.5 rounded-xl border flex items-center justify-between font-mono text-xs",
          colorMode === 'dark' ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
        )}>
          <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all", currentStep === 1 ? "bg-blue-600 text-white shadow-sm" : "text-slate-400")}>
            <span>1</span> <span>User Details</span>
          </div>
          <ChevronRight size={14} className="text-slate-500" />
          <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all", currentStep === 2 ? "bg-blue-600 text-white shadow-sm" : "text-slate-400")}>
            <span>2</span> <span>Permissions & Policy</span>
          </div>
          <ChevronRight size={14} className="text-slate-500" />
          <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all", currentStep === 3 ? "bg-blue-600 text-white shadow-sm" : "text-slate-400")}>
            <span>3</span> <span>Review & Create</span>
          </div>
        </div>

        {/* Step 1: User Details */}
        {currentStep === 1 && (
          <div className={cn("p-4 rounded-xl border space-y-4", colorMode === 'dark' ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200")}>
            <div className="flex items-center gap-2">
              <UserPlus size={16} className="text-blue-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Step 1: Specify User Details
              </h4>
            </div>

            <div>
              <label htmlFor="iam-username-input" className="block text-[11px] font-semibold text-slate-400 mb-1">
                IAM Username / Account ID *
              </label>
              <input
                id="iam-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. dev-user, admin-user, auditor"
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/50",
                  colorMode === 'dark' ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-300 text-slate-900"
                )}
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!username.trim()}
                onClick={() => setCurrentStep(2)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                Next: Set Permissions <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Permissions & Policy */}
        {currentStep === 2 && (
          <div className={cn("p-4 rounded-xl border space-y-4", colorMode === 'dark' ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-blue-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Step 2: Attach Permission Policy
                </h4>
              </div>
              <span className="text-[11px] font-mono text-blue-400 font-bold">
                User: {username}
              </span>
            </div>

            {/* AWS IAM Interactive Type & Autocomplete Dropdown */}
            <div ref={policyContainerRef} className="relative">
              <label htmlFor="iam-policy-autocomplete" className="block text-[11px] font-semibold text-slate-400 mb-1">
                Type Policy Name (Start typing to view autocomplete options) *
              </label>
              <div className="relative">
                <input
                  id="iam-policy-autocomplete"
                  type="text"
                  value={policyInputValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPolicyInputValue(val);
                    setSelectedPolicyName(val);
                    setSelectedIndex(0);
                    setIsPolicyFocused(true);
                  }}
                  onFocus={() => {
                    setIsPolicyFocused(true);
                    setSelectedIndex(0);
                  }}
                  onBlur={() => {
                    setTimeout(() => setIsPolicyFocused(false), 200);
                  }}
                  onKeyDown={(e) => {
                    if (!isPolicyFocused || policySuggestions.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedIndex((prev) => (prev + 1) % policySuggestions.length);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedIndex((prev) => (prev - 1 + policySuggestions.length) % policySuggestions.length);
                    } else if ((e.key === 'Enter' || e.key === 'Tab') && policySuggestions[selectedIndex]) {
                      e.preventDefault();
                      handleSelectPolicy(policySuggestions[selectedIndex].value);
                    } else if (e.key === 'Escape') {
                      setIsPolicyFocused(false);
                    }
                  }}
                  placeholder="e.g. Type 'Admin', 'ReadOnly', or 'Developer'..."
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/50",
                    colorMode === 'dark' ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-300 text-slate-900"
                  )}
                />

                {isPolicyFocused && policySuggestions.length > 0 && (
                  <AutocompleteDropdown
                    suggestions={policySuggestions}
                    selectedIndex={selectedIndex}
                    onSelect={(item) => handleSelectPolicy(item.value)}
                    onHoverIndex={(idx) => setSelectedIndex(idx)}
                    colorMode={colorMode === 'dark' ? 'dark' : 'light'}
                    openUpward={openUpward}
                    showIcon={false}
                  />
                )}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1", colorMode === 'dark' ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-700")}
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="button"
                disabled={!policyInputValue.trim()}
                onClick={() => setCurrentStep(3)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                Next: Review <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Create */}
        {currentStep === 3 && (
          <div className={cn("p-4 rounded-xl border space-y-4", colorMode === 'dark' ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200")}>
            <div className="flex items-center gap-2">
              <Check size={16} className="text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Step 3: Review & Finalize User Creation
              </h4>
            </div>

            <div className={cn("p-3.5 rounded-xl border space-y-3 font-mono text-xs", colorMode === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200")}>
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">Username / Account ID:</span>
                <span className="font-bold text-blue-400">{username}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">Attached Policy:</span>
                <span className="font-bold text-indigo-400">{currentPolicy.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Access Scope:</span>
                <span className="font-bold text-emerald-400">{currentPolicy.accessType} Access</span>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1", colorMode === 'dark' ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-700")}
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="button"
                onClick={handleCreateUser}
                className="px-5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} /> Create IAM User Account
              </button>
            </div>
          </div>
        )}

        {/* Existing Users List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Shield size={14} className="text-indigo-400" /> Active IAM Accounts ({iamUsers.length})
            </h4>
          </div>

          <div className="grid gap-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
            {iamUsers.map((u) => (
              <div
                key={u.id}
                className={cn("p-2.5 rounded-xl border flex items-center justify-between transition-colors", colorMode === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200")}
              >
                <div className="flex items-center gap-2">
                  <KeyRound size={13} className="text-blue-400" />
                  <span className="text-xs font-mono font-bold text-blue-400">{u.username}</span>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-semibold border", u.accessType === 'Full' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : u.accessType === 'Read-Only' ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "bg-purple-500/20 text-purple-300 border-purple-500/40")}>
                    {u.accessType || 'Full'} Access
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteUser(u.id, u.username)}
                  className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Delete User"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {iamUsers.length === 0 && (
              <div className="text-center py-4 text-slate-500 text-xs font-mono">
                No IAM Users created yet. Follow the 3-step wizard above.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
