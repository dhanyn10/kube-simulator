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
      <span className="text-xs font-semibold text-slate-400">Role Rules / Permissions</span>
      <button
        type="button"
        onClick={onAddRule}
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
        onRemoveRule={onRemoveRule}
        onUpdateRuleTags={onUpdateRuleTags}
      />
    ))}
  </div>
);
