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
    expect(yamlOutput).toContain('type: ClusterIP');
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

  it('generates Service manifests with custom serviceType and nodePort', () => {
    const nodes = [
      {
        id: 'svc1',
        type: 'Service',
        data: {
          label: 'NodePort Service',
          serviceType: 'NodePort',
          port: '80',
          targetPort: '8080',
          nodePort: '30080',
        },
      },
      {
        id: 'svc2',
        type: 'Service',
        data: {
          label: 'LoadBalancer Service',
          serviceType: 'LoadBalancer',
          port: '443',
          targetPort: '8443',
          nodePort: '30443',
        },
      },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('type: NodePort');
    expect(yamlOutput).toContain('nodePort: 30080');
    expect(yamlOutput).toContain('type: LoadBalancer');
    expect(yamlOutput).toContain('nodePort: 30443');
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

  it('covers service selector resolution via outgoing edges and nodePort disabling via yamlSettings', () => {
    const nodes = [
      {
        id: 'svc1',
        type: 'Service',
        data: {
          label: 'Edge Selector Service',
          serviceType: 'NodePort',
          nodePort: '30080',
          yamlSettings: { nodePort: false, serviceType: false }
        }
      },
      { id: 'pod1', type: 'Pod', data: { label: 'Linked Workload' } }
    ];

    const edges = [{ id: 'e1', source: 'svc1', target: 'pod1' }];

    const yamlOutput = generateYamlClientSide(nodes, edges);
    expect(yamlOutput).toContain('kind: Service');
    expect(yamlOutput).toContain('app: linked-workload');
    expect(yamlOutput).not.toContain('nodePort: 30080');
    expect(yamlOutput).not.toContain('type: NodePort');
  });

  it('covers ingress backend resolution via outgoing edges and fallback to default app-service', () => {
    // 1. Ingress with outgoing edge to Service
    const nodes1 = [
      { id: 'ing1', type: 'Ingress', data: { label: 'My Ingress', ingressHost: 'test.local', ingressPath: '/api' } },
      { id: 'svc1', type: 'Service', data: { label: 'Backend Service', port: 8080 } }
    ];
    const edges1 = [{ id: 'e1', source: 'ing1', target: 'svc1' }];

    const yamlOutput1 = generateYamlClientSide(nodes1, edges1);
    expect(yamlOutput1).toContain('host: test.local');
    expect(yamlOutput1).toContain('name: backend-service');
    expect(yamlOutput1).toContain('number: 8080');

    // 2. Ingress with no backendServiceName and no outgoing edge -> defaults to app-service
    const nodes2 = [
      { id: 'ing2', type: 'Ingress', data: { label: 'Fallback Ingress' } }
    ];

    const yamlOutput2 = generateYamlClientSide(nodes2, []);
    expect(yamlOutput2).toContain('name: app-service');
    expect(yamlOutput2).toContain('host: example.local');
    expect(yamlOutput2).toContain('path: /');
  });

  it('covers ConfigMap and Secret non-array or missing key handling, and ResourceLimit requests/limits combinations', () => {
    const nodes = [
      { id: 'cm1', type: 'ConfigMap', data: { label: 'Bad ConfigMap', configData: null } },
      { id: 'sec1', type: 'Secret', data: { label: 'Bad Secret', configData: 'invalid' } },
      {
        id: 'pod1',
        type: 'Pod',
        data: {
          label: 'Requests Only Pod',
          cpuRequest: '500m',
          memoryRequest: '512Mi',
          resourceLimits: [{ id: 'rl1' }]
        }
      },
      {
        id: 'pod2',
        type: 'Pod',
        data: {
          label: 'Limits Only Pod',
          cpuLimit: '1000m',
          memoryLimit: '1024Mi',
          resourceLimits: [{ id: 'rl1' }]
        }
      }
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('kind: ConfigMap');
    expect(yamlOutput).toContain('data: {}');
    expect(yamlOutput).toContain('kind: Secret');
    expect(yamlOutput).toContain('stringData: {}');

    expect(yamlOutput).toContain('name: requests-only-pod');
    expect(yamlOutput).toContain('cpu: 500m');

    expect(yamlOutput).toContain('name: limits-only-pod');
    expect(yamlOutput).toContain('cpu: 1000m');
  });

  it('handles missing parent node in nodeMap gracefully when parentId is specified', () => {
    const nodes = [
      { id: 'pod1', type: 'Pod', parentId: 'missing-ns', data: { label: 'Orphan Pod' } }
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('name: orphan-pod');
    expect(yamlOutput).not.toContain('namespace:');
  });

  it('explicitly covers yamlSettings.resources === false branch and createResourceObject with empty request/limit fields', () => {
    const nodes = [
      {
        id: 'pod1',
        type: 'Pod',
        data: {
          label: 'No Res Pod',
          cpuRequest: '100m',
          yamlSettings: { resources: false }
        }
      },
      {
        id: 'pod2',
        type: 'Pod',
        data: {
          label: 'Empty Res Pod',
          resourceLimits: [{ id: 'rl1' }]
          // cpuRequest, cpuLimit, memoryRequest, memoryLimit are all undefined
        }
      }
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).not.toContain('name: no-res-pod\n          resources:');
    expect(yamlOutput).not.toContain('name: empty-res-pod\n          resources:');
  });
});
