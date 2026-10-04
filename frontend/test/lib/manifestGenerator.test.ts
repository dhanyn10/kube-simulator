import { describe, it, expect } from 'vitest';
import { generateYamlClientSide } from '@/lib/manifestGenerator';

describe('manifestGenerator test suite', () => {
  it('returns empty string when nodes are empty or have no valid types', () => {
    expect(generateYamlClientSide([], [])).toBe('');
    expect(
      generateYamlClientSide([{ id: '1', type: 'Internet', data: { label: 'Internet' } }], [])
    ).toBe('');
    expect(generateYamlClientSide([{ id: '2', data: { label: 'No Type' } }], [])).toBe('');
    expect(generateYamlClientSide([{ id: '3', type: 'Pod', data: {} }], [])).toBe('');
    expect(generateYamlClientSide([{ id: '4', type: 'UnknownType', data: { label: 'Unknown' } }], [])).toBe('');
  });

  it('skips child Pod nodes whose parent is not a Namespace', () => {
    const nodes = [
      { id: 'dep1', type: 'Deployment', data: { label: 'Parent Dep' } },
      { id: 'pod1', type: 'Pod', parentId: 'dep1', data: { label: 'Child Pod' } },
    ];
    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).not.toContain('name: child-pod');
    expect(yamlOutput).toContain('name: parent-dep');
  });

  it('generates Pod in a Namespace correctly', () => {
    const nodes = [
      { id: 'ns1', type: 'Namespace', data: { label: 'My Namespace' } },
      { id: 'pod1', type: 'Pod', parentId: 'ns1', data: { label: 'Scoped Pod', image: 'redis:alpine' } },
    ];
    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('namespace: my-namespace');
    expect(yamlOutput).toContain('name: scoped-pod');
  });

  it('generates Pod and Deployment YAML manifests correctly with custom ports and restart policies', () => {
    const nodes = [
      {
        id: 'pod1',
        type: 'Pod',
        data: {
          label: 'My Pod 1',
          image: 'redis:latest',
          port: '6379',
          restartPolicy: 'OnFailure',
        },
      },
      {
        id: 'dep1',
        type: 'Deployment',
        data: {
          label: 'App Deployment',
          replicas: 3,
          image: 'nginx:alpine',
          yamlSettings: { restartPolicy: false },
        },
      },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('kind: Pod');
    expect(yamlOutput).toContain('name: my-pod-1');
    expect(yamlOutput).toContain('image: redis:latest');
    expect(yamlOutput).toContain('containerPort: 6379');
    expect(yamlOutput).toContain('restartPolicy: OnFailure');

    expect(yamlOutput).toContain('kind: Deployment');
    expect(yamlOutput).toContain('name: app-deployment');
    expect(yamlOutput).toContain('replicas: 3');
    expect(yamlOutput).not.toContain('restartPolicy: Always');
  });

  it('handles default container image when image setting is disabled or image is empty', () => {
    const nodes = [
      {
        id: 'pod1',
        type: 'Pod',
        data: { label: 'Default Image Pod', yamlSettings: { image: false }, image: 'custom:tag' },
      },
    ];
    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('image: nginx:latest');
  });

  it('generates Service, ConfigMap, Secret, PVC and Namespace manifests with custom settings', () => {
    const nodes = [
      { id: 'ns1', type: 'Namespace', data: { label: 'Production' } },
      {
        id: 'svc1',
        type: 'Service',
        parentId: 'ns1',
        data: {
          label: 'Web Service',
          port: '80',
          targetPort: '8080',
          selector: 'custom-app',
        },
      },
      {
        id: 'svc2',
        type: 'Service',
        data: {
          label: 'No Selector Service',
          yamlSettings: { selector: false },
        },
      },
      {
        id: 'cm1',
        type: 'ConfigMap',
        data: {
          label: 'App Config',
          configData: [
            { key: 'KEY1', value: 'VAL1' },
            { key: 'EMPTY_KEY', value: '' },
            { key: '', value: 'IGNORED' },
          ],
        },
      },
      {
        id: 'sec1',
        type: 'Secret',
        data: {
          label: 'App Secret',
          configData: [{ key: 'PASS', value: 'secret123' }],
        },
      },
      {
        id: 'pvc1',
        type: 'PVC',
        data: {
          label: 'Data PVC',
          accessMode: 'ReadWriteMany',
          storageClass: 'fast-ssd',
          storageCapacity: '10Gi',
        },
      },
      {
        id: 'pvc2',
        type: 'PVC',
        data: {
          label: 'No StorageClass PVC',
          yamlSettings: { storageClass: false },
        },
      },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('kind: Namespace');
    expect(yamlOutput).toContain('name: production');

    expect(yamlOutput).toContain('kind: Service');
    expect(yamlOutput).toContain('namespace: production');
    expect(yamlOutput).toContain('app: custom-app');

    expect(yamlOutput).not.toContain('app: no-selector-service');

    expect(yamlOutput).toContain('kind: ConfigMap');
    expect(yamlOutput).toContain('KEY1: VAL1');
    expect(yamlOutput).toContain("EMPTY_KEY: ''");

    expect(yamlOutput).toContain('kind: Secret');
    expect(yamlOutput).toContain('PASS: secret123');

    expect(yamlOutput).toContain('kind: PersistentVolumeClaim');
    expect(yamlOutput).toContain('storageClassName: fast-ssd');
    expect(yamlOutput).toContain('accessModes:\n    - ReadWriteMany');
    expect(yamlOutput).not.toContain('storageClassName: standard');
  });

  it('handles resource limit connections via both source and target edges', () => {
    const nodes = [
      {
        id: 'pod1',
        type: 'Pod',
        data: {
          label: 'Source Linked Pod',
          cpuRequest: '100m',
          cpuLimit: '200m',
        },
      },
      {
        id: 'pod2',
        type: 'Pod',
        data: {
          label: 'Target Linked Pod',
          memoryRequest: '128Mi',
          memoryLimit: '256Mi',
        },
      },
      {
        id: 'pod3',
        type: 'Pod',
        data: {
          label: 'Disabled Resources Pod',
          cpuRequest: '100m',
          resourceLimits: [{ id: 'rl1' }],
          yamlSettings: { resources: false },
        },
      },
      { id: 'rl1', type: 'ResourceLimit', data: { label: 'Limit Node 1' } },
      { id: 'rl2', type: 'ResourceLimit', data: { label: 'Limit Node 2' } },
    ];

    const edges = [
      { id: 'e1', source: 'rl1', target: 'pod1' }, // pod1 is target of ResourceLimit
      { id: 'e2', source: 'pod2', target: 'rl2' }, // pod2 is source connected to ResourceLimit
    ];

    const yamlOutput = generateYamlClientSide(nodes, edges);
    expect(yamlOutput).toContain('name: source-linked-pod');
    expect(yamlOutput).toContain('cpu: 100m');

    expect(yamlOutput).toContain('name: target-linked-pod');
    expect(yamlOutput).toContain('memory: 256Mi');

    expect(yamlOutput).not.toContain('name: disabled-resources-pod\n    spec:\n      containers:\n        - name: disabled-resources-pod\n          image: nginx:latest\n          imagePullPolicy: IfNotPresent\n          resources:');
  });

  it('sanitizes labels with special characters, consecutive dashes, and truncates long labels', () => {
    const longLabel = 'a'.repeat(80);
    const nodes = [
      {
        id: 'pod1',
        type: 'Pod',
        data: { label: `   Complex  --  Label!! @#$ %^&* () ${longLabel}   ` },
      },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('kind: Pod');
    // Name should be sanitized and sliced to 63 chars
    expect(yamlOutput).toContain('name: complex-label-');
  });
});
