import { describe, it, expect } from 'vitest';
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
});
