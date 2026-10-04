import { describe, it, expect } from 'vitest';
import { generateYamlClientSide } from '@/lib/manifestGenerator';

describe('manifestGenerator test suite', () => {
  it('returns empty string when nodes are empty or have no valid types', () => {
    expect(generateYamlClientSide([], [])).toBe('');
    expect(
      generateYamlClientSide([{ id: '1', type: 'Internet', data: { label: 'Internet' } }], [])
    ).toBe('');
  });

  it('generates Pod and Deployment YAML manifests correctly', () => {
    const nodes = [
      { id: 'pod1', type: 'Pod', data: { label: 'My Pod 1', image: 'redis:latest', port: '6379' } },
      {
        id: 'dep1',
        type: 'Deployment',
        data: { label: 'App Deployment', replicas: 3, image: 'nginx:alpine' },
      },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('kind: Pod');
    expect(yamlOutput).toContain('name: my-pod-1');
    expect(yamlOutput).toContain('image: redis:latest');
    expect(yamlOutput).toContain('containerPort: 6379');
    expect(yamlOutput).toContain('kind: Deployment');
    expect(yamlOutput).toContain('name: app-deployment');
    expect(yamlOutput).toContain('replicas: 3');
  });

  it('generates Service, ConfigMap, Secret, PVC and Namespace manifests', () => {
    const nodes = [
      { id: 'ns1', type: 'Namespace', data: { label: 'Production' } },
      {
        id: 'svc1',
        type: 'Service',
        parentId: 'ns1',
        data: { label: 'Web Service', port: '80', targetPort: '8080' },
      },
      {
        id: 'cm1',
        type: 'ConfigMap',
        data: { label: 'App Config', configData: [{ key: 'KEY1', value: 'VAL1' }] },
      },
      {
        id: 'sec1',
        type: 'Secret',
        data: { label: 'App Secret', configData: [{ key: 'PASS', value: 'secret123' }] },
      },
      {
        id: 'pvc1',
        type: 'PVC',
        data: { label: 'Data PVC', accessMode: 'ReadWriteOnce', storageCapacity: '10Gi' },
      },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('kind: Namespace');
    expect(yamlOutput).toContain('name: production');

    expect(yamlOutput).toContain('kind: Service');
    expect(yamlOutput).toContain('namespace: production');
    expect(yamlOutput).toContain('port: 80');
    expect(yamlOutput).toContain('targetPort: 8080');

    expect(yamlOutput).toContain('kind: ConfigMap');
    expect(yamlOutput).toContain('KEY1: VAL1');

    expect(yamlOutput).toContain('kind: Secret');
    expect(yamlOutput).toContain('PASS: secret123');

    expect(yamlOutput).toContain('kind: PersistentVolumeClaim');
    expect(yamlOutput).toContain('storage: 10Gi');
  });

  it('includes resource requests and limits when connected to ResourceLimit node', () => {
    const nodes = [
      {
        id: 'pod1',
        type: 'Pod',
        data: {
          label: 'Worker',
          image: 'worker:1.0',
          cpuRequest: '100m',
          cpuLimit: '200m',
          memoryRequest: '128Mi',
          memoryLimit: '256Mi',
        },
      },
      { id: 'rl1', type: 'ResourceLimit', data: { label: 'Limits' } },
    ];
    const edges = [{ id: 'e1', source: 'rl1', target: 'pod1' }];

    const yamlOutput = generateYamlClientSide(nodes, edges);
    expect(yamlOutput).toContain('resources:');
    expect(yamlOutput).toContain('cpu: 100m');
    expect(yamlOutput).toContain('memory: 256Mi');
  });
});
