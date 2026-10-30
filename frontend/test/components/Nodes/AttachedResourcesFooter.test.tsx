import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { AttachedResourcesFooter } from '@/components/Nodes/AttachedResourcesFooter';
import { K8sNodeData } from '@/types';
import { useFlowStore } from '@/store';

describe('AttachedResourcesFooter', () => {
  it('returns null when no attached resources are present', () => {
    const data: K8sNodeData = {};
    const { container } = render(<AttachedResourcesFooter data={data} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when resource arrays are empty', () => {
    const data: K8sNodeData = {
      roles: [],
      configMaps: [],
      secrets: [],
      hpas: [],
      resourceLimits: [],
    };
    const { container } = render(<AttachedResourcesFooter data={data} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders role, configmap, secret, hpa, and resourceLimit badges with details and fallback titles', () => {
    const data: K8sNodeData = {
      roles: [{ id: 'r1', name: 'admin-role', assignedUsers: ['user1', 'user2'] }, { name: 'role-no-id' }],
      configMaps: [{ id: 'cm1', name: 'my-cm' }, { name: 'cm-no-id' }],
      secrets: [{ id: 's1', name: 'my-secret' }, { name: 'sec-no-id' }],
      resourceLimits: [{ id: 'res1', name: 'my-limit', cpuRequest: '250m', cpuLimit: '500m', memoryRequest: '128Mi', memoryLimit: '256Mi' }, { name: 'res-default' }],
      hpas: [{ id: 'h1', name: 'my-hpa', minReplicas: 1, maxReplicas: 5, targetCPU: 80 }, { name: 'hpa-no-details' }],
    };

    render(<AttachedResourcesFooter data={data} />);

    expect(screen.getByTitle('Role: admin-role (Users: user1, user2)')).toBeInTheDocument();
    expect(screen.getByTitle('ConfigMaps (2): my-cm, cm-no-id')).toBeInTheDocument();
    expect(screen.getByTestId('configmap-count-badge')).toHaveTextContent('2');
    expect(screen.getByTitle('Secret: my-secret')).toBeInTheDocument();
    expect(
      screen.getByTitle('Resource Limit: my-limit (CPU: 250m / 500m | Mem: 128Mi / 256Mi)')
    ).toBeInTheDocument();
    expect(
      screen.getByTitle('Resource Limit: res-default (CPU: 500m / 1000m | Mem: 256Mi / 512Mi)')
    ).toBeInTheDocument();
    expect(
      screen.getByTitle('HPA: my-hpa (Min: 1, Max: 5, CPU: 80%)')
    ).toBeInTheDocument();
    expect(screen.getByTitle('HPA: hpa-no-details')).toBeInTheDocument();
  });

  it('renders when only configMaps are present with single item and no badge', () => {
    const data: K8sNodeData = {
      configMaps: [{ id: 'cm1', name: 'standalone-cm' }],
    };
    render(<AttachedResourcesFooter data={data} />);
    expect(screen.getByTitle('ConfigMap: standalone-cm')).toBeInTheDocument();
    expect(screen.queryByTestId('configmap-count-badge')).toBeNull();
  });

  it('renders when only secrets are present', () => {
    const data: K8sNodeData = {
      secrets: [{ id: 's1', name: 'standalone-secret' }],
    };
    render(<AttachedResourcesFooter data={data} />);
    const secretBtn = screen.getByTitle('Secret: standalone-secret');
    expect(secretBtn).toBeInTheDocument();
    expect(secretBtn).toHaveClass('node-attached-badge-secret');
  });

  it('renders when only hpas are present', () => {
    const data: K8sNodeData = {
      hpas: [{ id: 'h1', name: 'standalone-hpa' }],
    };
    render(<AttachedResourcesFooter data={data} />);
    expect(screen.getByTitle('HPA: standalone-hpa')).toBeInTheDocument();
  });

  it('triggers store modal setters with initialItem when badges are clicked', () => {
    const cmItem = { id: 'cm-1', name: 'app-config', configData: [{ key: 'PORT', value: '3000' }] };
    const secItem = { id: 'sec-1', name: 'app-secret', secretData: [{ key: 'DB_PASS', value: 'secret' }] };
    const roleItem = { id: 'role-1', name: 'app-role', rules: [] };
    const hpaItem = { id: 'hpa-1', name: 'app-hpa', minReplicas: 1, maxReplicas: 3, targetCPU: 75 };
    const resLimitItem = { id: 'res-1', name: 'app-limits', cpuLimit: '1000m' };

    const data: K8sNodeData = {
      label: 'my-workload',
      configMaps: [cmItem],
      secrets: [secItem],
      roles: [roleItem],
      hpas: [hpaItem],
      resourceLimits: [resLimitItem],
    };

    render(<AttachedResourcesFooter data={data} nodeId="node-123" />);

    // Click ConfigMap badge (single item)
    fireEvent.click(screen.getByTitle('ConfigMap: app-config'));
    expect(useFlowStore.getState().configMapModalTargetNode).toEqual({
      id: 'node-123',
      label: 'my-workload',
      initialItem: cmItem,
    });

    // Click Secret badge
    fireEvent.click(screen.getByTitle('Secret: app-secret'));
    expect(useFlowStore.getState().secretModalTargetNode).toEqual({
      id: 'node-123',
      label: 'my-workload',
      initialItem: secItem,
    });

    // Click Role badge
    fireEvent.click(screen.getByTitle('Role: app-role'));
    expect(useFlowStore.getState().roleModalTargetNode).toEqual({
      id: 'node-123',
      label: 'my-workload',
      initialItem: roleItem,
    });

    // Click HPA badge
    fireEvent.click(screen.getByTitle(/HPA: app-hpa/));
    expect(useFlowStore.getState().hpaModalTargetNode).toEqual({
      id: 'node-123',
      label: 'my-workload',
      initialItem: hpaItem,
    });

    // Click ResourceLimit badge
    fireEvent.click(screen.getByTitle(/Resource Limit: app-limits/));
    expect(useFlowStore.getState().resourceLimitModalTargetNode).toEqual({
      id: 'node-123',
      label: 'my-workload',
      initialItem: resLimitItem,
    });
  });

  it('renders when only resourceLimits are present', () => {
    const data: K8sNodeData = {
      resourceLimits: [{ id: 'res1', name: 'standalone-res' }],
    };
    render(<AttachedResourcesFooter data={data} />);
    expect(screen.getByTitle(/Resource Limit: standalone-res/)).toBeInTheDocument();
  });

  it('renders a single icon with count badge when multiple ConfigMaps exist and opens list view on click', () => {
    const cm1 = { id: 'cm-1', name: 'app-env' };
    const cm2 = { id: 'cm-2', name: 'app-features' };
    const cm3 = { id: 'cm-3', name: 'app-ui' };

    const data: K8sNodeData = {
      label: 'pod-multi-cm',
      configMaps: [cm1, cm2, cm3],
    };

    render(<AttachedResourcesFooter data={data} nodeId="pod-node-1" />);

    // Verify only ONE configmap button is rendered instead of three lined up
    const configMapButtons = screen.getAllByRole('button').filter(btn =>
      btn.className.includes('node-attached-badge-configmap')
    );
    expect(configMapButtons).toHaveLength(1);

    // Verify badge with number 3 at top right
    const badge = screen.getByTestId('configmap-count-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('3');

    // Verify combined title and aria-label
    expect(screen.getByTitle('ConfigMaps (3): app-env, app-features, app-ui')).toBeInTheDocument();
    expect(screen.getByLabelText('Inspect ConfigMaps (3)')).toBeInTheDocument();

    // Verify clicking opens modal with initialViewMode: 'list'
    fireEvent.click(configMapButtons[0]);
    expect(useFlowStore.getState().configMapModalTargetNode).toEqual({
      id: 'pod-node-1',
      label: 'pod-multi-cm',
      initialItem: cm1,
      initialViewMode: 'list',
    });
  });

  it('handles ConfigMaps with fallback names when id or name is missing', () => {
    const data: K8sNodeData = {
      configMaps: [{ id: 'cm-only-id' }, {}],
    };
    render(<AttachedResourcesFooter data={data} nodeId="node-fallback" />);

    expect(screen.getByTitle('ConfigMaps (2): cm-only-id, Unnamed')).toBeInTheDocument();
    expect(screen.getByTestId('configmap-count-badge')).toHaveTextContent('2');

    // Single item with no name or id
    const singleUnnamedData: K8sNodeData = {
      configMaps: [{}],
    };
    const { container } = render(<AttachedResourcesFooter data={singleUnnamedData} />);
    expect(screen.getByTitle('ConfigMap: Unnamed')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="configmap-count-badge"]')).toBeNull();
  });

  it('does not trigger store modal setters when nodeId is undefined', () => {
    useFlowStore.setState({
      configMapModalTargetNode: null,
      secretModalTargetNode: null,
      roleModalTargetNode: null,
      hpaModalTargetNode: null,
      resourceLimitModalTargetNode: null,
    });

    const data: K8sNodeData = {
      label: 'no-node-id',
      configMaps: [{ id: 'cm-1', name: 'app-config' }],
      secrets: [{ id: 'sec-1', name: 'app-secret' }],
      roles: [{ id: 'role-1', name: 'app-role' }],
      hpas: [{ id: 'hpa-1', name: 'app-hpa' }],
      resourceLimits: [{ id: 'res-1', name: 'app-limits' }],
    };

    render(<AttachedResourcesFooter data={data} />);

    fireEvent.click(screen.getByTitle('Role: app-role'));
    expect(useFlowStore.getState().roleModalTargetNode).toBeNull();

    fireEvent.click(screen.getByTitle('ConfigMap: app-config'));
    expect(useFlowStore.getState().configMapModalTargetNode).toBeNull();

    fireEvent.click(screen.getByTitle('Secret: app-secret'));
    expect(useFlowStore.getState().secretModalTargetNode).toBeNull();

    fireEvent.click(screen.getByTitle(/Resource Limit: app-limits/));
    expect(useFlowStore.getState().resourceLimitModalTargetNode).toBeNull();

    fireEvent.click(screen.getByTitle(/HPA: app-hpa/));
    expect(useFlowStore.getState().hpaModalTargetNode).toBeNull();
  });
});
