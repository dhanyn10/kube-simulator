import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Plus, Trash2, X, User, ExternalLink } from 'lucide-react';
import { Node } from '@xyflow/react';
import { Modal } from './Modal';
import { K8sRoleItem, K8sRoleRule, K8sResourceType, KubeIAMUser } from '../../types';
import { useFlowStore } from '../../store';
import { cn, sanitizeSlug } from '../../lib/utils';
import { AutocompleteDropdown, AutocompleteSuggestion } from '../UI/AutocompleteDropdown';

interface RoleModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly targetNodeId: string | null;
  readonly targetNodeLabel?: string;
  readonly initialRole?: K8sRoleItem | null;
  readonly onSave: (roleItem: K8sRoleItem) => void;
}

const COMMON_SUGGESTIONS: Record<string, string[]> = {
  resources: ['pods', 'deployments', 'services', 'configmaps', 'secrets', 'persistentvolumeclaims', '*'],
  verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete', '*'],
  apiGroups: ['', 'apps', 'batch', 'storage.k8s.io', '*'],
};

interface TagInputProps {
  readonly id?: string;
  readonly tags: readonly string[];
  readonly onChange: (tags: string[]) => void;
  readonly placeholder?: string;
  readonly suggestions?: readonly string[];
  readonly colorMode: string;
  readonly tagBgClass?: string;
}

const TagInput: React.FC<TagInputProps> = ({
  id,
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
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFocused && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scrollParent = containerRef.current.closest('.custom-scrollbar') || containerRef.current.closest('.overflow-y-auto');

      let spaceBelow = window.innerHeight - rect.bottom;
      let spaceAbove = rect.top;

      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        spaceBelow = parentRect.bottom - rect.bottom;
        spaceAbove = rect.top - parentRect.top;
      }

      setOpenUpward(spaceBelow < 170 && spaceAbove > 120);
    }
  }, [isFocused, inputValue]);

  const nodes = useFlowStore((state) => state.nodes);

  const buildSuggestionItem = (s: string): AutocompleteSuggestion => {
    const label = s === '' ? 'Core API' : s;
    const description = s === '' ? 'Core Kubernetes API Group (Pods, Services, ConfigMaps, Secrets)' : undefined;

    const resourceToTypeMap: Record<string, string> = {
      pods: 'Pod',
      deployments: 'Deployment',
      services: 'Service',
      configmaps: 'ConfigMap',
      secrets: 'Secret',
      persistentvolumeclaims: 'PVC',
      ingresses: 'Ingress',
      horizontalpodautoscalers: 'HPA',
    };

    const targetType = resourceToTypeMap[s.toLowerCase()];
    const isMissingFromCanvas = Boolean(targetType && !nodes.some((n) => n.type === targetType));

    return {
      label,
      value: s,
      category: isMissingFromCanvas ? 'add to canvas' : undefined,
      description,
    };
  };

  const availableSuggestions: AutocompleteSuggestion[] = suggestions
    .filter((s) => !tags.includes(s))
    .map(buildSuggestionItem)
    .filter((item) => {
      if (!inputValue.trim()) return true;
      const lowerInput = inputValue.toLowerCase().trim();
      return item.label.toLowerCase().includes(lowerInput) || item.value.toLowerCase().includes(lowerInput);
    });

  const addNode = useFlowStore((state) => state.addNode);
  const addLog = useFlowStore((state) => state.addLog);

  const handleAddTag = (value: string) => {
    let trimmed = value.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === 'core api' || trimmed.toLowerCase() === 'core') {
      trimmed = '';
    }

    if (!tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }

    const resourceToTypeMap: Record<string, K8sResourceType> = {
      pods: 'Pod',
      deployments: 'Deployment',
      services: 'Service',
      configmaps: 'ConfigMap',
      secrets: 'Secret',
      persistentvolumeclaims: 'PVC',
      ingresses: 'Ingress',
      horizontalpodautoscalers: 'HPA',
    };

    const targetType = resourceToTypeMap[trimmed.toLowerCase()];
    if (targetType) {
      const existsOnCanvas = nodes.some((n) => n.type === targetType);
      if (!existsOnCanvas) {
        addNode(targetType);
        addLog('info', `[Role Modal Action] Instantiated missing resource '${targetType}' on canvas directly from Role suggestions`, 'UI');
      }
    }

    setInputValue('');
    setSelectedIndex(0);
  };

  const handleRemoveTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSuggestionNavKey = (e: React.KeyboardEvent<HTMLInputElement>): boolean => {
    if (!isFocused || availableSuggestions.length === 0) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % availableSuggestions.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + availableSuggestions.length) % availableSuggestions.length);
      return true;
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && availableSuggestions[selectedIndex] !== undefined) {
      e.preventDefault();
      handleAddTag(availableSuggestions[selectedIndex].value);
      return true;
    }
    return false;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (handleSuggestionNavKey(e)) return;

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
    <div ref={containerRef} className="relative space-y-1">
      <label
        htmlFor={id}
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
          id={id}
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
      </label>

      {isFocused && availableSuggestions.length > 0 && (
        <AutocompleteDropdown
          suggestions={availableSuggestions}
          selectedIndex={selectedIndex}
          onSelect={(item) => handleAddTag(item.value)}
          onHoverIndex={(idx) => setSelectedIndex(idx)}
          colorMode={colorMode === 'dark' ? 'dark' : 'light'}
          openUpward={openUpward}
          showIcon={false}
        />
      )}
    </div>
  );
};

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
      groups.add('');
    }
  }
  return Array.from(groups);
};

