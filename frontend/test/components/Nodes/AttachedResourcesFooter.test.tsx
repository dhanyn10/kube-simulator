import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { AttachedResourcesFooter } from '@/components/Nodes/AttachedResourcesFooter';
import { K8sNodeData } from '@/types';

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
    };
    const { container } = render(<AttachedResourcesFooter data={data} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders role, configmap, secret, and hpa badges with details and fallback titles', () => {
    const data: K8sNodeData = {
      roles: [
        { id: 'r1', name: 'admin-role', assignedUsers: ['user1', 'user2'] },
        { name: 'role-no-id' },
      ],
      configMaps: [{ id: 'cm1', name: 'my-cm' }, { name: 'cm-no-id' }],
      secrets: [{ id: 's1', name: 'my-secret' }, { name: 'sec-no-id' }],
      hpas: [
        { id: 'h1', name: 'my-hpa', minReplicas: 1, maxReplicas: 5, targetCPU: 80 },
        { name: 'hpa-no-details' },
      ],
    };

    render(<AttachedResourcesFooter data={data} />);

    expect(screen.getByTitle('Role: admin-role (Users: user1, user2)')).toBeInTheDocument();
    expect(screen.getByTitle('ConfigMap: my-cm')).toBeInTheDocument();
    expect(screen.getByTitle('Secret: my-secret')).toBeInTheDocument();
    expect(
      screen.getByTitle('HPA: my-hpa (Min: 1, Max: 5, CPU: 80%)')
    ).toBeInTheDocument();
    expect(screen.getByTitle('HPA: hpa-no-details')).toBeInTheDocument();
  });

  it('renders when only configMaps are present', () => {
    const data: K8sNodeData = {
      configMaps: [{ id: 'cm1', name: 'standalone-cm' }],
    };
    render(<AttachedResourcesFooter data={data} />);
    expect(screen.getByTitle('ConfigMap: standalone-cm')).toBeInTheDocument();
  });

  it('renders when only secrets are present', () => {
    const data: K8sNodeData = {
      secrets: [{ id: 's1', name: 'standalone-secret' }],
    };
    render(<AttachedResourcesFooter data={data} />);
    expect(screen.getByTitle('Secret: standalone-secret')).toBeInTheDocument();
  });

  it('renders when only hpas are present', () => {
    const data: K8sNodeData = {
      hpas: [{ id: 'h1', name: 'standalone-hpa' }],
    };
    render(<AttachedResourcesFooter data={data} />);
    expect(screen.getByTitle('HPA: standalone-hpa')).toBeInTheDocument();
  });
});
