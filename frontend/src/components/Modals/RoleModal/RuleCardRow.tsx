import React from 'react';
import { Trash2 } from 'lucide-react';
import { K8sRoleRule } from '@/types';
import { cn } from '@/lib/utils';
import { TagInput } from './TagInput';
import { COMMON_SUGGESTIONS } from '@/activity/modals';

/**
 * Props for RuleCardRow component.
 */
export interface RuleCardRowProps {
  readonly rule: K8sRoleRule;
  readonly idx: number;
  readonly totalRules: number;
  readonly colorMode: string;
  readonly onRemoveRule: (index: number) => void;
  readonly onUpdateRuleTags: (index: number, field: 'apiGroups' | 'resources' | 'verbs', tags: string[]) => void;
}

/**
 * RuleCardRow renders a single RBAC permission rule entry inside RoleModal.
 *
 * @param props RuleCardRowProps
 * @returns JSX Element
 */
export const RuleCardRow: React.FC<RuleCardRowProps> = ({
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