const deriveDeploymentResources = (targetNode: Node, allNodes: Node[]): string[] => {
  const childPods = allNodes.filter((n) => n.parentId === targetNode.id && n.type === 'Pod');
  const replicas = (targetNode.data?.replicas as number) ?? 0;
  if (childPods.length > 0 || replicas > 0) {
    return ['deployments', 'pods'];
  }
  return ['deployments'];
};

const SINGLE_CHILD_TYPE_MAP: Record<string, string> = {
  Pod: 'pods',
  Service: 'services',
  ConfigMap: 'configmaps',
  Secret: 'secrets',
  PVC: 'persistentvolumeclaims',
  Ingress: 'ingresses',
  HPA: 'horizontalpodautoscalers',
};

const collectNamespaceChildResources = (child: Node, allNodes: Node[], resSet: Set<string>): void => {
  if (child.type === 'Deployment') {
    resSet.add('deployments');
    const grandChildren = allNodes.filter((n) => n.parentId === child.id && n.type === 'Pod');
    const replicas = (child.data?.replicas as number) ?? 0;
    if (grandChildren.length > 0 || replicas > 0) {
      resSet.add('pods');
    }
    return;
  }

  const resource = SINGLE_CHILD_TYPE_MAP[child.type || ''];
  if (resource) {
    resSet.add(resource);
  }
};

const deriveNamespaceResources = (targetNode: Node, allNodes: Node[]): string[] => {
  const children = allNodes.filter((n) => n.parentId === targetNode.id);
  if (children.length === 0) {
    return ['namespaces'];
  }
  const resSet = new Set<string>();
  for (const child of children) {
    collectNamespaceChildResources(child, allNodes, resSet);
  }
  return resSet.size > 0 ? Array.from(resSet) : ['namespaces'];
};

const deriveResourcesFromTargetNode = (targetNode: Node | undefined, allNodes: Node[]): string[] => {
  if (!targetNode) return ['pods', 'deployments'];

  let effectiveTarget = targetNode;
  if (targetNode.type === 'Pod' && targetNode.parentId) {
    const parentDep = allNodes.find((n) => n.id === targetNode.parentId && n.type === 'Deployment');
    if (parentDep) {
      effectiveTarget = parentDep;
    }
  }

  const type = effectiveTarget.type as string;

  if (type === 'Deployment') {
    return deriveDeploymentResources(effectiveTarget, allNodes);
  }

  if (type === 'Namespace') {
    return deriveNamespaceResources(effectiveTarget, allNodes);
  }

  const mappedResource = SINGLE_CHILD_TYPE_MAP[type];
  if (mappedResource) {
    return [mappedResource];
  }

  return [type.toLowerCase() + 's'];
};

