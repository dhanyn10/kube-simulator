import React, { useState } from 'react';
import { UserCheck, Plus, Trash2, Shield, UserPlus } from 'lucide-react';
import { Modal } from './Modal';
import { KubeIAMUser } from '../../types';
import { useFlowStore } from '../../store';
import { cn, sanitizeSlug } from '../../lib/utils';

interface KubeIAMModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KubeIAMModal: React.FC<KubeIAMModalProps> = ({ isOpen, onClose }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const iamUsers = useFlowStore((state) => state.iamUsers);
  const addIamUser = useFlowStore((state) => state.addIamUser);
  const deleteIamUser = useFlowStore((state) => state.deleteIamUser);
  const addLog = useFlowStore((state) => state.addLog);

  const [username, setUsername] = useState('');
  const [accessType, setAccessType] = useState<'Full' | 'Read-Only' | 'Custom'>('Full');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = sanitizeSlug(username);
    if (!cleanUsername) return;

    if (iamUsers.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      addLog('warn', `[Kube IAM] User "${cleanUsername}" already exists!`, 'UI');
      return;
    }

    const newUser: KubeIAMUser = {
      id: `iam-user-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      username: cleanUsername,
      accessType,
      description: description.trim() || undefined,
      createdAt: Date.now(),
    };

    addIamUser(newUser);
    addLog('info', `[Kube IAM] Created IAM User "${cleanUsername}" with ${accessType} access level`, 'UI');
    setUsername('');
    setDescription('');
    setAccessType('Full');
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
      subtitle="Manage accounts and assign identity credentials for Kubernetes RBAC Roles"
      icon={UserCheck}
      iconColorClass="text-blue-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[75vh]"
    >
      <div className="space-y-6">
        {/* User Creation Form */}
        <form
          onSubmit={handleCreateUser}
          className={cn(
            "p-4 rounded-xl border space-y-3 transition-colors",
            colorMode === 'dark' ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <UserPlus size={16} className="text-blue-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Create New IAM User Account
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="iam-username-input" className="block text-[11px] font-semibold text-slate-400 mb-1">
                Username / Account Name *
              </label>
              <input
                id="iam-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. dev-user, admin-user, auditor"
                className={cn(
                  "w-full px-3 py-1.5 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/50",
                  colorMode === 'dark'
                    ? "bg-slate-950 border-slate-800 text-slate-100"
                    : "bg-white border-slate-300 text-slate-900"
                )}
                required
              />
            </div>

            <div>
              <label htmlFor="iam-access-type-select" className="block text-[11px] font-semibold text-slate-400 mb-1">
                Default Access Level
              </label>
              <select
                id="iam-access-type-select"
                value={accessType}
                onChange={(e) => setAccessType(e.target.value as 'Full' | 'Read-Only' | 'Custom')}
                className={cn(
                  "w-full px-3 py-1.5 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer",
                  colorMode === 'dark'
                    ? "bg-slate-950 border-slate-800 text-slate-100"
                    : "bg-white border-slate-300 text-slate-900"
                )}
              >
                <option value="Full">Full Access (Administrator)</option>
                <option value="Read-Only">Read-Only Access</option>
                <option value="Custom">Custom Access (Specific Resources)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="iam-description-input" className="block text-[11px] font-semibold text-slate-400 mb-1">
              Description / Role Purpose (Optional)
            </label>
            <input
              id="iam-description-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Developer access for backend application workloads"
              className={cn(
                "w-full px-3 py-1.5 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/50",
                colorMode === 'dark'
                  ? "bg-slate-950 border-slate-800 text-slate-100"
                  : "bg-white border-slate-300 text-slate-900"
              )}
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={!username.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> Add IAM User
            </button>
          </div>
        </form>

        {/* Existing Users List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Shield size={14} className="text-indigo-400" /> IAM Accounts List ({iamUsers.length})
            </h4>
          </div>

          <div className="grid gap-2 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
            {iamUsers.map((u) => (
              <div
                key={u.id}
                className={cn(
                  "p-3 rounded-xl border flex items-center justify-between transition-colors",
                  colorMode === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                )}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-blue-400">{u.username}</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-mono font-semibold border",
                        u.accessType === 'Full'
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : u.accessType === 'Read-Only'
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                          : "bg-purple-500/20 text-purple-300 border-purple-500/40"
                      )}
                    >
                      {u.accessType || 'Full'} Access
                    </span>
                  </div>
                  {u.description && (
                    <p className="text-[11px] text-slate-400 truncate max-w-md">{u.description}</p>
                  )}
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
              <div className="text-center py-6 text-slate-500 text-xs font-mono">
                No IAM Users created yet. Create a user account above.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
