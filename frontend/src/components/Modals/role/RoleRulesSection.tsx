import React from 'react';
import { Plus } from 'lucide-react';
import { K8sRoleRule } from '@/types';
import { RuleCardRow } from './RuleCardRow';

/**
 * Props for RoleRulesSection component.
 */
export interface RoleRulesSectionProps {
  readonly rules: readonly K8sRoleRule[];
  readonly colorMode: string;
  readonly onAddRule: () => void;
  readonly onRemoveRule: (index: number) => void;
  readonly onUpdateRuleTags: (index: number, field: 'apiGroups' | 'resources' | 'verbs', tags: string[]) => void;
}

/**
 * RoleRulesSection renders the list of role rules/permissions section inside RoleModal.
 *
 * @param props RoleRulesSectionProps
 * @returns JSX Element
 */
export const RoleRulesSection: React.FC<RoleRulesSectionProps> = ({
  rules,
  colorMode,
  onAddRule,
  onRemoveRule,
  onUpdateRuleTags,
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <span className={colorMode === 'dark' ? "text-xs font-semibold text-slate-300" : "text-xs font-semibold text-slate-800"}>
        Role Rules / Permissions
      </span>
      <button
        type="button"
        onClick={onAddRule}
        className={
          colorMode === 'dark'
            ? "flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700 px-2 py-0.5 rounded bg-slate-900"
            : "flex items-center gap-1 text-[11px] font-semibold text-slate-800 hover:text-black transition-colors cursor-pointer border border-slate-300 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
        }
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
        onRemoveRule={onRemoveRule}
        onUpdateRuleTags={onUpdateRuleTags}
      />
    ))}
  </div>
);
