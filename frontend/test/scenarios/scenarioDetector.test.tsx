import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Folder,
  Route,
  Globe,
  Layers,
  Box,
  Network,
  Activity,
  Database,
  HardDrive,
  Settings,
  Lock,
  ShieldCheck,
  Gauge,
} from 'lucide-react';
import {
  detectScenarioResources,
  getResourceBadgeClasses,
  getResourceIcon,
  ResourceBadge,
  ResourceBadgeList,
} from '@/scenarios/scenarioDetector';

describe('scenarioDetector', () => {
  describe('detectScenarioResources', () => {
    it('returns empty result when scenario is null or undefined', () => {
      expect(detectScenarioResources(null)).toEqual({ resources: [], totalCards: 0, totalItems: 0 });
      expect(detectScenarioResources(undefined)).toEqual({ resources: [], totalCards: 0, totalItems: 0 });
      expect(detectScenarioResources({} as any)).toEqual({ resources: [], totalCards: 0, totalItems: 0 });
    });

    it('detects cards and attached items correctly', () => {
      const mockScenario = {
        id: 'test-scenario',
        name: 'Test Scenario',
        level: 'Intermediate' as const,
        description: 'Test description',
        data: {
          nodes: [
            { id: '1', type: 'Internet', data: { label: 'Internet' } },
            { id: '2', type: 'Namespace', data: { label: 'prod' } },
            { id: '3', type: 'Service', data: { label: 'web-svc', serviceType: 'LoadBalancer' } },
            { id: '4', type: 'Service', data: { label: 'api-svc', serviceType: 'ClusterIP' } },
            {
              id: '5',
              type: 'Deployment',
              data: {
                label: 'api-dep',
                hpas: [{ id: 'h1', name: 'api-hpa', minReplicas: 1, maxReplicas: 5, targetCPU: 80 }],
                configMaps: [{ id: 'c1', name: 'app-config', data: [] }],
                secrets: [{ id: 's1', name: 'db-secret', secretData: [] }],
                roles: [{ id: 'r1', name: 'pod-reader', roleName: 'pod-reader' }],
                resourceLimits: [{ id: 'rl1', name: 'api-limit', cpuLimit: '500m' }],
                attachedResources: [{ type: 'PVC', name: 'data-vol' }],
              },
            },
            { id: '6', type: 'Pod', data: { label: 'worker-pod' } },
          ],
          edges: [],
        },
      };

      const result = detectScenarioResources(mockScenario);

      expect(result.totalCards).toBe(6);
      expect(result.totalItems).toBe(6); // 1 hpa, 1 configmap, 1 secret, 1 role, 1 resourceLimit, 1 attached PVC

      const resNames = result.resources.map((r) => r.name);
      expect(resNames).toEqual([
        'Internet',
        'Namespace',
        'Service',
        'Deployment',
        'Pod',
        'HPA',
        'ResourceLimit',
        'ConfigMap',
        'Secret',
        'PVC',
        'Role',
      ]);

      const svc = result.resources.find((r) => r.name === 'Service');
      expect(svc?.count).toBe(2);
      expect(svc?.cardCount).toBe(2);
      expect(svc?.itemCount).toBe(0);
      expect(svc?.subtypes).toEqual(['LoadBalancer', 'ClusterIP']);

      const hpa = result.resources.find((r) => r.name === 'HPA');
      expect(hpa?.count).toBe(1);
      expect(hpa?.cardCount).toBe(0);
      expect(hpa?.itemCount).toBe(1);
    });

    it('handles legacy scenario structure with top-level nodes array and unknown node types', () => {
      const mockScenario = {
        nodes: [
          { id: 'u1', type: 'CustomCRD', data: {} },
          { id: 'u2', type: 'AnotherCRD', data: {} },
        ],
      };

      const result = detectScenarioResources(mockScenario as any);
      expect(result.totalCards).toBe(2);
      expect(result.resources.map((r) => r.name)).toEqual(['AnotherCRD', 'CustomCRD']);
    });
  });

  describe('getResourceBadgeClasses', () => {
    it('returns appropriate styling for known resources in dark and light modes', () => {
      const types = [
        'Deployment',
        'StatefulSet',
        'ReplicaSet',
        'Pod',
        'Service',
        'Ingress',
        'HPA',
        'ResourceLimit',
        'Internet',
        'PVC',
        'Namespace',
        'ConfigMap',
        'Secret',
        'Role',
        'UnknownResource',
      ];

      types.forEach((t) => {
        const darkClass = getResourceBadgeClasses(t, 'dark');
        const lightClass = getResourceBadgeClasses(t, 'light');
        expect(darkClass).toBeDefined();
        expect(lightClass).toBeDefined();
        expect(darkClass).not.toBe(lightClass);
      });
    });
  });

  describe('getResourceIcon', () => {
    it('returns valid React elements matching canvas cards and attached items', () => {
      expect(getResourceIcon('Namespace').type).toBe(Folder);
      expect(getResourceIcon('Ingress').type).toBe(Route);
      expect(getResourceIcon('Internet').type).toBe(Globe);
      expect(getResourceIcon('ResourceLimit').type).toBe(Gauge);
      expect(getResourceIcon('Deployment').type).toBe(Layers);
      expect(getResourceIcon('ReplicaSet').type).toBe(Layers);
      expect(getResourceIcon('Pod').type).toBe(Box);
      expect(getResourceIcon('Service').type).toBe(Network);
      expect(getResourceIcon('HPA').type).toBe(Activity);
      expect(getResourceIcon('PVC').type).toBe(HardDrive);
      expect(getResourceIcon('StatefulSet').type).toBe(Database);
      expect(getResourceIcon('ConfigMap').type).toBe(Settings);
      expect(getResourceIcon('Secret').type).toBe(Lock);
      expect(getResourceIcon('Role').type).toBe(ShieldCheck);
      expect(getResourceIcon('UnknownResource').type).toBe(Box);
    });

    it('returns valid React elements for all known resource icons including default fallback', () => {
      const types = [
        'Deployment',
        'StatefulSet',
        'ReplicaSet',
        'Pod',
        'Service',
        'Ingress',
        'HPA',
        'ResourceLimit',
        'Internet',
        'PVC',
        'Namespace',
        'ConfigMap',
        'Secret',
        'Role',
        'UnknownResource',
      ];

      types.forEach((t) => {
        const icon = getResourceIcon(t, 12);
        expect(icon).toBeDefined();
        expect(icon.props.size).toBe(12);
      });
    });
  });

  describe('detectScenarioResources edge cases', () => {
    it('handles untyped nodes, null node data, duplicate subtypes, and attachedResources with resourceType', () => {
      const scenario = {
        data: {
          nodes: [
            { id: 'n1', type: undefined, data: undefined },
            { id: 'n2', type: 123 as any, data: undefined },
            {
              id: 's1',
              type: 'Service',
              data: { serviceType: 'ClusterIP' },
            },
            {
              id: 's2',
              type: 'Service',
              data: { serviceType: 'ClusterIP' },
            },
            {
              id: 'n3',
              type: 'Deployment',
              data: {
                attachedResources: [
                  { resourceType: 'HPA' },
                  { invalid: true } as any,
                ],
              },
            },
            {
              id: 'n4',
              type: 'Deployment',
              data: {
                serviceType: undefined,
              },
            },
          ],
        },
      };

      const result = detectScenarioResources(scenario);
      expect(result.totalCards).toBe(4);
      expect(result.totalItems).toBe(1);
      const svc = result.resources.find((r) => r.name === 'Service');
      expect(svc?.count).toBe(2);
      expect(svc?.subtypes).toEqual(['ClusterIP']);
      const dep = result.resources.find((r) => r.name === 'Deployment');
      expect(dep?.count).toBe(2);
      const hpa = result.resources.find((r) => r.name === 'HPA');
      expect(hpa?.count).toBe(1);
    });
  });

  describe('ResourceBadge', () => {
    it('renders with subtypes and size sm', () => {
      const resource = {
        name: 'Service',
        count: 1,
        cardCount: 1,
        itemCount: 0,
        subtypes: ['ClusterIP', 'NodePort'],
      };

      const { container } = render(
        <ResourceBadge resource={resource} colorMode="light" size="sm" />
      );

      const badge = screen.getByTitle('Service (ClusterIP, NodePort)');
      expect(badge).toBeDefined();
      expect(badge.className).toContain('text-[9px]');
      expect(container.textContent).toContain('Service');
    });

    it('renders with default props and no subtypes', () => {
      const resource = {
        name: 'Pod',
        count: 1,
        cardCount: 1,
        itemCount: 0,
      };

      render(<ResourceBadge resource={resource} />);
      const badge = screen.getByTitle('Pod');
      expect(badge).toBeDefined();
      expect(badge.className).toContain('text-[10px]');
    });
  });

  describe('ResourceBadgeList', () => {
    it('returns null when resources is empty or null', () => {
      const { container: c1 } = render(
        <ResourceBadgeList resources={[]} prefixKey="empty" />
      );
      expect(c1.firstChild).toBeNull();

      const { container: c2 } = render(
        <ResourceBadgeList resources={undefined as any} prefixKey="null" />
      );
      expect(c2.firstChild).toBeNull();
    });

    it('renders badge list with custom size, className, and testId', () => {
      const resources = [
        { name: 'Deployment', count: 1, cardCount: 1, itemCount: 0 },
      ];

      render(
        <ResourceBadgeList
          resources={resources}
          prefixKey="test"
          size="sm"
          testId="badge-list"
          className="my-custom-class"
        />
      );

      const list = screen.getByTestId('badge-list');
      expect(list).toBeDefined();
      expect(list.className).toContain('gap-1');
      expect(list.className).toContain('my-custom-class');
      expect(screen.getByText('Deployment')).toBeDefined();
    });

    it('renders badge list with default size and colorMode', () => {
      const resources = [
        { name: 'Pod', count: 1, cardCount: 1, itemCount: 0 },
      ];

      render(
        <ResourceBadgeList
          resources={resources}
          prefixKey="test-def"
          testId="badge-list-def"
        />
      );

      const list = screen.getByTestId('badge-list-def');
      expect(list).toBeDefined();
      expect(list.className).toContain('gap-1.5');
      expect(screen.getByText('Pod')).toBeDefined();
    });
  });
});
