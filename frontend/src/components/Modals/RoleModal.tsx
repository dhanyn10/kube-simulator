import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Plus, Trash2, X } from 'lucide-react';
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

const COMMON_SUGGESTIONS: Record<string, string[]> = {
  resources: ['pods', 'deployments', 'services', 'configmaps', 'secrets', 'persistentvolumeclaims', '*'],
  verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete', '*'],
  apiGroups: ['', 'apps', 'batch', 'storage.k8s.io', '*'],
};

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  colorMode: string;
  tagBgClass?: string;
  tagTextClass?: string;
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  placeholder = 'Add tag...',
  suggestions = [],
  colorMode,
  tagBgClass = 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableSuggestions = suggestions.filter((s) => {
    if (tags.includes(s)) return false;
    if (!inputValue.trim()) return true;
    const lowerInput = inputValue.toLowerCase().trim();
    const displayLabel = s === '' ? 'core api' : s.toLowerCase();
    return displayLabel.includes(lowerInput) || s.toLowerCase().includes(lowerInput);
  });

  const handleAddTag = (value: string) => {
    let trimmed = value.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === 'core api' || trimmed.toLowerCase() === 'core') {
      trimmed = '';
    }
    if (!tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
    setSelectedIndex(0);
  };

  const handleRemoveTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isFocused && availableSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % availableSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + availableSuggestions.length) % availableSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (availableSuggestions[selectedIndex] !== undefined) {
          e.preventDefault();
          handleAddTag(availableSuggestions[selectedIndex]);
          return;
        }
      }
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      handleRemoveTag(tags.length - 1);
    } else if (e.key === 'Escape') {
      setIsFocused(false);
    }
  };

  return (
    <div className="relative space-y-1">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "min-h-[38px] p-1.5 rounded-lg border flex flex-wrap items-center gap-1.5 cursor-text transition-all",
          isFocused ? "ring-2 ring-indigo-500/50 border-indigo-500/80" : "border-slate-700/60",
          colorMode === 'dark' ? "bg-slate-900" : "bg-white"
        )}
      >
        {tags.map((tag, idx) => (
          <span
            key={`tag-${tag}-${idx}`}
            className={cn(
              "px-2 py-0.5 rounded-md text-xs font-mono font-semibold flex items-center gap-1 border shadow-xs transition-all animate-in fade-in zoom-in-95 duration-150",
              tagBgClass
            )}
          >
            <span>{tag === '' ? 'Core API' : tag}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTag(idx);
              }}
              className="hover:opacity-80 p-0.5 rounded-full transition-opacity cursor-pointer"
            >
              <X size={10} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 150);
          }}
          onFocus={() => {
            setIsFocused(true);
            setSelectedIndex(0);
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className={cn(
            "flex-1 min-w-[120px] bg-transparent text-xs font-mono outline-none py-0.5 px-1",
            colorMode === 'dark' ? "text-slate-100 placeholder-slate-500" : "text-slate-800 placeholder-slate-400"
          )}
        />
      </div>

      {/* CLI-Style Autocomplete Dropdown */}
      {isFocused && availableSuggestions.length > 0 && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full mt-1 z-50 max-h-40 overflow-y-auto rounded-lg border shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100 font-mono text-xs",
            colorMode === 'dark' ? "bg-slate-900 border-slate-700/80 text-slate-200" : "bg-white border-slate-300 text-slate-800"
          )}
        >
          {availableSuggestions.map((sug, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={`autocomplete-${sug}-${idx}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddTag(sug);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={cn(
                  "px-3 py-1.5 flex items-center justify-between cursor-pointer transition-colors",
                  isSelected
                    ? (colorMode === 'dark' ? "bg-indigo-600/30 text-indigo-200 font-bold" : "bg-indigo-100 text-indigo-900 font-bold")
                    : (colorMode === 'dark' ? "hover:bg-slate-800/80" : "hover:bg-slate-100")
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-[10px] opacity-60">❯</span>
                  <span>{sug === '' ? 'Core API' : sug}</span>
                </span>
                {isSelected && (
                  <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    Press Enter / Tab
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import { Node } from '@xyflow/react';

const deriveApiGroupsFromResources = (resources: string[]): string[] => {
  const groups = new Set<string>();
  for (const res of resources) {
    const r = res.toLowerCase();
    if (['deployments', 'statefulsets', 'daemonsets', 'replicasets'].includes(r)) {
      groups.add('apps');
    } else if (['jobs', 'cronjobs'].includes(r)) {
      groups.add('batch');
    } else if (['ingresses', 'ingressclasses', 'networkpolicies'].includes(r)) {
      groups.add('networking.k8s.io');
    } else if (['horizontalpodautoscalers', 'hpa'].includes(r)) {
      groups.add('autoscaling');
    } else if (['storageclasses', 'volumeattachments'].includes(r)) {
      groups.add('storage.k8s.io');
    } else if (['roles', 'rolebindings', 'clusterroles', 'clusterrolebindings'].includes(r)) {
      groups.add('rbac.authorization.k8s.io');
    } else {
      // Core API Group ("") for pods, services, configmaps, secrets, persistentvolumeclaims, namespaces, nodes, etc.
      groups.add('');
    }
  }
  return Array.from(groups);
};

const deriveResourcesFromTargetNode = (targetNode: Node | undefined, allNodes: Node[]): string[] => {
  if (!targetNode) return ['pods', 'deployments'];

  const type = targetNode.type as string;

  if (type === 'Deployment') {
    const childPods = allNodes.filter((n) => n.parentId === targetNode.id && n.type === 'Pod');
    const replicas = (targetNode.data?.replicas as number) ?? 0;
    if (childPods.length > 0 || replicas > 0) {
      return ['deployments', 'pods'];
    }
    return ['deployments'];
  }

  if (type === 'Namespace') {
    const children = allNodes.filter((n) => n.parentId === targetNode.id);
    const resSet = new Set<string>();
    if (children.length === 0) {
      return ['namespaces'];
    }
    for (const child of children) {
      if (child.type === 'Deployment') {
        resSet.add('deployments');
        const grandChildren = allNodes.filter((n) => n.parentId === child.id && n.type === 'Pod');
        const replicas = (child.data?.replicas as number) ?? 0;
        if (grandChildren.length > 0 || replicas > 0) {
          resSet.add('pods');
        }
      } else if (child.type === 'Pod') {
        resSet.add('pods');
      } else if (child.type === 'Service') {
        resSet.add('services');
      } else if (child.type === 'ConfigMap') {
        resSet.add('configmaps');
      } else if (child.type === 'Secret') {
        resSet.add('secrets');
      } else if (child.type === 'PVC') {
        resSet.add('persistentvolumeclaims');
      } else if (child.type === 'Ingress') {
        resSet.add('ingresses');
      } else if (child.type === 'HPA') {
        resSet.add('horizontalpodautoscalers');
      }
    }
    return resSet.size > 0 ? Array.from(resSet) : ['namespaces'];
  }

  const mapTypeToResource: Record<string, string> = {
    Pod: 'pods',
    Service: 'services',
    ConfigMap: 'configmaps',
    Secret: 'secrets',
    PVC: 'persistentvolumeclaims',
    Ingress: 'ingresses',
    HPA: 'horizontalpodautoscalers',
  };

  if (mapTypeToResource[type]) {
    return [mapTypeToResource[type]];
  }

  return [type.toLowerCase() + 's'];
};

const DEFAULT_VERBS = ['get', 'list', 'watch'];

export const RoleModal: React.FC<RoleModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeLabel,
  initialRole,
  onSave,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);

  const [roleName, setRoleName] = useState<string>('app-reader-role');
  const [rules, setRules] = useState<K8sRoleRule[]>([
    {
      apiGroups: ['apps', ''],
      resources: ['deployments', 'pods'],
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
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      const derivedResources = deriveResourcesFromTargetNode(targetNode, nodes);
      const derivedApiGroups = deriveApiGroupsFromResources(derivedResources);

      setRoleName(`role-${Math.floor(Math.random() * 899 + 100)}`);
      setRules([
        {
          apiGroups: derivedApiGroups,
          resources: derivedResources,
          verbs: ['get', 'list', 'watch'],
        },
      ]);
    }
  }, [initialRole, isOpen, targetNodeId, nodes]);

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

  const handleUpdateRuleTags = (
    ruleIndex: number,
    field: 'apiGroups' | 'resources' | 'verbs',
    newTags: string[]
  ) => {
    setRules((prev) =>
      prev.map((rule, idx) => {
        if (idx !== ruleIndex) return rule;
        const updated = { ...rule, [field]: newTags };
        if (field === 'resources') {
          updated.apiGroups = deriveApiGroupsFromResources(newTags);
        }
        return updated;
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
      widthClass="w-[580px]"
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
              className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            >
              <Plus size={13} /> Add Rule
            </button>
          </div>

          {rules.map((rule, idx) => (
            <div
              key={`rule-spec-${idx}`}
              className={cn(
                "p-3.5 rounded-xl border relative space-y-3",
                colorMode === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
              )}
            >
              {rules.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveRule(idx)}
                  className="absolute top-2.5 right-2.5 text-red-400 hover:text-red-300 p-1 rounded transition-colors cursor-pointer"
                  title="Remove Rule"
                >
                  <Trash2 size={13} />
                </button>
              )}

              {/* API Groups Tagify Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  API Groups
                </label>
                <TagInput
                  tags={rule.apiGroups}
                  onChange={(newTags) => handleUpdateRuleTags(idx, 'apiGroups', newTags)}
                  placeholder='Type group (e.g. apps) and press Enter...'
                  suggestions={COMMON_SUGGESTIONS.apiGroups}
                  colorMode={colorMode}
                  tagBgClass="bg-purple-500/20 border-purple-500/40 text-purple-300"
                />
              </div>

              {/* Resources Tagify Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Resources
                </label>
                <TagInput
                  tags={rule.resources}
                  onChange={(newTags) => handleUpdateRuleTags(idx, 'resources', newTags)}
                  placeholder="Type resource (e.g. pods) and press Enter..."
                  suggestions={COMMON_SUGGESTIONS.resources}
                  colorMode={colorMode}
                  tagBgClass="bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                />
              </div>

              {/* Verbs Tagify Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Verbs (Permissions)
                </label>
                <TagInput
                  tags={rule.verbs}
                  onChange={(newTags) => handleUpdateRuleTags(idx, 'verbs', newTags)}
                  placeholder="Type verb (e.g. get) and press Enter..."
                  suggestions={COMMON_SUGGESTIONS.verbs}
                  colorMode={colorMode}
                  tagBgClass="bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
