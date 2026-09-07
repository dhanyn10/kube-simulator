import React, { useState } from 'react';
import { User, UserPlus, Trash2, CheckCircle2, Shield, Search, ArrowRight, ArrowLeft, Check, Lock, UserCheck } from 'lucide-react';
import { Modal } from './Modal';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { KubeIAMPolicy } from '../../types';

const DEFAULT_POLICIES: KubeIAMPolicy[] = [
  {
    name: 'AdministratorAccess',
    type: 'Default',
    description: 'Provides full access to Kube resources and cluster management.'
  },
  {
    name: 'ReadOnlyAccess',
    type: 'Default',
    description: 'Provides read-only access to view workloads, services, and configs.'
  },
  {
    name: 'PowerUserAccess',
    type: 'Default',
    description: 'Provides full access to application workloads without security admin controls.'
  },
  {
    name: 'ContainerDeveloperPolicy',
    type: 'Default',
    description: 'Allows managing deployments, pods, and service connections.'
  },
  {
    name: 'NetworkingAdminPolicy',
    type: 'Default',
    description: 'Allows configuring services, ingresses, and external traffic routing.'
  },
  {
    name: 'StorageAdminPolicy',
    type: 'Default',
    description: 'Provides full access to PVCs and storage configuration.'
  }
];