interface RuleCardRowProps {
  readonly rule: K8sRoleRule;
  readonly idx: number;
  readonly totalRules: number;
  readonly colorMode: string;
  readonly onRemoveRule: (index: number) => void;
  readonly onUpdateRuleTags: (index: number, field: 'apiGroups' | 'resources' | 'verbs', tags: string[]) => void;
}

const RuleCardRow: React.FC<RuleCardRowProps> = ({
  rule,
  idx,
  totalRules,
  colorMode,
  onRemoveRule,
  onUpdateRuleTags,
}) => {
  return (
    <div
      className={cn(
        "p-3.5 rounded-xl border relative space-y-3",
        colorMode === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
      )}
    >
      {totalRules > 1 && (
        <button
          type="button"
          onClick={() => onRemoveRule(idx)}
          className="absolute top-2.5 right-2.5 text-red-400 hover:text-red-300 p-1 rounded transition-colors cursor-pointer"
          title="Remove Rule"
        >
          <Trash2 size={13} />
        </button>
      )}

      <div>
        <label htmlFor={`api-groups-input-${idx}`} className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          API Groups
        </label>
        <TagInput
          id={`api-groups-input-${idx}`}
          tags={rule.apiGroups}
          onChange={(newTags) => onUpdateRuleTags(idx, 'apiGroups', newTags)}
          placeholder='Type group (e.g. apps) and press Enter...'
          suggestions={COMMON_SUGGESTIONS.apiGroups}
          colorMode={colorMode}
          tagBgClass="bg-purple-500/20 border-purple-500/40 text-purple-300"
        />
      </div>

      <div>
        <label htmlFor={`resources-input-${idx}`} className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Resources
        </label>
        <TagInput
          id={`resources-input-${idx}`}
          tags={rule.resources}
          onChange={(newTags) => onUpdateRuleTags(idx, 'resources', newTags)}
          placeholder="Type resource (e.g. pods) and press Enter..."
          suggestions={COMMON_SUGGESTIONS.resources}
          colorMode={colorMode}
          tagBgClass="bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
        />
      </div>

      <div>
        <label htmlFor={`verbs-input-${idx}`} className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Verbs (Permissions)
        </label>
        <TagInput
          id={`verbs-input-${idx}`}
          tags={rule.verbs}
          onChange={(newTags) => onUpdateRuleTags(idx, 'verbs', newTags)}
          placeholder="Type verb (e.g. get) and press Enter..."
          suggestions={COMMON_SUGGESTIONS.verbs}
          colorMode={colorMode}
          tagBgClass="bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
        />
      </div>
    </div>
  );
};

const DEFAULT_VERBS = ['get', 'list', 'watch'];

/**
 * Checks whether an IAM user has Full Access permissions.
 */
const isUserFullAccess = (user: KubeIAMUser): boolean => {
  return user.accessType === 'Full Access' || Boolean(user.policies?.some((p) => p.name === 'AdministratorAccess'));
};

/**
 * Checks if policy set matches targeted resource categories.
 */
const checkPolicyResourceMatch = (resourcesSet: Set<string>, policyNames: Set<string>): boolean => {
  const isDevResource = Array.from(resourcesSet).some((r) =>
    ['pods', 'deployments', 'replicasets', 'configmaps', 'secrets', 'horizontalpodautoscalers', 'hpa'].includes(r)
  );
  const isNetResource = Array.from(resourcesSet).some((r) =>
    ['services', 'ingresses', 'networking'].includes(r)
  );
  const isStorageResource = Array.from(resourcesSet).some((r) =>
    ['persistentvolumeclaims', 'pvcs', 'storage'].includes(r)
  );

  if (isDevResource && policyNames.has('ContainerDeveloperPolicy')) return true;
  if (isNetResource && policyNames.has('NetworkingAdminPolicy')) return true;
  if (isStorageResource && policyNames.has('StorageAdminPolicy')) return true;
  if (policyNames.has('ReadOnlyAccess')) return true;

  return resourcesSet.size === 0;
};

