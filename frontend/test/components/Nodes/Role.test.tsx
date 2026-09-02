import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { RoleNode } from '@/components/Nodes/Role';
import { RoleConfig } from '@/components/Config/RoleConfig';
import { VALID_CONNECTIONS } from '@/constants/connections';
import { syncRoleRulesFromConnections, createFlowSlice } from '@/store/slices/createFlowSlice';
import { handleGetRolesCommand, handleDescribeRoleCommand } from '@/components/Layout/terminalCommands';
import { useFlowStore } from '@/store';

// React Flow Mock wrapper
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    Handle: ({ type, position, id }: any) => <div data-testid={`handle-${type}-${position}-${id}`} />,
    Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  };
});

describe('Role feature tests', () => {
  describe('RoleNode component', () => {
    it('renders Role node with rules', () => {
      const data = {
        label: 'test-role',
        type: 'Role' as const,
        rules: [
          {
            apiGroups: [''],
            resources: ['pods', 'services'],
            verbs: ['get', 'list', 'watch'],
          },
        ],
        displaySettings: { rules: true },
      };

      render(<RoleNode id="role-1" data={data as any} type="Role" />);
      expect(screen.getByText('test-role')).toBeInTheDocument();
      expect(screen.getByText('Rules (1)')).toBeInTheDocument();
      expect(screen.getByText('Res: pods, services')).toBeInTheDocument();
      expect(screen.getByText('Verbs: get, list, watch')).toBeInTheDocument();
    });

    it('renders Role node with hidden rules or multiple rules truncation', () => {
      const data = {
        label: 'multi-role',
        type: 'Role' as const,
        rules: [
          { apiGroups: [''], resources: ['pods'], verbs: ['get'] },
          { apiGroups: [''], resources: ['services'], verbs: ['list'] },
          { apiGroups: [''], resources: ['deployments'], verbs: ['watch'] },
        ],
        displaySettings: { rules: true },
      };

      const { rerender } = render(<RoleNode id="role-multi" data={data as any} type="Role" />);
      expect(screen.getByText('Rules (3)')).toBeInTheDocument();
      expect(screen.getByText('+ 1 more rule(s)...')).toBeInTheDocument();

      // Test with rules hidden
      rerender(<RoleNode id="role-multi" data={{ ...data, displaySettings: { rules: false } } as any} type="Role" />);
      expect(screen.queryByText('Rules (3)')).not.toBeInTheDocument();
    });
  });

  describe('RoleConfig component', () => {
    it('renders RoleConfig and handles rule creation, verb toggles, and rule deletion', () => {
      const data = {
        label: 'test-role',
        type: 'Role' as const,
        rules: [
          {
            apiGroups: [''],
            resources: ['pods'],
            verbs: ['get', 'list'],
          },
        ],
      };

      render(<RoleConfig data={data as any} nodeId="role-1" />);
      expect(screen.getByText('RBAC Role Rules')).toBeInTheDocument();
      expect(screen.getByText('Rule #1')).toBeInTheDocument();

      // Click to toggle verb 'list' (remove)
      const listVerbBtn = screen.getByText('list');
      fireEvent.click(listVerbBtn);

      // Click to toggle verb 'create' (add)
      const createVerbBtn = screen.getByText('create');
      fireEvent.click(createVerbBtn);

      // Click to add rule
      const addRuleBtn = screen.getByText('Add Rule');
      fireEvent.click(addRuleBtn);
    });

    it('renders disconnected state message when no target resources exist', () => {
      const data = {
        label: 'test-role',
        type: 'Role' as const,
        rules: [
          {
            apiGroups: [''],
            resources: [],
            verbs: ['get'],
          },
        ],
      };

      render(<RoleConfig data={data as any} nodeId="role-1" />);
      expect(screen.getByText('No target resources connected. Connect Role to a workload card on canvas.')).toBeInTheDocument();
    });

    it('handles disconnecting a resource badge in RoleConfig', () => {
      const data = {
        label: 'test-role',
        type: 'Role' as const,
        rules: [
          {
            apiGroups: [''],
            resources: ['pods'],
            verbs: ['get'],
          },
        ],
      };

      useFlowStore.setState({
        nodes: [
          { id: 'role-1', type: 'Role', data },
          { id: 'pod-1', type: 'Pod', data: { label: 'my-pod' } },
        ] as any,
        edges: [
          { id: 'e-role-pod', source: 'role-1', target: 'pod-1' },
        ] as any,
      });

      render(<RoleConfig data={data as any} nodeId="role-1" />);
      const podBadge = screen.getByText('pods ×');
      fireEvent.click(podBadge);

      // Verify edge was removed
      expect(useFlowStore.getState().edges.length).toBe(0);
    });
  });

  describe('Connection-driven RBAC rule sync', () => {
    it('syncs Role resources from various connected node types', () => {
      const initialNodes: any[] = [
        {
          id: 'role-1',
          type: 'Role',
          data: {
            label: 'test-role',
            rules: [{ apiGroups: [''], resources: [], verbs: ['get'] }],
          },
        },
        { id: 'deploy-1', type: 'Deployment', data: { label: 'app-deploy', replicas: 2 } },
        { id: 'svc-1', type: 'Service', data: { label: 'app-svc' } },
        { id: 'pvc-1', type: 'PVC', data: { label: 'app-pvc' } },
        { id: 'cm-1', type: 'ConfigMap', data: { label: 'app-cm' } },
        { id: 'sec-1', type: 'Secret', data: { label: 'app-sec' } },
        { id: 'rs-1', type: 'ReplicaSet', data: { label: 'app-rs' } },
      ];

      const edges: any[] = [
        { id: 'e1', source: 'role-1', target: 'deploy-1' },
        { id: 'e2', source: 'role-1', target: 'svc-1' },
        { id: 'e3', source: 'role-1', target: 'pvc-1' },
        { id: 'e4', source: 'role-1', target: 'cm-1' },
        { id: 'e5', source: 'role-1', target: 'sec-1' },
        { id: 'e6', source: 'role-1', target: 'rs-1' },
      ];

      const syncedNodes = syncRoleRulesFromConnections(initialNodes, edges);
      const updatedRole = syncedNodes.find((n) => n.id === 'role-1');
      const syncedResources = updatedRole?.data.rules[0].resources;

      expect(syncedResources).toContain('deployments');
      expect(syncedResources).toContain('pods');
      expect(syncedResources).toContain('services');
      expect(syncedResources).toContain('persistentvolumeclaims');
      expect(syncedResources).toContain('configmaps');
      expect(syncedResources).toContain('secrets');
      expect(syncedResources).toContain('replicasets');
    });

    it('clears Role resources when all connected edges are removed', () => {
      const initialNodes: any[] = [
        {
          id: 'role-1',
          type: 'Role',
          data: {
            label: 'test-role',
            rules: [{ apiGroups: [''], resources: ['pods', 'deployments'], verbs: ['get'] }],
          },
        },
      ];

      const edges: any[] = [];
      const syncedNodes = syncRoleRulesFromConnections(initialNodes, edges);
      const updatedRole = syncedNodes.find((n) => n.id === 'role-1');
      expect(updatedRole?.data.rules[0].resources).toEqual([]);
    });
  });

  describe('Role <-> child Pod connection re-routing in onConnect', () => {
    it('re-routes connection between Role and child Pod to parent Deployment', () => {
      const nodes: any[] = [
        { id: 'role-1', type: 'Role', data: { label: 'my-role' } },
        { id: 'deploy-1', type: 'Deployment', data: { label: 'my-dep', replicas: 1 } },
        { id: 'pod-1', type: 'Pod', parentId: 'deploy-1', data: { label: 'my-pod' } },
      ];

      useFlowStore.setState({ nodes, edges: [] });

      // Trigger onConnect targeting child pod-1
      useFlowStore.getState().onConnect({
        source: 'role-1',
        target: 'pod-1',
        sourceHandle: 'right-s',
        targetHandle: 'left-t',
      });

      const currentEdges = useFlowStore.getState().edges;
      expect(currentEdges.length).toBe(1);
      expect(currentEdges[0].source).toBe('role-1');
      expect(currentEdges[0].target).toBe('deploy-1');

      // Check Role rules sync
      const currentNodes = useFlowStore.getState().nodes;
      const roleNode = currentNodes.find((n) => n.id === 'role-1');
      expect(roleNode?.data.rules[0].resources).toContain('deployments');
      expect(roleNode?.data.rules[0].resources).toContain('pods');
    });
  });

  describe('Role valid connections', () => {
    it('allows Role connections to Deployment, Pod, Service, ReplicaSet, PVC, ConfigMap, Secret', () => {
      expect(VALID_CONNECTIONS.Role).toEqual(['Deployment', 'Pod', 'Service', 'ReplicaSet', 'PVC', 'ConfigMap', 'Secret']);
    });
  });

  describe('Role terminal commands', () => {
    it('handles kubectl get roles and rolebindings', () => {
      const logs: string[] = [];
      const ctx: any = {
        nodes: [
          {
            id: 'role-1',
            type: 'Role',
            data: { label: 'pod-reader', rules: [] },
          },
        ],
        addActivityLog: (line: string) => logs.push(line),
      };

      const resRoles = handleGetRolesCommand('kubectl get roles', ctx);
      expect(resRoles).toBe(true);
      expect(logs.some(l => l.includes('pod-reader'))).toBe(true);

      const resBindings = handleGetRolesCommand('kubectl get rolebindings', ctx);
      expect(resBindings).toBe(true);
      expect(logs.some(l => l.includes('pod-reader-binding'))).toBe(true);
    });

    it('handles kubectl describe role', () => {
      const logs: string[] = [];
      const ctx: any = {
        nodes: [
          {
            id: 'role-1',
            type: 'Role',
            data: {
              label: 'pod-reader',
              rules: [
                {
                  apiGroups: [''],
                  resources: ['pods'],
                  verbs: ['get', 'list'],
                },
              ],
            },
          },
        ],
        addActivityLog: (line: string) => logs.push(line),
      };

      const handled = handleDescribeRoleCommand('kubectl describe role pod-reader', ctx);
      expect(handled).toBe(true);
      expect(logs.some(l => l.includes('Name:         pod-reader'))).toBe(true);
      expect(logs.some(l => l.includes('pods'))).toBe(true);
    });
  });
});