export const KubeIAMModal: React.FC = () => {
  const isOpen = useFlowStore((state) => state.isKubeIamModalOpen);
  const onClose = () => {
    useFlowStore.getState().setKubeIamModalOpen(false);
    resetWizard();
  };
  const colorMode = useFlowStore((state) => state.colorMode);
  const iamUsers = useFlowStore((state) => state.iamUsers);
  const addIamUser = useFlowStore((state) => state.addIamUser);
  const deleteIamUser = useFlowStore((state) => state.deleteIamUser);

  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [searchFilter, setSearchFilter] = useState('');

  // Wizard state
  const [username, setUsername] = useState('');
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>(['AdministratorAccess']);
  const [policySearch, setPolicySearch] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const computedAccessType: 'Full Access' | 'Managed Access' = selectedPolicies.includes('AdministratorAccess')
    ? 'Full Access'
    : 'Managed Access';

  const resetWizard = () => {
    setIsCreatingUser(false);
    setCurrentStep(1);
    setUsername('');
    setSelectedPolicies(['AdministratorAccess']);
    setPolicySearch('');
    setUsernameError('');
  };

  const handleStartCreate = () => {
    setIsCreatingUser(true);
    setCurrentStep(1);
  };

  const handleNextStep1 = () => {
    if (!username.trim()) {
      setUsernameError('Username is required');
      return;
    }
    const exists = iamUsers.some((u) => u.username.toLowerCase() === username.trim().toLowerCase());
    if (exists) {
      setUsernameError('Username already exists');
      return;
    }
    setUsernameError('');
    setCurrentStep(2);
  };

  const handleNextStep2 = () => {
    if (selectedPolicies.length === 0) {
      return;
    }
    setCurrentStep(3);
  };

  const handleFinishCreate = () => {
    const finalPolicies = DEFAULT_POLICIES.filter((p) => selectedPolicies.includes(p.name));

    addIamUser({
      username: username.trim(),
      accessType: computedAccessType,
      policies: finalPolicies,
    });

    resetWizard();
  };

  const isAdminSelected = selectedPolicies.includes('AdministratorAccess');
  const isOtherSelected = selectedPolicies.some((p) => p !== 'AdministratorAccess');

  const togglePolicy = (policyName: string) => {
    // If selecting AdministratorAccess, uncheck all others
    if (policyName === 'AdministratorAccess') {
      if (isAdminSelected) {
        setSelectedPolicies([]);
      } else {
        setSelectedPolicies(['AdministratorAccess']);
      }
      return;
    }

    // If selecting another policy and AdministratorAccess is selected, replace AdministratorAccess
    setSelectedPolicies((prev) => {
      const withoutAdmin = prev.filter((p) => p !== 'AdministratorAccess');
      return withoutAdmin.includes(policyName)
        ? withoutAdmin.filter((p) => p !== policyName)
        : [...withoutAdmin, policyName];
    });
  };

  const filteredUsers = iamUsers.filter((u) =>
    u.username.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredPolicies = DEFAULT_POLICIES.filter((p) =>
    p.name.toLowerCase().includes(policySearch.toLowerCase()) ||
    p.description.toLowerCase().includes(policySearch.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kube IAM Management"
      icon={UserCheck}
      iconColorClass="text-emerald-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="max-h-[85vh] h-[70vh]"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {!isCreatingUser ? (
          /* User List View */
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/50">
              <div>
                <h3 className={cn("text-sm font-semibold flex items-center gap-2", colorMode === 'dark' ? "text-slate-200" : "text-slate-800")}>
                  <User size={16} className="text-emerald-400" />
                  Kube IAM Users ({iamUsers.length})
                </h3>
                <p className={cn("text-xs mt-0.5", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>
                  Manage user identities and access control policies for Kube cluster resources.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
              >
                <UserPlus size={14} />
                Create User
              </button>
            </div>

            {iamUsers.length > 0 && (
              <div className="relative mb-3">
                <Search size={14} className={cn("absolute left-2.5 top-1/2 -translate-y-1/2", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")} />
                <input
                  type="text"
                  placeholder="Filter users by name..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className={cn(
                    "w-full pl-8 pr-3 py-1.5 text-xs rounded-md border outline-none transition-colors",
                    colorMode === 'dark'
                      ? "bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-emerald-500"
                      : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-emerald-500"
                  )}
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-1">
              {filteredUsers.length === 0 ? (
                <div className={cn("flex flex-col items-center justify-center h-48 rounded-lg border border-dashed p-6 text-center", colorMode === 'dark' ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-400")}>
                  <User size={32} className="mb-2 opacity-40 text-emerald-400" />
                  <p className="text-xs font-medium mb-1">
                    {iamUsers.length === 0 ? "No IAM users created yet" : "No users match your filter"}
                  </p>
                  <p className="text-[11px] max-w-xs mb-4">
                    {iamUsers.length === 0
                      ? "Create your first Kube IAM user to manage access permissions and roles."
                      : "Try clearing your search query."}
                  </p>
                  {iamUsers.length === 0 && (
                    <button
                      type="button"
                      onClick={handleStartCreate}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                    >
                      <UserPlus size={14} />
                      Create User
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors",
                        colorMode === 'dark'
                          ? "bg-slate-800/60 border-slate-700/80 hover:bg-slate-800"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100/80"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-md mt-0.5", colorMode === 'dark' ? "bg-slate-900 text-emerald-400" : "bg-white text-emerald-600 border border-slate-200")}>
                          <User size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs font-semibold", colorMode === 'dark' ? "text-slate-200" : "text-slate-800")}>
                              {user.username}
                            </span>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider",
                              user.accessType === 'Full Access'
                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            )}>
                              {user.accessType}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {user.policies.map((p) => (
                              <span
                                key={p.name}
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded border",
                                  colorMode === 'dark'
                                    ? "bg-slate-900 border-slate-700 text-slate-300"
                                    : "bg-white border-slate-200 text-slate-600"
                                )}
                              >
                                {p.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteIamUser(user.id)}
                        className={cn(
                          "p-1.5 rounded-md text-slate-400 hover:text-rose-400 transition-colors",
                          colorMode === 'dark' ? "hover:bg-slate-700" : "hover:bg-slate-200"
                        )}
                        title="Delete User"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Wizard View with Vertical Stepper */
          <div className="flex flex-1 gap-6 overflow-hidden">
            {/* Left Vertical Stepper Bar */}
            <div className={cn("w-48 pr-4 border-r flex flex-col justify-between py-1", colorMode === 'dark' ? "border-slate-800" : "border-slate-200")}>
              <div className="space-y-6 relative">
                {/* Connecting Line */}
                <div className={cn("absolute left-3.5 top-3 bottom-3 w-0.5 -z-0", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-200")} />

                {/* Step 1 */}
                <div className="flex items-start gap-3 relative z-10">
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                    currentStep === 1
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/20"
                      : currentStep > 1
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : colorMode === 'dark' ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"
                  )}>
                    {currentStep > 1 ? <Check size={14} /> : "1"}
                  </div>
                  <div>
                    <p className={cn("text-xs font-semibold", currentStep === 1 ? "text-emerald-400" : colorMode === 'dark' ? "text-slate-300" : "text-slate-700")}>
                      User Details
                    </p>
                    <p className={cn("text-[10px]", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>
                      Specify username
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 relative z-10">
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                    currentStep === 2
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/20"
                      : currentStep > 2
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : colorMode === 'dark' ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"
                  )}>
                    {currentStep > 2 ? <Check size={14} /> : "2"}
                  </div>
                  <div>
                    <p className={cn("text-xs font-semibold", currentStep === 2 ? "text-emerald-400" : colorMode === 'dark' ? "text-slate-300" : "text-slate-700")}>
                      Set Permissions
                    </p>
                    <p className={cn("text-[10px]", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>
                      Access policies
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 relative z-10">
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                    currentStep === 3
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/20"
                      : colorMode === 'dark' ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"
                  )}>
                    3
                  </div>
                  <div>
                    <p className={cn("text-xs font-semibold", currentStep === 3 ? "text-emerald-400" : colorMode === 'dark' ? "text-slate-300" : "text-slate-700")}>
                      Review & Create
                    </p>
                    <p className={cn("text-[10px]", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")}>
                      Confirm details
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={resetWizard}
                className={cn(
                  "flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors pt-4 border-t",
                  colorMode === 'dark' ? "border-slate-800" : "border-slate-200"
                )}
              >
                <ArrowLeft size={12} />
                Cancel Wizard
              </button>
            </div>

            {/* Right Form Content */}
            <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
              {/* STEP 1: User Details */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h4 className={cn("text-sm font-semibold", colorMode === 'dark' ? "text-slate-200" : "text-slate-800")}>
                      User Details
                    </h4>
                    <p className={cn("text-xs mt-0.5", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>
                      Create a new user identity to grant access to cluster resources.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className={cn("text-xs font-medium block", colorMode === 'dark' ? "text-slate-300" : "text-slate-700")}>
                      User name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. dev-cluster-admin"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (usernameError) setUsernameError('');
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-xs rounded-md border outline-none transition-colors",
                        usernameError ? "border-rose-500 focus:border-rose-500" : "focus:border-emerald-500",
                        colorMode === 'dark'
                          ? "bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600"
                          : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
                      )}
                    />
                    {usernameError && (
                      <p className="text-[11px] text-rose-400 font-medium">{usernameError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: Set Permissions */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h4 className={cn("text-sm font-semibold", colorMode === 'dark' ? "text-slate-200" : "text-slate-800")}>
                      Set Permissions
                    </h4>
                    <p className={cn("text-xs mt-0.5", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>
                      Select permission policies to attach to user <span className="text-emerald-400 font-semibold">{username}</span>.
                    </p>
                  </div>

                  {/* Managed Policy List Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={cn("text-xs font-semibold", colorMode === 'dark' ? "text-slate-300" : "text-slate-700")}>
                        Permissions Policies ({selectedPolicies.length} selected)
                      </label>
                      <div className="relative w-48">
                        <Search size={12} className={cn("absolute left-2 top-1/2 -translate-y-1/2", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")} />
                        <input
                          type="text"
                          placeholder="Search policies..."
                          value={policySearch}
                          onChange={(e) => setPolicySearch(e.target.value)}
                          className={cn(
                            "w-full pl-6 pr-2 py-1 text-[11px] rounded border outline-none",
                            colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                          )}
                        />
                      </div>
                    </div>

                    <div className={cn("border rounded-md overflow-hidden max-h-60 overflow-y-auto", colorMode === 'dark' ? "border-slate-700/80 bg-slate-900/50" : "border-slate-200 bg-white")}>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className={cn("text-[10px] font-semibold uppercase tracking-wider border-b", colorMode === 'dark' ? "bg-slate-800/80 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500")}>
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
                                  if (!isDisabled) togglePolicy(p.name);
                                }}
                                className={cn(
                                  "text-xs transition-colors",
                                  isDisabled
                                    ? "opacity-40 cursor-not-allowed bg-slate-900/20"
                                    : "cursor-pointer",
                                  !isDisabled && isSelected
                                    ? colorMode === 'dark' ? "bg-emerald-500/10 text-slate-200" : "bg-emerald-50 text-slate-900"
                                    : !isDisabled && (colorMode === 'dark' ? "hover:bg-slate-800/40 text-slate-300" : "hover:bg-slate-50 text-slate-700")
                                )}
                              >
                                <td className="py-2 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isDisabled}
                                    onChange={() => {}}
                                    className="rounded accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="py-2 px-3 font-semibold text-emerald-400">
                                  {p.name}
                                </td>
                                <td className="py-2 px-3">
                                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border", colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500")}>
                                    {p.type}
                                  </span>
                                </td>
                                <td className={cn("py-2 px-3 text-[11px]", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>
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
              )}

              {/* STEP 3: Review & Create */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h4 className={cn("text-sm font-semibold", colorMode === 'dark' ? "text-slate-200" : "text-slate-800")}>
                      Review & Create
                    </h4>
                    <p className={cn("text-xs mt-0.5", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>
                      Review user specifications before creating the Kube IAM user.
                    </p>
                  </div>

                  <div className={cn("p-4 rounded-lg border space-y-3", colorMode === 'dark' ? "bg-slate-900/60 border-slate-700" : "bg-slate-50 border-slate-200")}>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-700/40">
                      <span className={cn("text-xs font-medium", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>User Name</span>
                      <span className={cn("text-xs font-semibold", colorMode === 'dark' ? "text-slate-200" : "text-slate-800")}>{username}</span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-slate-700/40">
                      <span className={cn("text-xs font-medium", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>Access Type</span>
                      <span className={cn("text-xs font-semibold text-emerald-400")}>{computedAccessType}</span>
                    </div>

                    <div>
                      <span className={cn("text-xs font-medium block mb-1.5", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>Attached Policies ({selectedPolicies.length})</span>
                      <div className="space-y-1">
                        {DEFAULT_POLICIES.filter((p) => selectedPolicies.includes(p.name)).map((p) => (
                          <div key={p.name} className={cn("p-2 rounded border flex items-center justify-between text-xs", colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200")}>
                            <div>
                              <span className="font-semibold text-emerald-400">{p.name}</span>
                              <p className={cn("text-[10px]", colorMode === 'dark' ? "text-slate-400" : "text-slate-500")}>{p.description}</p>
                            </div>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500")}>
                              {p.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Bottom Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-700/50 mt-4">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                      colorMode === 'dark' ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <ArrowLeft size={14} />
                    Previous
                  </button>
                ) : <div />}

                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={currentStep === 1 ? handleNextStep1 : handleNextStep2}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                  >
                    Next
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinishCreate}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                  >
                    <CheckCircle2 size={14} />
                    Create User
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
