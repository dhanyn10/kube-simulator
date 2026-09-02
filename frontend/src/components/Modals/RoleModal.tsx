import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { K8sRoleItem, K8sRoleRule } from '../../types';
import { useFlowStore } from '../../store';
import { cn, sanitizeSlug } from '../../lib/utils';

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeId: string | null;
  targetNodeLabel?: string;
  initialRole?: K8sRoleItem | null;
  onSave: (roleItem: K8sRoleItem) => void;
}

const DEFAULT_API_GROUPS = [''];
const DEFAULT_RESOURCES = ['pods', 'deployments', 'services'];
const DEFAULT_VERBS = ['get', 'list', 'watch'];

export const RoleModal: React.FC<RoleModalProps> = ({
  isOpen,
  onClose,
  targetNodeLabel,
  initialRole,
  onSave,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);

  const [roleName, setRoleName] = useState<string>('app-reader-role');
  const [rules, setRules] = useState<K8sRoleRule[]>([
    {
      apiGroups: [...DEFAULT_API_GROUPS],
      resources: [...DEFAULT_RESOURCES],
      verbs: [...DEFAULT_VERBS],
    },
  ]);

  useEffect(() => {
    if (initialRole) {
      setRoleName(initialRole.name || 'app-reader-role');
      setRules(initialRole.rules && initialRole.rules.length > 0 ? initialRole.rules : [
        { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] }
      ]);
    } else {
      setRoleName(`role-${Math.floor(Math.random() * 899 + 100)}`);
      setRules([
        {
          apiGroups: [''],
          resources: ['pods', 'deployments', 'services'],
          verbs: ['get', 'list', 'watch'],
        },
      ]);
    }
  }, [initialRole, isOpen]);

  if (!isOpen) return null;

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRuleCSV = (
    ruleIndex: number,
    field: 'apiGroups' | 'resources' | 'verbs',
    valueStr: string
  ) => {
    const list = valueStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    setRules((prev) =>
      prev.map((rule, idx) => {
        if (idx !== ruleIndex) return rule;
        return { ...rule, [field]: list.length > 0 ? list : ['*'] };
      })
    );
  };

  const handleSave = () => {
    const roleItem: K8sRoleItem = {
      id: initialRole?.id || `role-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: sanitizeSlug(roleName) || 'unnamed-role',
      rules: rules.length > 0 ? rules : [{ apiGroups: [''], resources: ['*'], verbs: ['*'] }],
    };
    onSave(roleItem);
    onClose();
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
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
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSave}
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all"
      >
        {initialRole ? 'Update Role' : 'Attach Role'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialRole ? 'Edit Role' : 'Attach RBAC Role'}
      subtitle={targetNodeLabel ? `Target card: ${targetNodeLabel}` : 'Configure Role & Permissions'}
      icon={ShieldCheck}
      iconColorClass="text-indigo-400"
      widthClass="w-[560px]"
      footer={footer}
    >
      <div className="space-y-4">
        {/* Role Name */}
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-400">
            Role Name
          </label>
          <input
            type="text"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. app-reader-role"
            className={cn(
              "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all",
              colorMode === 'dark'
                ? "bg-slate-950 border-slate-800 text-slate-100"
                : "bg-slate-50 border-slate-300 text-slate-900"
            )}
          />
        </div>

        {/* Rules Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Role Rules / Permissions</span>
            <button
              type="button"
              onClick={handleAddRule}
              className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Plus size={13} /> Add Rule
            </button>
          </div>

          {rules.map((rule, idx) => (
            <div
              key={`rule-spec-${idx}`}
              className={cn(
                "p-3 rounded-xl border relative space-y-2.5",
                colorMode === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
              )}
            >
              {rules.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveRule(idx)}
                  className="absolute top-2.5 right-2.5 text-red-400 hover:text-red-300 p-1 rounded transition-colors"
                  title="Remove Rule"
                >
                  <Trash2 size={13} />
                </button>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  API Groups (comma separated)
                </label>
                <input
                  type="text"
                  value={rule.apiGroups.join(', ')}
                  onChange={(e) => handleUpdateRuleCSV(idx, 'apiGroups', e.target.value)}
                  placeholder='e.g. "", apps'
                  className={cn(
                    "w-full px-2.5 py-1.5 rounded-md border text-xs font-mono outline-none",
                    colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                  )}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Resources (comma separated)
                </label>
                <input
                  type="text"
                  value={rule.resources.join(', ')}
                  onChange={(e) => handleUpdateRuleCSV(idx, 'resources', e.target.value)}
                  placeholder="e.g. pods, deployments, services"
                  className={cn(
                    "w-full px-2.5 py-1.5 rounded-md border text-xs font-mono outline-none",
                    colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                  )}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Verbs (comma separated)
                </label>
                <input
                  type="text"
                  value={rule.verbs.join(', ')}
                  onChange={(e) => handleUpdateRuleCSV(idx, 'verbs', e.target.value)}
                  placeholder="e.g. get, list, watch, create"
                  className={cn(
                    "w-full px-2.5 py-1.5 rounded-md border text-xs font-mono outline-none",
                    colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
