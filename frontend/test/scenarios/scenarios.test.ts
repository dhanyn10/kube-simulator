import { describe, it, expect, vi } from 'vitest';
import { scenarios } from '@/scenarios';

describe('Scenarios', () => {
  it('should have scenarios defined', () => {
    expect(scenarios.length).toBeGreaterThan(0);
  });

  it('should be sorted by level weight', () => {
    const levelWeight = {
      'Basic': 0,
      'Intermediate': 1,
      'Advanced': 2
    };

    for (let i = 0; i < scenarios.length - 1; i++) {
      const currentLevel = scenarios[i].level;
      const nextLevel = scenarios[i+1].level;
      expect(levelWeight[currentLevel]).toBeLessThanOrEqual(levelWeight[nextLevel]);
    }
  });

  it('should have required properties for each scenario', () => {
    scenarios.forEach(scenario => {
      expect(scenario.id).toBeDefined();
      expect(scenario.name).toBeDefined();
      expect(scenario.level).toBeDefined();
      expect(scenario.description).toBeDefined();
      expect(scenario.data).toBeDefined();
      expect(Array.isArray(scenario.data.nodes)).toBe(true);
      expect(Array.isArray(scenario.data.edges)).toBe(true);
    });
  });

  it('should not contain legacy runtime or webserver fields and should specify images on workloads', () => {
    scenarios.forEach(scenario => {
      scenario.data.nodes.forEach(node => {
        const nodeType = node.type || node.data?.type;
        const data = node.data || {};

        if (['Pod', 'Deployment', 'ReplicaSet'].includes(nodeType)) {
          expect(data.runtime).toBeUndefined();
          expect(data.webserver).toBeUndefined();
          expect(typeof data.image).toBe('string');
          expect(data.image.trim().length).toBeGreaterThan(0);
        }
      });
    });
  });

  it('handles pvc scenarios where difficulty is missing and level is used', async () => {
    vi.resetModules();
    vi.doMock('@/scenarios/pvc-scenarios.json', () => ({
      default: [
        {
          id: 'pvc-fallback-level',
          name: 'Fallback Level PVC',
          level: 'Intermediate',
          description: 'Testing level fallback without difficulty',
          data: { nodes: [], edges: [] }
        }
      ]
    }));

    const { scenarios: reloadedScenarios } = await import('@/scenarios');
    const matched = reloadedScenarios.find(s => s.id === 'pvc-fallback-level');
    expect(matched).toBeDefined();
    expect(matched?.level).toBe('Intermediate');
    expect(matched?.data.nodes).toEqual([]);

    vi.doUnmock('@/scenarios/pvc-scenarios.json');
  });

  it('includes multi-worker traffic policy scenario covering all worker and policy options', () => {
    const workerScenario = scenarios.find(s => s.id === 'worker-traffic-policy');
    expect(workerScenario).toBeDefined();
    expect(workerScenario?.level).toBe('Intermediate');

    const nodes = workerScenario!.data.nodes;
    const services = nodes.filter(n => n.type === 'Service');
    const pods = nodes.filter(n => n.type === 'Pod');

    // Covers both NodePort and LoadBalancer
    expect(services.some(s => s.data.serviceType === 'NodePort')).toBe(true);
    expect(services.some(s => s.data.serviceType === 'LoadBalancer')).toBe(true);

    // Covers both Cluster and Local externalTrafficPolicy
    expect(services.some(s => s.data.externalTrafficPolicy === 'Cluster')).toBe(true);
    expect(services.some(s => s.data.externalTrafficPolicy === 'Local')).toBe(true);

    // Covers entryNode configuration
    expect(services.every(s => s.data.entryNode)).toBe(true);

    // Covers assignedNode across all 3 workers
    const assignedNodes = pods.map(p => p.data.assignedNode);
    expect(assignedNodes).toContain('worker-1');
    expect(assignedNodes).toContain('worker-2');
    expect(assignedNodes).toContain('worker-3');
  });

  it('includes multi-worker replica spread scenario with deployment replicas on all 3 workers', () => {
    const spread = scenarios.find(s => s.id === 'multi-worker-spread');
    expect(spread).toBeDefined();
    const nodes = spread!.data.nodes;
    const webPods = nodes.filter(n => n.type === 'Pod' && n.parentId === 'dep-spread-web');
    const apiPods = nodes.filter(n => n.type === 'Pod' && n.parentId === 'dep-spread-api');

    expect(new Set(webPods.map(p => p.data.assignedNode))).toEqual(new Set(['worker-1', 'worker-2', 'worker-3']));
    expect(apiPods.map(p => p.data.assignedNode)).not.toContain('worker-1');

    const services = nodes.filter(n => n.type === 'Service');
    expect(services.filter(s => s.data.selector === 'web-app').map(s => s.data.externalTrafficPolicy).sort()).toEqual(['Cluster', 'Local']);
    expect(services.find(s => s.data.selector === 'api-app')?.data.externalTrafficPolicy).toBe('Local');
  });

  it('configures LoadBalanced App scenario with LoadBalancer routing to Ingress using ingressTargets and selector', () => {
    const lbScenario = scenarios.find((s) => s.id === 'intermediate-lb');
    expect(lbScenario).toBeDefined();

    const nodes = lbScenario!.data.nodes;
    const edges = lbScenario!.data.edges;

    const lbService = nodes.find((n) => n.id === 'lb-service-int');
    const ingress = nodes.find((n) => n.id === 'ingress-int');
    const clusterIpSvc = nodes.find((n) => n.id === 'service-int');
    const deployment = nodes.find((n) => n.id === 'deployment-int');

    expect(lbService).toBeDefined();
    expect(ingress).toBeDefined();
    expect(clusterIpSvc).toBeDefined();
    expect(deployment).toBeDefined();

    expect(lbService?.data.serviceType).toBe('LoadBalancer');
    expect(lbService?.data.selector).toBe('main-ingress');
    expect(lbService?.data.ingressTargets).toEqual(['main-ingress']);

    const lbToIngressEdge = edges.find((e) => e.source === 'lb-service-int' && e.target === 'ingress-int');
    expect(lbToIngressEdge).toBeDefined();

    expect(ingress?.data.backendServiceName).toBe('app-service');
    expect(clusterIpSvc?.data.serviceType).toBe('ClusterIP');
    expect(clusterIpSvc?.data.selector).toBe('app-deployment');
  });
});
