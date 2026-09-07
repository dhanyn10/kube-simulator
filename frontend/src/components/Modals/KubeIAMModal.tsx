import React, { useState } from 'react';
import { Key, UserPlus, Trash2, Shield, Plus, X, Search, CheckCircle } from 'lucide-react';
import { Modal } from './Modal';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { AutocompleteDropdown, AutocompleteSuggestion } from '../UI/AutocompleteDropdown';

interface KubeIAMModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_IAM_ROLES: AutocompleteSuggestion[] = [
  {
    label: 'AdministratorAccess',
    value: 'AdministratorAccess',
    category: 'System Policy',
    description: 'Provides full access to Kubernetes cluster resources and services.',
  },
  {
    label: 'ReadOnlyAccess',
    value: 'ReadOnlyAccess',
    category: 'System Policy',
    description: 'Provides read-only access to view workloads and configurations.',
  },
  {
    label: 'PowerUserAccess',
    value: 'PowerUserAccess',
    category: 'System Policy',
    description: 'Provides full access except user management and administrative controls.',
  },
  {
    label: 'ContainerDeveloperPolicy',
    value: 'ContainerDeveloperPolicy',
    category: 'Custom Policy',
    description: 'Allows deploying, scaling, and managing container workloads and pods.',
  },
  {
    label: 'NetworkingAdminPolicy',
    value: 'NetworkingAdminPolicy',
    category: 'Custom Policy',
    description: 'Full access to Services, Ingresses, and NetworkPolicies.',
  },
  {
    label: 'StorageAdminPolicy',
    value: 'StorageAdminPolicy',
    category: 'Custom Policy',
    description: 'Full access to PersistentVolumeClaims and StorageClasses.',
  },
];