/**
 * Determines if a Kube IAM user is eligible/available for assignment on a given target card / role.
 */
const isUserAvailableForRole = (
  user: KubeIAMUser,
  targetNode: Node | undefined,
  rules: K8sRoleRule[]
): boolean => {
  if (isUserFullAccess(user)) return true;
  if (!user.policies || user.policies.length === 0) return false;

  const policyNames = new Set(user.policies.map((p) => p.name));
  if (policyNames.has('PowerUserAccess') || policyNames.has('AdministratorAccess')) {
    return true;
  }

  const resourcesSet = new Set<string>();
  if (targetNode) {
    const derived = deriveResourcesFromTargetNode(targetNode, []);
    derived.forEach((r) => resourcesSet.add(r.toLowerCase()));
  }
  for (const rule of rules) {
    (rule.resources || []).forEach((r) => resourcesSet.add(r.toLowerCase()));
  }

  if (resourcesSet.has('*')) return true;

  return checkPolicyResourceMatch(resourcesSet, policyNames);
};

interface RoleUserOptionRowProps {
  readonly user: KubeIAMUser;
  readonly isChecked: boolean;
  readonly isFullAccess: boolean;
  readonly colorMode: string;
  readonly onToggle: (username: string) => void;
}

const RoleUserOptionRow: React.FC<RoleUserOptionRowProps> = ({
  user,
  isChecked,
  isFullAccess,
  colorMode,
  onToggle,
}) => {
  const getDropdownRowClass = (): string => {
    if (isChecked) {
      return colorMode === 'dark'
        ? "bg-indigo-600/30 text-indigo-100 font-bold"
        : "bg-indigo-50 text-indigo-900 font-bold";
    }
    return colorMode === 'dark'
      ? "hover:bg-slate-800/60 text-slate-300 focus:bg-slate-800/60 outline-none"
      : "hover:bg-slate-50 text-slate-700 focus:bg-slate-50 outline-none";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(user.username);
    }
  };

  return (
    <div
      role="option"
      aria-selected={isChecked}
      tabIndex={0}
      onMouseDown={(e) => {
        e.preventDefault();
        onToggle(user.username);
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex items-center justify-between px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors border-b last:border-b-0 border-slate-800/40",
        getDropdownRowClass()
      )}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isChecked}
          disabled={isFullAccess}
          onChange={() => {}}
          aria-label={`Select ${user.username}`}
          className="rounded accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
        />
        <span className="font-semibold text-[11px]">{user.username}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {isFullAccess ? (
          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
            Full Access
          </span>
        ) : (
          user.policies.map((p) => (
            <span
              key={p.name}
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded border",
                colorMode === 'dark'
                  ? "bg-slate-800 border-slate-700 text-slate-400"
                  : "bg-slate-100 border-slate-200 text-slate-600"
              )}
            >
              {p.name}
            </span>
          ))
        )}
      </div>
    </div>
  );
};

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
  const iamUsers = useFlowStore((state) => state.iamUsers);
  const setKubeIamModalOpen = useFlowStore((state) => state.setKubeIamModalOpen);

  const [roleName, setRoleName] = useState<string>('app-reader-role');
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState<boolean>(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const [rules, setRules] = useState<K8sRoleRule[]>([
    {
      apiGroups: ['apps', ''],
      resources: ['deployments', 'pods'],
      verbs: [...DEFAULT_VERBS],
    },
  ]);

  const targetNode = nodes.find((n) => n.id === targetNodeId);

  useEffect(() => {
    const fullAccessUsernames = iamUsers
      .filter(isUserFullAccess)
      .map((u) => u.username);

    if (initialRole) {
      setRoleName(initialRole.name || 'app-reader-role');
      const initialUsers = initialRole.assignedUsers || [];
      const combined = Array.from(new Set([...initialUsers, ...fullAccessUsernames]));
      setAssignedUsers(combined);
      setRules(initialRole.rules && initialRole.rules.length > 0 ? initialRole.rules : [
        { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] }
      ]);
    } else {
      setAssignedUsers(fullAccessUsernames);
      const derivedResources = deriveResourcesFromTargetNode(targetNode, nodes);
      const derivedApiGroups = deriveApiGroupsFromResources(derivedResources);

      const randomSuffix = crypto.randomUUID().split('-')[0];
      setRoleName(`role-${randomSuffix}`);
      setRules([
        {
          apiGroups: derivedApiGroups,
          resources: derivedResources,
          verbs: ['get', 'list', 'watch'],
        },
      ]);
    }
    setUserSearchQuery('');
    setIsUserDropdownOpen(false);
  }, [initialRole, isOpen, targetNodeId, nodes, iamUsers]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserDropdownOpen]);

  if (!isOpen) return null;

  const availableUsers = iamUsers.filter((user) => isUserAvailableForRole(user, targetNode, rules));

  const filteredAvailableUsers = availableUsers.filter((user) => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase().trim();
    const matchUsername = user.username.toLowerCase().includes(q);
    const matchType = user.accessType.toLowerCase().includes(q);
    const matchPolicy = user.policies.some((p) => p.name.toLowerCase().includes(q));
    return matchUsername || matchType || matchPolicy;
  });

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

  const toggleUserAssignment = (username: string) => {
    const targetUser = iamUsers.find((u) => u.username === username);
    if (targetUser && isUserFullAccess(targetUser)) {
      return;
    }
    setAssignedUsers((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  const handleOpenIamModal = () => {
    onClose();
    setKubeIamModalOpen(true);
  };

  const handleSave = () => {
    const roleItem: K8sRoleItem = {
      id: initialRole?.id || `role-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      name: sanitizeSlug(roleName) || 'unnamed-role',
      rules: rules.length > 0 ? rules : [{ apiGroups: [''], resources: ['*'], verbs: ['*'] }],
      assignedUsers,
      createdAt: initialRole?.createdAt || Date.now(),
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
          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
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
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all cursor-pointer"
      >
        {initialRole ? 'Update Role' : 'Attach Role'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialRole ? 'Edit Role & RoleBinding' : 'Attach RBAC Role & RoleBinding'}
      subtitle={targetNodeLabel ? `Target card: ${targetNodeLabel}` : 'Configure Role Permissions & RoleBinding Assignments'}
      icon={ShieldCheck}
      iconColorClass="text-indigo-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[70vh]"
      footer={footer}
    >
      <div className={cn(
        "p-3 rounded-xl border flex items-start gap-2.5 text-xs mb-4",
        colorMode === 'dark'
          ? "bg-indigo-950/40 border-indigo-800/60 text-indigo-200"
          : "bg-indigo-50 border-indigo-200 text-indigo-900"
      )}>
        <ShieldCheck size={18} className="text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-[11px] uppercase tracking-wider text-indigo-400">
            💡 Concept: Role vs RoleBinding
          </p>
          <p className="leading-relaxed opacity-90 text-[11px]">
            In Kubernetes RBAC, a <strong>Role</strong> defines <em>WHAT</em> permissions are allowed (API Groups, Resources, Verbs), while a <strong>RoleBinding</strong> specifies <em>WHO</em> (IAM Users / Subjects) receives those permissions.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="role-name-input" className="block text-xs font-semibold mb-1 text-slate-400">
            Role Name
          </label>
          <input
            id="role-name-input"
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <User size={14} className="text-emerald-400" />
              RoleBinding Subjects / IAM Users ({assignedUsers.length})
            </span>
            <button
              type="button"
              onClick={handleOpenIamModal}
              className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <ExternalLink size={12} />
              Manage Kube IAM Users
            </button>
          </div>

          {iamUsers.length === 0 ? (
            <div className={cn('p-3 rounded-lg border text-xs flex items-center justify-between', colorMode === 'dark' ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600')}>
              <span>No Kube IAM users created yet.</span>
              <button
                type="button"
                onClick={handleOpenIamModal}
                className="text-emerald-400 hover:underline text-[11px] font-medium cursor-pointer"
              >
                Go to Kube IAM Management
              </button>
            </div>
          ) : (
            <div ref={userDropdownRef} className="relative">
              <label
                htmlFor="assigned-users-input"
                className={cn(
                  "min-h-[42px] p-1.5 rounded-lg border flex flex-wrap items-center gap-1.5 cursor-text transition-all",
                  isUserDropdownOpen ? "ring-2 ring-indigo-500/50 border-indigo-500/80" : "border-slate-700/60",
                  colorMode === 'dark' ? "bg-slate-950" : "bg-white"
                )}
              >
                {assignedUsers.map((uname) => {
                  const uobj = iamUsers.find((u) => u.username === uname);
                  const isFull = uobj ? isUserFullAccess(uobj) : false;
                  return (
                    <span
                      key={`assigned-chip-${uname}`}
                      className={cn(
                        "px-2 py-0.5 rounded-md text-xs font-mono font-semibold flex items-center gap-1 border shadow-xs transition-all animate-in fade-in zoom-in-95 duration-150",
                        isFull
                          ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                          : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      )}
                    >
                      <User size={10} />
                      <span>{uname}</span>
                      {isFull ? (
                        <span className="text-[9px] opacity-70 font-normal ml-0.5">(Full Access)</span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleUserAssignment(uname);
                          }}
                          className="hover:opacity-80 p-0.5 rounded-full transition-opacity cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  );
                })}

                <input
                  id="assigned-users-input"
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setIsUserDropdownOpen(true);
                  }}
                  onFocus={() => setIsUserDropdownOpen(true)}
                  placeholder={assignedUsers.length === 0 ? "Type to search or add IAM users..." : "Add user..."}
                  className={cn(
                    "flex-1 min-w-[140px] bg-transparent text-xs font-mono outline-none py-0.5 px-1",
                    colorMode === 'dark' ? "text-slate-100 placeholder-slate-500" : "text-slate-800 placeholder-slate-400"
                  )}
                />
              </label>

              {isUserDropdownOpen && (
                <div className={cn(
                  "absolute left-0 right-0 top-full mt-1 z-50 max-h-48 overflow-y-auto rounded-lg border shadow-xl p-1 animate-in fade-in zoom-in-95 duration-100 custom-scrollbar font-mono text-xs",
                  colorMode === 'dark' ? "bg-slate-900 border-slate-700/80 text-slate-200" : "bg-white border-slate-300 text-slate-800"
                )}>
                  {filteredAvailableUsers.length === 0 ? (
                    <div className="p-2.5 text-center text-xs text-slate-400">
                      No matching IAM users available for this card type.
                    </div>
                  ) : (
                    filteredAvailableUsers.map((user) => (
                      <RoleUserOptionRow
                        key={user.id}
                        user={user}
                        isChecked={assignedUsers.includes(user.username)}
                        isFullAccess={isUserFullAccess(user)}
                        colorMode={colorMode}
                        onToggle={toggleUserAssignment}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

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
            <RuleCardRow
              key={`rule-spec-${rule.apiGroups.join('-')}-${rule.resources.join('-')}-${idx}`}
              rule={rule}
              idx={idx}
              totalRules={rules.length}
              colorMode={colorMode}
              onRemoveRule={handleRemoveRule}
              onUpdateRuleTags={handleUpdateRuleTags}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
};
