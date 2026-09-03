import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { RoleSettingsSection } from '@/components/Config/RoleSettingsSection';
import { useFlowStore } from '../../../src/store';
import { RoleNode } from '@/components/Nodes/Role';
import { handleGetRolesCommand, handleDescribeRoleCommand } from '@/components/Layout/terminalCommands';

// React Flow Mock wrapper
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    Handle: ({ type, position, id }: any) => <div data-testid={`handle-${type}-${position}-${id}`} />,
    Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  };
});

describe('Role feature tests (Hero Items on Cards)', () => {
  describe('RoleNode component', () => {
    it('renders RoleNode with rules preview and +N more rules when rules > 2', () => {
      const mockProps: any = {
        id: 'role-1',
        type: 'Role',
        data: {
          label: 'my-role',
          type: 'Role',
          rules: [
            { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] },
            { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get'] },
            { apiGroups: ['batch'], resources: ['jobs'], verbs: ['create'] },
          ],
        },
      };

      render(<RoleNode {...mockProps} />);
      expect(screen.getByText('Rules (3)')).toBeInTheDocument();
      expect(screen.getByText('Res: pods')).toBeInTheDocument();
      expect(screen.getByText('Res: deployments')).toBeInTheDocument();
      expect(screen.getByText('+ 1 more rule(s)...')).toBeInTheDocument();
    });

    it('does not render rules preview when displaySettings.rules is false', () => {
      const mockProps: any = {
        id: 'role-2',
        type: 'Role',
        data: {
          label: 'hidden-role',
          type: 'Role',
          displaySettings: { rules: false },
          rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }],
        },
      };

      render(<RoleNode {...mockProps} />);
      expect(screen.queryByText('Rules (1)')).not.toBeInTheDocument();
    });
  });

  describe('RoleSettingsSection component', () => {
    it('renders empty role state in Settings section (returns null when no roles attached)', () => {
      const data = {
        label: 'my-deployment',
        type: 'Deployment' as const,
        roles: [],
      };

      const { container } = render(<RoleSettingsSection data={data as any} nodeId="deploy-1" />);
      expect(container.firstChild).toBeNull();
    });

    it('renders attached role hero item icon with count badge and popover list', () => {
      const data = {
        label: 'app-deployment',
        type: 'Deployment' as const,
        roles: [
          {
            id: 'role-item-1',
            name: 'app-reader-role',
            rules: [
              {
                apiGroups: [''],
                resources: ['pods', 'deployments'],
                verbs: ['get', 'list'],
              },
            ],
          },
        ],
      };

      render(<RoleSettingsSection data={data as any} nodeId="deploy-1" />);
      expect(screen.getByTitle('Attached Roles (1)')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();

      // Open popover list
      fireEvent.click(screen.getByTitle('Attached Roles (1)'));
      expect(screen.getByText('app-reader-role')).toBeInTheDocument();
    });

    it('handles editing and deleting roles in RoleSettingsSection', () => {
      const updateNodeData = vi.fn();
      const addLog = vi.fn();
      useFlowStore.setState({ updateNodeData, addLog });

      const data = {
        label: 'app-deployment',
        type: 'Deployment' as const,
        roles: [
          {
            id: 'role-item-1',
            name: 'app-reader-role',
            rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }],
          },
        ],
      };

      render(<RoleSettingsSection data={data as any} nodeId="deploy-1" />);

      // Toggle popover list
      fireEvent.click(screen.getByTitle('Attached Roles (1)'));

      // Click Delete Role in popover
      const deleteBtn = screen.getByTitle('Delete Role');
      fireEvent.click(deleteBtn);
      expect(updateNodeData).toHaveBeenCalledWith('deploy-1', { roles: [] });

      // Click Edit Role in popover
      const editBtn = screen.getByTitle('Edit Role');
      fireEvent.click(editBtn);
    });
  });

  describe('Role terminal commands for attached hero roles', () => {
    it('handles kubectl get roles and rolebindings for nodes with attached roles', () => {
      const logs: string[] = [];
      const ctx: any = {
        nodes: [
          {
            id: 'deploy-1',
            type: 'Deployment',
            data: {
              label: 'app-deployment',
              roles: [
                {
                  id: 'role-1',
                  name: 'pod-reader',
                  rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }],
                },
              ],
            },
          },
        ],
        addActivityLog: (line: string) => logs.push(line),
      };

      const resRoles = handleGetRolesCommand('kubectl get roles', ctx);
      expect(resRoles).toBe(true);
      expect(logs.some((l) => l.includes('pod-reader'))).toBe(true);

      const resBindings = handleGetRolesCommand('kubectl get rolebindings', ctx);
      expect(resBindings).toBe(true);
      expect(logs.some((l) => l.includes('pod-reader-binding'))).toBe(true);
    });

    it('handles kubectl describe role for attached roles', () => {
      const logs: string[] = [];
      const ctx: any = {
        nodes: [
          {
            id: 'deploy-1',
            type: 'Deployment',
            data: {
              label: 'app-deployment',
              roles: [
                {
                  id: 'role-1',
                  name: 'pod-reader',
                  rules: [
                    {
                      apiGroups: [''],
                      resources: ['pods'],
                      verbs: ['get', 'list'],
                    },
                  ],
                },
              ],
            },
          },
        ],
        addActivityLog: (line: string) => logs.push(line),
      };

      const handled = handleDescribeRoleCommand('kubectl describe role pod-reader', ctx);
      expect(handled).toBe(true);
      expect(logs.some((l) => l.includes('pod-reader'))).toBe(true);
      expect(logs.some((l) => l.includes('pods'))).toBe(true);
    });
  });
});