export const KubeIAMModal: React.FC<KubeIAMModalProps> = ({ isOpen, onClose }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const iamUsers = useFlowStore((state) => state.iamUsers);
  const addIamUser = useFlowStore((state) => state.addIamUser);
  const deleteIamUser = useFlowStore((state) => state.deleteIamUser);
  const addLog = useFlowStore((state) => state.addLog);

  const [activeTab, setActiveTab] = useState<'users' | 'add'>('users');
  const [usernameInput, setUsernameInput] = useState('');
  const [accountIdInput, setAccountIdInput] = useState('123456789012');
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>(['ReadOnlyAccess']);

  const [policySearchText, setPolicySearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAutocompleteFocused, setIsAutocompleteFocused] = useState(false);

  const filteredSuggestions = PRESET_IAM_ROLES.filter((p) => {
    if (selectedPolicies.includes(p.value)) return false;
    if (!policySearchText.trim()) return true;
    const lower = policySearchText.toLowerCase();
    return p.label.toLowerCase().includes(lower) || (p.description && p.description.toLowerCase().includes(lower));
  });

  if (!isOpen) return null;

  const handleAddUser = () => {
    if (!usernameInput.trim()) return;
    addIamUser({
      username: usernameInput.trim(),
      accountId: accountIdInput.trim() || '123456789012',
      roles: selectedPolicies,
      attachedPolicies: selectedPolicies,
    });
    addLog('info', `[Kube IAM Action] Created IAM User '${usernameInput.trim()}' with policies: ${selectedPolicies.join(', ')}`, 'UI');

    // Reset Form
    setUsernameInput('');
    setSelectedPolicies(['ReadOnlyAccess']);
    setActiveTab('users');
  };

  const handleSelectPolicy = (suggestion: AutocompleteSuggestion) => {
    if (!selectedPolicies.includes(suggestion.value)) {
      setSelectedPolicies((prev) => [...prev, suggestion.value]);
    }
    setPolicySearchText('');
    setSelectedIndex(0);
  };

  const handleRemovePolicy = (policyName: string) => {
    setSelectedPolicies((prev) => prev.filter((p) => p !== policyName));
  };

  const footer = (
    <div className="flex items-center justify-between">
      <div className="text-[11px] text-amber-500 font-mono flex items-center gap-1.5">
        <Shield size={13} />
        <span>Kube IAM Integration</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
            colorMode === 'dark'
              ? "border-slate-700 hover:bg-slate-800 text-slate-300"
              : "border-slate-300 hover:bg-slate-100 text-slate-700"
          )}
        >
          Close
        </button>
        {activeTab === 'add' && (
          <button
            type="button"
            onClick={handleAddUser}
            disabled={!usernameInput.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white shadow-md transition-all"
          >
            Create User
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kube IAM Management"
      subtitle="Identity & Access Management for Kubernetes Clusters"
      icon={Key}
      iconColorClass="text-amber-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[70vh]"
      footer={footer}
    >
      <div className="space-y-4">
        {/* Navigation Tabs Header */}
        <div className={cn("flex items-center border-b pb-2 gap-4", colorMode === 'dark' ? "border-slate-800" : "border-slate-200")}>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
              activeTab === 'users'
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                : colorMode === 'dark' ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Shield size={14} /> IAM Users ({iamUsers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
              activeTab === 'add'
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                : colorMode === 'dark' ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <UserPlus size={14} /> Add New User
          </button>
        </div>

        {activeTab === 'users' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active IAM Users</span>
              <button
                type="button"
                onClick={() => setActiveTab('add')}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} /> Add User
              </button>
            </div>

            {iamUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No IAM Users configured. Click "Add User" to create one.
              </div>
            ) : (
              <div className="space-y-2">
                {iamUsers.map((user) => (
                  <div
                    key={user.id}
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between transition-all",
                      colorMode === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-400">{user.username}</span>
                        <span className="text-[10px] font-mono text-slate-500">iam::{user.accountId}:user/{user.username}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {user.attachedPolicies.map((pol) => (
                          <span
                            key={`pol-${user.id}-${pol}`}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          >
                            {pol}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        deleteIamUser(user.id);
                        addLog('info', `[Kube IAM Action] Deleted IAM User '${user.username}'`, 'UI');
                      }}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete User"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: User Details */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">User Details</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="iam-username-input" className="block text-xs text-slate-400 mb-1">User Name</label>
                  <input
                    id="iam-username-input"
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="e.g. dev-cluster-admin"
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-amber-500/50 transition-all",
                      colorMode === 'dark' ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-slate-50 border-slate-300 text-slate-900"
                    )}
                  />
                </div>
                <div>
                  <label htmlFor="iam-account-input" className="block text-xs text-slate-400 mb-1">Account ID</label>
                  <input
                    id="iam-account-input"
                    type="text"
                    value={accountIdInput}
                    onChange={(e) => setAccountIdInput(e.target.value)}
                    placeholder="123456789012"
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-amber-500/50 transition-all",
                      colorMode === 'dark' ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-slate-50 border-slate-300 text-slate-900"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Permissions & Policy Selection with Autocomplete */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Attach Permissions & Policies
              </label>

              {/* Selected Policy Tags */}
              <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
                {selectedPolicies.map((polName) => (
                  <span
                    key={`selected-${polName}`}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  >
                    <span>{polName}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePolicy(polName)}
                      className="hover:opacity-80 p-0.5 rounded-full transition-opacity cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>

              {/* CLI-Style Autocomplete Role Search Bar */}
              <div className="relative">
                <div className={cn(
                  "p-2 rounded-lg border flex items-center gap-2 transition-all",
                  isAutocompleteFocused ? "ring-2 ring-amber-500/50 border-amber-500" : "border-slate-800",
                  colorMode === 'dark' ? "bg-slate-950" : "bg-white"
                )}>
                  <Search size={14} className="text-amber-400 shrink-0" />
                  <input
                    type="text"
                    value={policySearchText}
                    onChange={(e) => {
                      setPolicySearchText(e.target.value);
                      setSelectedIndex(0);
                    }}
                    onFocus={() => setIsAutocompleteFocused(true)}
                    onBlur={() => setTimeout(() => setIsAutocompleteFocused(false), 200)}
                    placeholder="Search IAM Role or Policy (e.g. AdministratorAccess)..."
                    className="w-full bg-transparent text-xs font-mono outline-none"
                  />
                </div>

                {isAutocompleteFocused && filteredSuggestions.length > 0 && (
                  <AutocompleteDropdown
                    suggestions={filteredSuggestions}
                    selectedIndex={selectedIndex}
                    onSelect={handleSelectPolicy}
                    onHoverIndex={(idx) => setSelectedIndex(idx)}
                    colorMode={colorMode === 'dark' ? 'dark' : 'light'}
                    showIcon={true}
                  />
                )}
              </div>
            </div>

            {/* Review Card */}
            <div className={cn("p-3 rounded-xl border space-y-1.5", colorMode === 'dark' ? "bg-slate-950/50 border-slate-800" : "bg-slate-100/60 border-slate-200")}>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <CheckCircle size={14} />
                <span>Kube IAM Summary</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Creating user <span className="font-mono text-amber-300">{usernameInput || '(unnamed)'}</span> under account <span className="font-mono text-slate-300">{accountIdInput || '123456789012'}</span> with {selectedPolicies.length} attached policy rules.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
