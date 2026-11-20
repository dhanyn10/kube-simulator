import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RuleCardRow } from '@/components/Modals/role/RuleCardRow';
import { K8sRoleRule } from '@/types';

describe('RuleCardRow', () => {
  const dummyRule: K8sRoleRule = {
    apiGroups: ['apps'],
    resources: ['deployments'],
    verbs: ['get', 'list'],
  };

  it('renders RuleCardRow in dark mode with single rule (no remove button)', () => {
    const onRemoveRule = vi.fn();
    const onUpdateRuleTags = vi.fn();

    render(
      <RuleCardRow
        rule={dummyRule}
        idx={0}
        totalRules={1}
        colorMode="dark"
        onRemoveRule={onRemoveRule}
        onUpdateRuleTags={onUpdateRuleTags}
      />
    );

    expect(screen.queryByTitle('Remove Rule')).not.toBeInTheDocument();
    expect(screen.getByText('API Groups')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Verbs (Permissions)')).toBeInTheDocument();
  });

  it('renders remove button and triggers onRemoveRule in light mode when totalRules > 1', () => {
    const onRemoveRule = vi.fn();
    const onUpdateRuleTags = vi.fn();

    render(
      <RuleCardRow
        rule={dummyRule}
        idx={1}
        totalRules={2}
        colorMode="light"
        onRemoveRule={onRemoveRule}
        onUpdateRuleTags={onUpdateRuleTags}
      />
    );

    const removeBtn = screen.getByTitle('Remove Rule');
    expect(removeBtn).toBeInTheDocument();
    expect(removeBtn.className).toContain('text-slate-600');

    fireEvent.click(removeBtn);
    expect(onRemoveRule).toHaveBeenCalledWith(1);
  });

  it('renders remove button in dark mode when totalRules > 1', () => {
    const onRemoveRule = vi.fn();
    const onUpdateRuleTags = vi.fn();

    render(
      <RuleCardRow
        rule={dummyRule}
        idx={0}
        totalRules={3}
        colorMode="dark"
        onRemoveRule={onRemoveRule}
        onUpdateRuleTags={onUpdateRuleTags}
      />
    );

    const removeBtn = screen.getByTitle('Remove Rule');
    expect(removeBtn).toBeInTheDocument();
    expect(removeBtn.className).toContain('text-slate-400');
  });

  it('triggers onUpdateRuleTags when typing and pressing Enter in tag inputs', () => {
    const onRemoveRule = vi.fn();
    const onUpdateRuleTags = vi.fn();

    render(
      <RuleCardRow
        rule={dummyRule}
        idx={2}
        totalRules={1}
        colorMode="dark"
        onRemoveRule={onRemoveRule}
        onUpdateRuleTags={onUpdateRuleTags}
      />
    );

    // 1. Add apiGroup tag
    const apiGroupsInput = screen.getByLabelText('API Groups');
    fireEvent.change(apiGroupsInput, { target: { value: 'batch' } });
    fireEvent.keyDown(apiGroupsInput, { key: 'Enter' });
    expect(onUpdateRuleTags).toHaveBeenCalledWith(2, 'apiGroups', ['apps', 'batch']);

    // 2. Add resource tag
    const resourcesInput = screen.getByLabelText('Resources');
    fireEvent.change(resourcesInput, { target: { value: 'pods' } });
    fireEvent.keyDown(resourcesInput, { key: 'Enter' });
    expect(onUpdateRuleTags).toHaveBeenCalledWith(2, 'resources', ['deployments', 'pods']);

    // 3. Add verbs tag
    const verbsInput = screen.getByLabelText('Verbs (Permissions)');
    fireEvent.change(verbsInput, { target: { value: 'watch' } });
    fireEvent.keyDown(verbsInput, { key: 'Enter' });
    expect(onUpdateRuleTags).toHaveBeenCalledWith(2, 'verbs', ['get', 'list', 'watch']);
  });
});
