import React from 'react';
import { ShieldCheck, Edit2, Trash2, Plus } from 'lucide-react';
import { Modal } from './Modal';
import { K8sRoleItem } from '../../types';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';

interface RoleListModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeLabel?: string;
  roles: K8sRoleItem[];
  onEditRole: (role: K8sRoleItem) => void;
  onDeleteRole: (roleId: string, roleName: string) => void;
  onAddNewRole: () => void;
}

export const RoleListModal: React.FC<RoleListModalProps> = ({
  isOpen,
  onClose,
  targetNodeLabel,
  roles,
  onEditRole,
  onDeleteRole,
  onAddNewRole,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);

  if (!isOpen) return null;

  const footer = (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => {
          onClose();
          onAddNewRole();
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm cursor-pointer"
      >
        <Plus size={14} /> Add Role
      </button>
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
          colorMode === 'dark'
            ? "border-slate-700 hover:bg-slate-800 text-slate-300"
            : "border-slate-300 hover:bg-slate-100 text-slate-700"
        )}
      >
        Close
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attached RBAC Roles"
      subtitle={targetNodeLabel ? `Node: ${targetNodeLabel}` : 'Manage attached roles'}
      icon={ShieldCheck}
      iconColorClass="text-indigo-400"
      widthClass="w-[540px]"
      maxHeightClass="h-[60vh]"
      footer={footer}
    >
      <div className="space-y-3">
        {roles.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">No roles attached to this node.</div>
        ) : (
          roles.map((role) => (
            <div
              key={`role-modal-item-${role.id}`}
              className={cn(
                "p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors",
                colorMode === 'dark'
                  ? "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                  : "bg-slate-50 border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-indigo-400 shrink-0" />
                  <span className="font-mono font-bold text-xs truncate text-indigo-300">{role.name}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {role.rules && role.rules.length > 0 ? (
                    <span>
                      {role.rules.length} rule{role.rules.length > 1 ? 's' : ''} (
                      {role.rules.map((r) => r.resources.join(', ')).join('; ')})
                    </span>
                  ) : (
                    <span>No rules defined</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 border-l pl-2 border-slate-700/40">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditRole(role);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                  title="Edit Role"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRole(role.id, role.name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Delete Role"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};
