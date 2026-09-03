import React, { useState } from 'react';
import { Shield, Plus, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { K8sNodeData, K8sRoleItem } from '../../types';
import { RoleModal } from '../Modals/RoleModal';

interface RoleSettingsSectionProps {
  data: K8sNodeData;
  nodeId: string;
}

export const RoleSettingsSection: React.FC<RoleSettingsSectionProps> = ({ data, nodeId }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const addLog = useFlowStore((state) => state.addLog);

  const [editingRole, setEditingRole] = useState<K8sRoleItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const roles: K8sRoleItem[] = data.roles || [];

  const handleOpenAdd = () => {
    setEditingRole(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role: K8sRoleItem) => {
    setEditingRole(role);
    setIsModalOpen(true);
  };

  const handleDeleteRole = (roleId: string, roleName: string) => {
    const updated = roles.filter((r) => r.id !== roleId);
    updateNodeData(nodeId, { roles: updated });
    addLog('info', `[Role Removed] Removed role "${roleName}" from node`, 'UI');
  };

  const handleSaveRole = (roleItem: K8sRoleItem) => {
    const existingIndex = roles.findIndex((r) => r.id === roleItem.id);
    let updated: K8sRoleItem[];
    if (existingIndex >= 0) {
      updated = [...roles];
      updated[existingIndex] = roleItem;
    } else {
      updated = [...roles, roleItem];
    }
    updateNodeData(nodeId, { roles: updated });
    addLog('info', `[Role Saved] Updated role "${roleItem.name}"`, 'UI');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-3 pt-3 border-t border-slate-700/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shield size={14} className="text-indigo-400" />
          <h3 className={cn("text-xs font-bold uppercase tracking-wider", colorMode === 'dark' ? "text-slate-200" : "text-slate-700")}>
            Attached Roles (Hero Items)
          </h3>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          <Plus size={11} /> Add Role
        </button>
      </div>

      <div className="space-y-2">
        {roles.map((role) => (
          <div
            key={`attached-role-${role.id}`}
            className={cn(
              "p-2.5 rounded-xl border flex flex-col gap-1.5 relative group transition-all shadow-sm",
              colorMode === 'dark'
                ? "bg-indigo-950/30 border-indigo-500/30 text-indigo-100"
                : "bg-indigo-50/80 border-indigo-200 text-indigo-900"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="p-1 rounded bg-indigo-500/20 text-indigo-400">
                  <Shield size={12} />
                </span>
                <span className="text-xs font-bold font-mono tracking-tight">{role.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(role)}
                  className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                  title="Edit Role"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRole(role.id, role.name)}
                  className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                  title="Remove Role"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {role.rules && role.rules.length > 0 && (
              <div className="space-y-1">
                {role.rules.map((rule) => {
                  const ruleKey = `rule-summary-${role.id}-${rule.resources?.join('_') || 'empty'}-${rule.verbs?.join('_') || 'none'}`;
                  return (
                  <div key={ruleKey} className="text-[10px] font-mono opacity-85 space-y-0.5">
                    <div className="flex flex-wrap gap-1">
                      <span className="font-semibold text-slate-400">res:</span>
                      {rule.resources?.map((res) => (
                        <span key={res} className="px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                          {res}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span className="font-semibold text-slate-400">verbs:</span>
                      {rule.verbs?.map((verb) => (
                        <span key={verb} className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          {verb}
                        </span>
                      ))}
                    </div>
                  </div>
                );
                })}
              </div>
            )}
          </div>
        ))}

        {roles.length === 0 && (
          <div className="text-center py-3 text-slate-500 text-[10px] italic border border-dashed rounded-lg border-slate-700/40">
            No roles attached yet. Drop Role from sidebar or click "+ Add Role".
          </div>
        )}
      </div>

      <RoleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetNodeId={nodeId}
        targetNodeLabel={data.label || nodeId}
        initialRole={editingRole}
        onSave={handleSaveRole}
      />
    </div>
  );
};
