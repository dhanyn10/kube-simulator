import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { RoleNode } from '@/components/Nodes/Role';
import { RoleConfig } from '@/components/Config/RoleConfig';
import { VALID_CONNECTIONS } from '@/constants/connections';
import { syncRoleRulesFromConnections } from '@/store/slices/createFlowSlice';
import { handleGetRolesCommand, handleDescribeRoleCommand } from '@/components/Layout/terminalCommands';

// React Flow Mock wrapper
vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, id }: any) => <div data-testid={`handle-${type}-${position}-${id}`} />,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

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
  });

  describe('RoleConfig component', () => {
    it('renders RoleConfig and toggles verbs and resources', () => {
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

      render(<RoleConfig data={data as any} nodeId="role-1" />);
      expect(screen.getByText('RBAC Role Rules')).toBeInTheDocument();
      expect(screen.getByText('Rule #1')).toBeInTheDocument();

      // Click to toggle verb 'list'
      const listVerbBtn = screen.getByText('list');
      fireEvent.click(listVerbBtn);

      // Click to add rule
      const addRuleBtn = screen.getByText('Add Rule');
      fireEvent.click(addRuleBtn);
    });
  });

  describe('Connection-driven RBAC rule sync', () => {
    it('syncs Role resources from connected nodes', () => {
      const initialNodes: any[] = [
        {
          id: 'role-1',
          type: 'Role',
          data: {
            label: 'test-role',
            rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }],
          },
        },
        {
          id: 'deploy-1',
          type: 'Deployment',
          data: { label: 'app-deploy', replicas: 2 },
        },
        {
          id: 'svc-1',
          type: 'Service',
          data: { label: 'app-svc' },
        },
      ];

      const edges: any[] = [
        { id: 'e1', source: 'role-1', target: 'deploy-1' },
        { id: 'e2', source: 'role-1', target: 'svc-1' },
      ];

      const syncedNodes = syncRoleRulesFromConnections(initialNodes, edges);
      const updatedRole = syncedNodes.find((n) => n.id === 'role-1');
      const syncedResources = updatedRole?.data.rules[0].resources;

      expect(syncedResources).toContain('deployments');
      expect(syncedResources).toContain('pods');
      expect(syncedResources).toContain('services');
    });
  });

  describe('Role valid connections', () => {
    it('allows Role connections to Deployment, Pod, Service, ReplicaSet', () => {
      expect(VALID_CONNECTIONS.Role).toEqual(['Deployment', 'Pod', 'Service', 'ReplicaSet']);
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
