import { describe, it, expect } from 'vitest';
import { generateYamlClientSide, isStatefulSetVolumeClaimTemplate } from '@/lib/manifestGenerator';
import yaml from 'js-yaml';

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

  it('generates StatefulSet YAML manifest when workloadType is StatefulSet', () => {
    const nodes = [
      { id: 'pod1', type: 'Pod', data: { label: 'Stateful Redis', replicas: 3, workloadType: 'StatefulSet', image: 'redis:alpine' } },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('kind: StatefulSet');
    expect(yamlOutput).toContain('name: stateful-redis');
    expect(yamlOutput).toContain('serviceName: stateful-redis');
    expect(yamlOutput).toContain('replicas: 3');
  });

  it('generates StatefulSet with volumeClaimTemplates and Headless Service correctly', () => {
    const nodes = [
      { id: 'ss1', type: 'StatefulSet', data: { label: 'Db StatefulSet', replicas: 3, workloadType: 'StatefulSet', image: 'postgres:15-alpine' } },
      { id: 'pvc1', type: 'PVC', data: { label: 'Data Storage', accessMode: 'ReadWriteOnce', storageClass: 'fast-ssd', storageCapacity: '20Gi' } },
      { id: 'svc1', type: 'Service', data: { label: 'Db Headless', serviceType: 'Headless', port: 5432 } },
    ];

    const edges = [
      { id: 'e1', source: 'ss1', target: 'pvc1' },
      { id: 'e2', source: 'svc1', target: 'ss1' },
    ];

    const yamlOutput = generateYamlClientSide(nodes, edges);
    expect(yamlOutput).toContain('kind: StatefulSet');
    expect(yamlOutput).toContain('name: db-statefulset');
    expect(yamlOutput).toContain('serviceName: db-headless');
    expect(yamlOutput).toContain('volumeClaimTemplates:');
    expect(yamlOutput).toContain('name: data-storage');
    expect(yamlOutput).toContain('storageClassName: fast-ssd');
    expect(yamlOutput).toContain('storage: 20Gi');

    expect(yamlOutput).toContain('kind: Service');
    expect(yamlOutput).toContain('clusterIP: None');

    // Standalone PVC manifest must be suppressed because it was absorbed into volumeClaimTemplates
    const documents = yamlOutput.split('\n---\n');
    expect(documents).toHaveLength(2);
    expect(documents.some((doc) => doc.startsWith('kind: PersistentVolumeClaim'))).toBe(false);
  });

  it('generates standalone PVC when connected to Deployment or when unconnected', () => {
    const nodes = [
      { id: 'dep1', type: 'Deployment', data: { label: 'Web Dep', replicas: 1, image: 'nginx:alpine' } },
      { id: 'pvc1', type: 'PVC', data: { label: 'Web Storage', accessMode: 'ReadWriteOnce', storageCapacity: '5Gi' } },
      { id: 'pvc2', type: 'PVC', data: { label: 'Orphan Storage', accessMode: 'ReadWriteMany', storageCapacity: '10Gi' } },
    ];
    const edges = [{ id: 'e1', source: 'dep1', target: 'pvc1' }];

    const yamlOutput = generateYamlClientSide(nodes, edges);
    const documents = yamlOutput.split('\n---\n');
    expect(documents).toHaveLength(3);
    expect(yamlOutput).toContain('name: web-storage');
    expect(yamlOutput).toContain('name: orphan-storage');
  });

  it('tests isStatefulSetVolumeClaimTemplate helper across incoming and outgoing edges', () => {
    const nodeMap = new Map<string, any>([
      ['ss1', { id: 'ss1', type: 'StatefulSet', data: { label: 'ss' } }],
      ['ss2', { id: 'ss2', type: 'Pod', data: { label: 'ss-workload', workloadType: 'StatefulSet' } }],
      ['dep1', { id: 'dep1', type: 'Deployment', data: { label: 'dep' } }],
      ['pvc1', { id: 'pvc1', type: 'PVC', data: { label: 'pvc1' } }],
    ]);

    const targetEdgeMap = new Map<string, any[]>([
      ['pvc1', [{ source: 'ss1', target: 'pvc1' }]],
    ]);
    expect(isStatefulSetVolumeClaimTemplate('pvc1', nodeMap, targetEdgeMap)).toBe(true);

    // Empty incoming
    expect(isStatefulSetVolumeClaimTemplate('unknown', nodeMap, targetEdgeMap)).toBe(false);

    // Connected to Deployment
    const depTargetEdgeMap = new Map<string, any[]>([
      ['pvc1', [{ source: 'dep1', target: 'pvc1' }]],
    ]);
    expect(isStatefulSetVolumeClaimTemplate('pvc1', nodeMap, depTargetEdgeMap)).toBe(false);

    // Outgoing edge to StatefulSet (reversed edge direction)
    const emptyTargetMap = new Map<string, any[]>();
    const sourceEdgeMap = new Map<string, any[]>([
      ['pvc1', [{ source: 'pvc1', target: 'ss2' }]],
    ]);
    expect(isStatefulSetVolumeClaimTemplate('pvc1', nodeMap, emptyTargetMap, sourceEdgeMap)).toBe(true);
  });

  it('generates Pod and Deployment YAML manifests correctly with custom ports and restart policies', () => {
    const nodes = [
      { id: 'pod1', type: 'Pod', data: { label: 'My Pod 1', image: 'redis:latest', port: '6379', restartPolicy: 'OnFailure' } },
      { id: 'dep1', type: 'Deployment', data: { label: 'App Deployment', replicas: 3, image: 'nginx:alpine', yamlSettings: { restartPolicy: false } } },
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
      { id: 'svc1', type: 'Service', parentId: 'ns1', data: { label: 'Web Service', port: '80', targetPort: '8080', selector: 'custom-app' } },
      { id: 'svc2', type: 'Service', data: { label: 'No Selector Service', yamlSettings: { selector: false } } },
      { id: 'cm1', type: 'ConfigMap', data: { label: 'App Config', configData: [{ key: 'KEY1', value: 'VAL1' }, { key: 'EMPTY_KEY', value: '' }, { key: '', value: 'IGNORED' }] } },
      { id: 'sec1', type: 'Secret', data: { label: 'App Secret', configData: [{ key: 'PASS', value: 'secret123' }] } },
      { id: 'pvc1', type: 'PVC', data: { label: 'Data PVC', accessMode: 'ReadWriteMany', storageClass: 'fast-ssd', storageCapacity: '10Gi' } },
      { id: 'pvc2', type: 'PVC', data: { label: 'No StorageClass PVC', yamlSettings: { storageClass: false } } },
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
    expect(yamlOutput).toContain('ReadWriteMany');
    expect(yamlOutput).not.toContain('storageClassName: standard');
  });

  it('handles resource limit connections via both source and target edges', () => {
    const nodes = [
      { id: 'pod1', type: 'Pod', data: { label: 'Source Linked Pod', cpuRequest: '100m', cpuLimit: '200m' } },
      { id: 'pod2', type: 'Pod', data: { label: 'Target Linked Pod', memoryRequest: '128Mi', memoryLimit: '256Mi' } },
      { id: 'pod3', type: 'Pod', data: { label: 'Disabled Resources Pod', cpuRequest: '100m', resourceLimits: [{ id: 'rl1' }], yamlSettings: { resources: false } } },
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

    const docs = yaml.loadAll(yamlOutput) as any[];
    const disabledPod = docs.find((d) => d?.metadata?.name === 'disabled-resources-pod');
    expect(disabledPod?.spec?.containers?.[0]?.resources).toBeUndefined();
  });

  it('generates Service manifests with custom serviceType, nodePort, and externalTrafficPolicy', () => {
    const nodes = [
      { id: 'svc1', type: 'Service', data: { label: 'NodePort Service', serviceType: 'NodePort', port: '80', targetPort: '8080', nodePort: '30080', externalTrafficPolicy: 'Local' } },
      { id: 'svc2', type: 'Service', data: { label: 'LoadBalancer Service', serviceType: 'LoadBalancer', port: '443', targetPort: '8443', nodePort: '30443', externalTrafficPolicy: 'Cluster' } },
      { id: 'svc3', type: 'Service', data: { label: 'ClusterIP Service', serviceType: 'ClusterIP', port: '80', externalTrafficPolicy: 'Local' } },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('type: NodePort');
    expect(yamlOutput).toContain('nodePort: 30080');
    expect(yamlOutput).toContain('externalTrafficPolicy: Local');
    expect(yamlOutput).toContain('type: LoadBalancer');
    expect(yamlOutput).toContain('nodePort: 30443');
    expect(yamlOutput).toContain('externalTrafficPolicy: Cluster');

    // LoadBalancer Service targeting Ingress
    const lbIngressNodes = [
      { id: 'svc-lb', type: 'Service', data: { label: 'lb-ingress-svc', serviceType: 'LoadBalancer', ingressTargets: ['my-ingress'] } },
      { id: 'ing1', type: 'Ingress', data: { label: 'my-ingress' } },
    ];
    const lbIngressYaml = generateYamlClientSide(lbIngressNodes, [{ id: 'e1', source: 'svc-lb', target: 'ing1' }]);
    expect(lbIngressYaml).toContain('app.kubernetes.io/name: ingress-nginx');
    expect(lbIngressYaml).toContain('app.kubernetes.io/component: controller');
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
    expect(yamlOutput).toContain('name: complex-label-a');
  });

  it('covers service selector resolution via outgoing edges and nodePort disabling via yamlSettings', () => {
    const nodes = [
      { id: 'svc1', type: 'Service', data: { label: 'Edge Selector Service', serviceType: 'NodePort', nodePort: '30080', yamlSettings: { nodePort: false, serviceType: false } } },
      { id: 'pod1', type: 'Pod', data: { label: 'Linked Workload' } },
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

  it('covers multi-service Ingress routing and custom ingressClassName', () => {
    const nodes = [
      {
        id: 'ing-multi',
        type: 'Ingress',
        data: {
          label: 'Multi Ingress',
          ingressHost: 'api.prod.local',
          ingressClassName: 'traefik'
        }
      },
      { id: 'svc-api', type: 'Service', data: { label: 'api-service', port: 8080 } },
      { id: 'svc-pay', type: 'Service', data: { label: 'payment-service', port: 9000 } }
    ];
    const edges = [
      { id: 'e1', source: 'ing-multi', target: 'svc-api' },
      { id: 'e2', source: 'ing-multi', target: 'svc-pay' }
    ];

    const yamlOutput = generateYamlClientSide(nodes, edges);
    expect(yamlOutput).toContain('ingressClassName: traefik');
    expect(yamlOutput).toContain('traefik.ingress.kubernetes.io/router.entrypoints: web,websecure');
    expect(yamlOutput).not.toContain('nginx.ingress.kubernetes.io/rewrite-target');
    expect(yamlOutput).toContain('path: /api');
    expect(yamlOutput).toContain('name: api-service');
    expect(yamlOutput).toContain('path: /payment');
    expect(yamlOutput).toContain('name: payment-service');
  });

  it('covers ConfigMap and Secret non-array or missing key handling, and ResourceLimit requests/limits combinations', () => {
    const nodes = [
      { id: 'cm1', type: 'ConfigMap', data: { label: 'Bad ConfigMap', configData: null } },
      { id: 'sec1', type: 'Secret', data: { label: 'Bad Secret', configData: 'invalid' } },
      { id: 'pod1', type: 'Pod', data: { label: 'Requests Only Pod', cpuRequest: '500m', memoryRequest: '512Mi', resourceLimits: [{ id: 'rl1' }] } },
      { id: 'pod2', type: 'Pod', data: { label: 'Limits Only Pod', cpuLimit: '1000m', memoryLimit: '1024Mi', resourceLimits: [{ id: 'rl1' }] } },
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

  it('automatically defaults requests to match limits when limits are specified without requests', () => {
    const nodes = [
      {
        id: 'pod-limits',
        type: 'Pod',
        data: {
          label: 'guaranteed-pod',
          cpuLimit: '800m',
          memoryLimit: '512Mi',
          resourceLimits: [{ id: 'rl1' }],
        },
      },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('limits:');
    expect(yamlOutput).toContain('requests:');
    expect(yamlOutput).toContain('cpu: 800m');
    expect(yamlOutput).toContain('memory: 512Mi');
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
      { id: 'pod1', type: 'Pod', data: { label: 'No Res Pod', cpuRequest: '100m', yamlSettings: { resources: false } } },
      { id: 'pod2', type: 'Pod', data: { label: 'Empty Res Pod', resourceLimits: [{ id: 'rl1' }] } },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).not.toContain('name: no-res-pod\n          resources:');
    expect(yamlOutput).not.toContain('name: empty-res-pod\n          resources:');
  });

  it('clamps resource requests that exceed limits to satisfy admission control integrity', () => {
    const nodes = [
      {
        id: 'pod-clamped',
        type: 'Pod',
        data: {
          label: 'Clamped Pod',
          cpuRequest: '2000m',
          cpuLimit: '500m',
          memoryRequest: '1Gi',
          memoryLimit: '256Mi',
          resourceLimits: [{ id: 'rl1' }]
        }
      }
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('cpu: 500m');
    expect(yamlOutput).toContain('memory: 256Mi');
    expect(yamlOutput).not.toContain('cpu: 2000m');
    expect(yamlOutput).not.toContain('memory: 1Gi');
  });

  it('omits out-of-range nodePort (< 30000 or > 32767) from generated Service manifest', () => {
    const nodes = [
      {
        id: 'svc-invalid-np',
        type: 'Service',
        data: {
          label: 'Invalid NodePort Svc',
          serviceType: 'NodePort',
          port: '80',
          targetPort: '8080',
          nodePort: '8080' // Invalid: < 30000
        }
      },
      {
        id: 'svc-high-np',
        type: 'Service',
        data: {
          label: 'High NodePort Svc',
          serviceType: 'NodePort',
          port: '80',
          targetPort: '8080',
          nodePort: '40000' // Invalid: > 32767
        }
      }
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).not.toContain('nodePort: 8080');
    expect(yamlOutput).not.toContain('nodePort: 40000');
  });

  it('covers sanitizeName with empty string, Ingress serviceName property, and Service/Pod missing labels', () => {
    const nodes = [
      { id: 'ing1', type: 'Ingress', data: { label: 'Ingress 1', serviceName: 'custom-svc-name', servicePort: '9090' } },
      { id: 'svc1', type: 'Service', data: { label: 'service-1', serviceType: 'ClusterIP' } },
      { id: 'pod1', type: 'Pod', data: { label: 'pod-1' } }
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('name: custom-svc-name');
    expect(yamlOutput).toContain('number: 9090');
    expect(yamlOutput).toContain('name: service-1');
    expect(yamlOutput).toContain('name: pod-1');
  });

  it('covers remaining uncovered branches in manifestGenerator', () => {
    // 1. Multiple edges with identical source and target to cover buildEdgeMaps else branches
    const edgeSharingNodes = [
      { id: 'pod-src', type: 'Pod', data: { label: 'pod-source' } },
      { id: 'pvc-tgt', type: 'PVC', data: { label: 'pvc-target' } },
    ];
    const duplicateEdges = [
      { id: 'e1', source: 'pod-src', target: 'pvc-tgt' },
      { id: 'e2', source: 'pod-src', target: 'pvc-tgt' },
    ];
    expect(generateYamlClientSide(edgeSharingNodes, duplicateEdges)).toContain('name: pod-source');

    // 2. Namespace with empty label (covers getNamespace fallback and sanitizeName empty check)
    const nsWithEmptyLabel = [
      { id: 'ns-empty', type: 'Namespace', data: { label: '' } },
      { id: 'pod-scoped', type: 'Pod', parentId: 'ns-empty', data: { label: 'scoped-pod' } },
    ];
    expect(generateYamlClientSide(nsWithEmptyLabel, [])).toContain('name: scoped-pod');

    // 3. StatefulSet with bare PVC defaults, edge to non-PVC, incoming from non-Service, and incoming from Service without label
    const statefulSetNodes = [
      { id: 'ss-bare', type: 'StatefulSet', data: { label: 'ss-bare-app', workloadType: 'StatefulSet' } },
      { id: 'pvc-bare-1', type: 'PVC', data: {} },
      { id: 'pvc-no-storageclass', type: 'PVC', data: { label: 'pvc-no-sc', yamlSettings: { storageClass: false } } },
      { id: 'cm-extra', type: 'ConfigMap', data: { label: 'cm-extra' } },
      { id: 'svc-no-label', type: 'Service', data: {} },
      { id: 'pod-sender', type: 'Pod', data: { label: 'sender-pod' } },
    ];

    const ssEdges = [
      { id: 'e-ss-pvc1', source: 'ss-bare', target: 'pvc-bare-1' },
      { id: 'e-ss-pvc2', source: 'ss-bare', target: 'pvc-no-storageclass' },
      { id: 'e-ss-cm', source: 'ss-bare', target: 'cm-extra' }, // target is not PVC
      { id: 'e-pod-ss', source: 'pod-sender', target: 'ss-bare' }, // source is not Service
      { id: 'e-svc-ss', source: 'svc-no-label', target: 'ss-bare' }, // source is Service without label
    ];

    const ssYaml = generateYamlClientSide(statefulSetNodes, ssEdges);
    expect(ssYaml).toContain('kind: StatefulSet');
    expect(ssYaml).toContain('storageClassName: standard');
    expect(ssYaml).toContain('storage: 1Gi');
    expect(ssYaml).toContain('ReadWriteOnce');

    // 4. Service with selector pointing to target workload without label
    const svcNodes = [
      { id: 'svc-select', type: 'Service', data: { label: 'my-service' } },
      { id: 'pod-target-no-label', type: 'Pod', data: {} },
    ];
    const svcEdges = [{ id: 'e-svc-select', source: 'svc-select', target: 'pod-target-no-label' }];
    const svcYaml = generateYamlClientSide(svcNodes, svcEdges);
    expect(svcYaml).toContain('app: my-service');

    // 5. Ingress outgoing edge to non-Service node, and to Service without port/label
    const ingressNodes = [
      { id: 'ing-edge-test', type: 'Ingress', data: { label: 'my-ing' } },
      { id: 'pod-not-svc', type: 'Pod', data: { label: 'not-svc' } },
      { id: 'svc-bare-tgt', type: 'Service', data: {} },
    ];
    const ingressEdges = [
      { id: 'e-ing-pod', source: 'ing-edge-test', target: 'pod-not-svc' },
      { id: 'e-ing-svc', source: 'ing-edge-test', target: 'svc-bare-tgt' },
    ];
    const ingYaml = generateYamlClientSide(ingressNodes, ingressEdges);
    expect(ingYaml).toContain('kind: Ingress');
    expect(ingYaml).toContain('number: 80');

    // 6. Secret configData with empty key and undefined value
    const secretNodes = [
      { id: 'sec-edge-cases', type: 'Secret', data: { label: 'secret-edges', configData: [{ key: '', value: 'empty-key-ignored' }, { key: 'EMPTY_VAL_KEY', value: undefined }] } },
    ];
    const secYaml = generateYamlClientSide(secretNodes, []);
    expect(secYaml).toContain('EMPTY_VAL_KEY: \'\'');
    expect(secYaml).not.toContain('empty-key-ignored');

    // 7. PVC with bare defaults and with yamlSettings.storageClass: false
    const pvcTestNodes = [
      { id: 'pvc-default-values', type: 'PVC', data: { label: 'pvc-default-values' } },
      { id: 'pvc-disabled-sc', type: 'PVC', data: { label: 'pvc-disabled-sc', yamlSettings: { storageClass: false } } },
    ];
    const pvcYaml = generateYamlClientSide(pvcTestNodes, []);
    expect(pvcYaml).toContain('ReadWriteOnce');
    expect(pvcYaml).toContain('storage: 1Gi');
    expect(pvcYaml).toContain('storageClassName: standard');
    expect(pvcYaml).not.toContain('storageClassName: false');
  });

  it('generates Ingress YAML with custom pathType (Exact vs Prefix) from ingressPaths', () => {
    const nodes = [
      {
        id: 'ing-exact',
        type: 'Ingress',
        data: {
          label: 'exact-ingress',
          ingressHost: 'auth.example.com',
          ingressPaths: [
            { id: 'p1', path: '/login', pathType: 'Exact', serviceName: 'auth-svc', servicePort: 8080 },
            { id: 'p2', path: '/api', pathType: 'Prefix', serviceName: 'api-svc', servicePort: 3000 },
          ],
        },
      },
    ];
    const yamlOutput = generateYamlClientSide(nodes, []);
    const doc = yaml.load(yamlOutput) as any;
    expect(doc.spec.rules[0].http.paths[0].pathType).toBe('Exact');
    expect(doc.spec.rules[0].http.paths[1].pathType).toBe('Prefix');
  });

  it('generates parseable Kubernetes multi-document YAML without line wrap corruption', () => {
    const nodes = [
      { id: 'dep1', type: 'Deployment', data: { label: 'web-service', image: 'nginx:1.25.3-alpine-slim-with-long-tag' } },
      { id: 'cm1', type: 'ConfigMap', data: { label: 'api-config', configData: [{ key: 'LOG_LEVEL', value: 'debug' }] } },
    ];
    const yamlOutput = generateYamlClientSide(nodes, []);
    const docs = yaml.loadAll(yamlOutput) as any[];

    expect(docs).toHaveLength(2);
    expect(docs[0].kind).toBe('Deployment');
    expect(docs[1].kind).toBe('ConfigMap');
    expect(yamlOutput).toContain('---');
  });

  it('covers uncovered conditions in manifestGenerator (connected target without label, default paths, fallback service port)', () => {
    // 1. Service connected to target workload without label (falls back to name) -> Line 265 branch 1
    const svcTargetNoLabel = {
      id: 'target-no-label',
      type: 'Pod',
      data: {}, // no label
    };
    const svcConnecting = {
      id: 'svc-conn',
      type: 'Service',
      data: {
        label: 'my-service',
        // selector is missing -> determineServiceSelector inspects outgoing edge
      },
    };
    const edgeToTargetNoLabel = {
      id: 'e-to-target',
      source: 'svc-conn',
      target: 'target-no-label',
    };
    const yamlWithTargetNoLabel = generateYamlClientSide([svcConnecting, svcTargetNoLabel], [edgeToTargetNoLabel]);
    expect(yamlWithTargetNoLabel).toContain('app: my-service');
    // Service connected to non-workload/non-ingress node (e.g. ConfigMap)
    const svcConnNonWorkload = {
      id: 'svc-to-cm',
      type: 'Service',
      data: { label: 'svc-to-cm-label' },
    };
    const targetCm = {
      id: 'cm-target',
      type: 'ConfigMap',
      data: { label: 'some-config' },
    };
    const edgeToCm = {
      id: 'e-to-cm',
      source: 'svc-to-cm',
      target: 'cm-target',
    };
    const yamlNonWorkload = generateYamlClientSide([svcConnNonWorkload, targetCm], [edgeToCm]);
    expect(yamlNonWorkload).toContain('app: svc-to-cm-label');

    // 2. Ingress with ingressPaths where rule.path is empty, rule.pathType is empty, rule.serviceName is empty, rule.servicePort is empty
    const ingWithSparseRules = {
      id: 'ing-sparse',
      type: 'Ingress',
      data: {
        label: 'sparse-ingress',
        backendServiceName: 'fallback-svc',
        servicePort: 9090,
        ingressPaths: [
          { id: 'p1', path: '', pathType: '', serviceName: '', servicePort: '' },
        ],
      },
    };
    const sparseYaml = generateYamlClientSide([ingWithSparseRules], []);
    const sparseDoc = yaml.load(sparseYaml) as any;
    expect(sparseDoc.spec.rules[0].http.paths[0].path).toBe('/');
    expect(sparseDoc.spec.rules[0].http.paths[0].pathType).toBe('Prefix');
    expect(sparseDoc.spec.rules[0].http.paths[0].backend.service.name).toBe('fallback-svc');
    expect(sparseDoc.spec.rules[0].http.paths[0].backend.service.port.number).toBe(9090);

    // 3. Ingress with configuredServiceName where servicePort is undefined/0 (falls back to 80) -> Line 403 branch 1
    const ingDefaultPort = {
      id: 'ing-default-port',
      type: 'Ingress',
      data: {
        label: 'default-port-ingress',
        backendServiceName: 'custom-svc',
        servicePort: undefined,
      },
    };
    const defaultPortYaml = generateYamlClientSide([ingDefaultPort], []);
    const defaultPortDoc = yaml.load(defaultPortYaml) as any;
    expect(defaultPortDoc.spec.rules[0].http.paths[0].backend.service.port.number).toBe(80);
  });
  it('enforces restartPolicy: Always on Deployment and StatefulSet even if data specifies OnFailure or Never', () => {
    const nodes = [
      {
        id: 'dep-restart',
        type: 'Deployment',
        data: {
          label: 'Enforced Deployment',
          replicas: 2,
          image: 'nginx:alpine',
          restartPolicy: 'OnFailure',
        },
      },
      {
        id: 'ss-restart',
        type: 'StatefulSet',
        data: {
          label: 'Enforced StatefulSet',
          replicas: 1,
          image: 'redis:alpine',
          restartPolicy: 'Never',
        },
      },
      {
        id: 'pod-restart',
        type: 'Pod',
        data: {
          label: 'Allowed Pod',
          image: 'busybox:latest',
          restartPolicy: 'Never',
        },
      },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).not.toContain('restartPolicy: OnFailure');
    // Standalone Pod preserves restartPolicy: Never
    expect(yamlOutput).toContain('restartPolicy: Never');
    // Deployment template should have restartPolicy: Always
    expect(yamlOutput).toContain('restartPolicy: Always');
  });
  it('generates LoadBalancer Service selector targeting Ingress via label, ID, and edge connection', () => {
    // 1. Selector matches Ingress label
    const nodesLabelMatch = [
      { id: 'lb1', type: 'Service', data: { label: 'my-lb', serviceType: 'LoadBalancer', selector: 'main-ingress' } },
      { id: 'ing1', type: 'Ingress', data: { label: 'main-ingress' } },
    ];
    const yaml1 = generateYamlClientSide(nodesLabelMatch, []);
    expect(yaml1).toContain('app.kubernetes.io/name: ingress-nginx');
    expect(yaml1).toContain('app.kubernetes.io/component: controller');

    // 2. Selector matches Ingress ID
    const nodesIdMatch = [
      { id: 'lb2', type: 'Service', data: { label: 'my-lb2', serviceType: 'LoadBalancer', selector: 'ing-unique-id' } },
      { id: 'ing-unique-id', type: 'Ingress', data: { label: 'some-label' } },
    ];
    const yaml2 = generateYamlClientSide(nodesIdMatch, []);
    expect(yaml2).toContain('app.kubernetes.io/name: ingress-nginx');

    // 3. Outgoing edge to Ingress without selector
    const nodesEdgeMatch = [
      { id: 'lb3', type: 'Service', data: { label: 'my-lb3', serviceType: 'LoadBalancer' } },
      { id: 'ing3', type: 'Ingress', data: { label: 'edge-ingress' } },
    ];
    const edges = [{ id: 'e1', source: 'lb3', target: 'ing3' }];
    const yaml3 = generateYamlClientSide(nodesEdgeMatch, edges);
    expect(yaml3).toContain('app.kubernetes.io/name: ingress-nginx');

    // 4. Outgoing edge to non-ingress (Deployment) when selector is empty
    const nodesDepEdge = [
      { id: 'svc-dep', type: 'Service', data: { label: 'dep-service', serviceType: 'ClusterIP' } },
      { id: 'dep-target', type: 'Deployment', data: { label: 'backend-app' } },
    ];
    const depEdges = [{ id: 'e2', source: 'svc-dep', target: 'dep-target' }];
    const yaml4 = generateYamlClientSide(nodesDepEdge, depEdges);
    expect(yaml4).toContain('app: backend-app');

    // 5. Outgoing edge from LoadBalancer to non-Ingress node (Deployment) without selector
    const nodesLbNonIngressEdge = [
      { id: 'lb-direct', type: 'Service', data: { label: 'lb-direct', serviceType: 'LoadBalancer' } },
      { id: 'target-dep', type: 'Deployment', data: { label: 'target-app' } },
    ];
    const lbDepEdges = [{ id: 'e-lb-dep', source: 'lb-direct', target: 'target-dep' }];
    const yaml5 = generateYamlClientSide(nodesLbNonIngressEdge, lbDepEdges);
    expect(yaml5).toContain('app: target-app');
    expect(yaml5).not.toContain('ingress-nginx');
  });
  it('preserves Kind: Deployment for single-replica deployment and omits replicas for standalone Pod', () => {
    const nodes = [
      { id: 'single-dep', type: 'Deployment', data: { label: 'single-replica-dep', replicas: 1, image: 'app:v1' } },
      { id: 'single-pod', type: 'Pod', data: { label: 'standalone-pod', replicas: 1, image: 'redis:alpine' } },
    ];
    const yamlOutput = generateYamlClientSide(nodes, []);

    // Deployment with replicas: 1 remains a Deployment
    expect(yamlOutput).toContain('kind: Deployment');
    expect(yamlOutput).toContain('name: single-replica-dep');
    expect(yamlOutput).toContain('replicas: 1');

    // Standalone Pod remains a Pod without replicas in spec
    expect(yamlOutput).toContain('kind: Pod');
    expect(yamlOutput).toContain('name: standalone-pod');
    const docs = yaml.loadAll(yamlOutput) as any[];
    const podDoc = docs.find((d) => d?.kind === 'Pod');
    expect(podDoc).toBeDefined();
    expect(podDoc.spec.replicas).toBeUndefined();
  });

  it('supports Kind: ReplicaSet for ReplicaSet node type and workloadType: ReplicaSet', () => {
    const nodes = [
      { id: 'rs1', type: 'ReplicaSet', data: { label: 'custom-rs', replicas: 2, image: 'nginx:1.25' } },
      { id: 'rs2', type: 'ReplicaSet', data: { label: 'single-rs', replicas: 1, workloadType: 'ReplicaSet' } },
    ];
    const yamlOutput = generateYamlClientSide(nodes, []);
    expect(yamlOutput).toContain('kind: ReplicaSet');
    expect(yamlOutput).toContain('name: custom-rs');
    expect(yamlOutput).toContain('replicas: 2');
    expect(yamlOutput).toContain('name: single-rs');
    expect(yamlOutput).toContain('replicas: 1');
  });
  it('auto-enforces Headless Service (clusterIP: None) and resolves serviceName when targeting StatefulSet', () => {
    // 1. Service with ClusterIP connected via edge to StatefulSet -> automatically becomes clusterIP: None
    const nodesEdge = [
      { id: 'ss1', type: 'StatefulSet', data: { label: 'kafka-cluster', replicas: 3 } },
      { id: 'svc1', type: 'Service', data: { label: 'kafka-service', serviceType: 'ClusterIP', port: 9092 } },
    ];
    const edges1 = [{ id: 'e1', source: 'svc1', target: 'ss1' }];
    const yaml1 = generateYamlClientSide(nodesEdge, edges1);
    const docs1 = yaml.loadAll(yaml1) as any[];

    const ssDoc1 = docs1.find((d) => d?.kind === 'StatefulSet');
    const svcDoc1 = docs1.find((d) => d?.kind === 'Service');

    expect(ssDoc1).toBeDefined();
    expect(ssDoc1.spec.serviceName).toBe('kafka-service');
    expect(svcDoc1).toBeDefined();
    expect(svcDoc1.spec.type).toBe('ClusterIP');
    expect(svcDoc1.spec.clusterIP).toBe('None');

    // 2. Service targeting StatefulSet via selector without explicit edge
    const nodesSelector = [
      { id: 'ss2', type: 'StatefulSet', data: { label: 'es-cluster', replicas: 2 } },
      { id: 'svc2', type: 'Service', data: { label: 'es-headless', selector: 'es-cluster', port: 9200 } },
    ];
    const yaml2 = generateYamlClientSide(nodesSelector, []);
    const docs2 = yaml.loadAll(yaml2) as any[];

    const ssDoc2 = docs2.find((d) => d?.kind === 'StatefulSet');
    const svcDoc2 = docs2.find((d) => d?.kind === 'Service');

    expect(ssDoc2.spec.serviceName).toBe('es-headless');
    expect(svcDoc2.spec.clusterIP).toBe('None');

    // 3. Outgoing edge from StatefulSet to Service
    const nodesReverseEdge = [
      { id: 'ss3', type: 'StatefulSet', data: { label: 'cassandra-db', replicas: 3 } },
      { id: 'svc3', type: 'Service', data: { label: 'cassandra-svc', port: 9042 } },
    ];
    const edgesReverse = [{ id: 'e-rev', source: 'ss3', target: 'svc3' }];
    const yaml3 = generateYamlClientSide(nodesReverseEdge, edgesReverse);
    const docs3 = yaml.loadAll(yaml3) as any[];

    const ssDoc3 = docs3.find((d) => d?.kind === 'StatefulSet');
    const svcDoc3 = docs3.find((d) => d?.kind === 'Service');

    expect(ssDoc3.spec.serviceName).toBe('cassandra-svc');
    expect(svcDoc3.spec.clusterIP).toBe('None');

    // 4. Multiple Services targeting StatefulSet -> prefers Headless Service
    const nodesMultiSvc = [
      { id: 'ss4', type: 'StatefulSet', data: { label: 'zk-ensemble', replicas: 3 } },
      { id: 'svc4-lb', type: 'Service', data: { label: 'zk-external', serviceType: 'LoadBalancer' } },
      { id: 'svc4-hl', type: 'Service', data: { label: 'zk-internal-hs', serviceType: 'Headless' } },
    ];
    const edgesMulti = [
      { id: 'e-zk-1', source: 'svc4-lb', target: 'ss4' },
      { id: 'e-zk-2', source: 'svc4-hl', target: 'ss4' },
    ];
    const yaml4 = generateYamlClientSide(nodesMultiSvc, edgesMulti);
    const docs4 = yaml.loadAll(yaml4) as any[];
    const ssDoc4 = docs4.find((d) => d?.kind === 'StatefulSet');
    expect(ssDoc4.spec.serviceName).toBe('zk-internal-hs');

    // 5. Explicit serviceName on StatefulSet and disabled clusterIP in yamlSettings
    const nodesExplicit = [
      { id: 'ss5', type: 'StatefulSet', data: { label: 'custom-ss', serviceName: 'user-defined-svc' } },
      { id: 'svc5', type: 'Service', data: { label: 'user-defined-svc', serviceType: 'Headless', yamlSettings: { clusterIP: false } } },
    ];
    const yaml5 = generateYamlClientSide(nodesExplicit, []);
    const docs5 = yaml.loadAll(yaml5) as any[];
    const ssDoc5 = docs5.find((d) => d?.kind === 'StatefulSet');
    const svcDoc5 = docs5.find((d) => d?.kind === 'Service');
    expect(ssDoc5.spec.serviceName).toBe('user-defined-svc');
    expect(svcDoc5.spec.clusterIP).toBeUndefined();
  });

  it('generates HorizontalPodAutoscaler manifests targeting Deployment, StatefulSet, and ReplicaSet', () => {
    // 1. HPA targeting Deployment
    const nodesDep = [
      {
        id: 'hpa-1',
        type: 'HPA',
        data: {
          label: 'web-hpa',
          minReplicas: 2,
          maxReplicas: 8,
          targetCPU: 60,
          targetMemory: 80,
        },
      },
      {
        id: 'dep-1',
        type: 'Deployment',
        data: { label: 'web-deployment', replicas: 2 },
      },
    ];
    const edgesDep = [{ id: 'e-hpa-dep', source: 'hpa-1', target: 'dep-1' }];
    const yaml1 = generateYamlClientSide(nodesDep, edgesDep);
    const docs1 = yaml.loadAll(yaml1) as any[];

    const hpaDoc1 = docs1.find((d) => d?.kind === 'HorizontalPodAutoscaler');
    expect(hpaDoc1).toBeDefined();
    expect(hpaDoc1.apiVersion).toBe('autoscaling/v2');
    expect(hpaDoc1.metadata.name).toBe('web-hpa');
    expect(hpaDoc1.spec.scaleTargetRef).toEqual({
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      name: 'web-deployment',
    });
    expect(hpaDoc1.spec.minReplicas).toBe(2);
    expect(hpaDoc1.spec.maxReplicas).toBe(8);
    expect(hpaDoc1.spec.metrics).toEqual([
      {
        type: 'Resource',
        resource: {
          name: 'cpu',
          target: { type: 'Utilization', averageUtilization: 60 },
        },
      },
      {
        type: 'Resource',
        resource: {
          name: 'memory',
          target: { type: 'Utilization', averageUtilization: 80 },
        },
      },
    ]);

    // 2. HPA targeting StatefulSet
    const nodesSS = [
      {
        id: 'hpa-ss',
        type: 'HPA',
        data: {
          label: 'db-hpa',
          minReplicas: 3,
          maxReplicas: 6,
          targetCPU: 75,
        },
      },
      {
        id: 'ss-1',
        type: 'StatefulSet',
        data: { label: 'db-cluster', replicas: 3 },
      },
    ];
    const edgesSS = [{ id: 'e-hpa-ss', source: 'hpa-ss', target: 'ss-1' }];
    const yamlSS = generateYamlClientSide(nodesSS, edgesSS);
    const docsSS = yaml.loadAll(yamlSS) as any[];

    const hpaDocSS = docsSS.find((d) => d?.kind === 'HorizontalPodAutoscaler');
    expect(hpaDocSS).toBeDefined();
    expect(hpaDocSS.spec.scaleTargetRef).toEqual({
      apiVersion: 'apps/v1',
      kind: 'StatefulSet',
      name: 'db-cluster',
    });
    expect(hpaDocSS.spec.minReplicas).toBe(3);
    expect(hpaDocSS.spec.maxReplicas).toBe(6);
    expect(hpaDocSS.spec.metrics).toHaveLength(1);
    expect(hpaDocSS.spec.metrics[0].resource.name).toBe('cpu');

    // 3. HPA targeting ReplicaSet with empty label fallback to ID
    const nodesRS = [
      {
        id: 'hpa-rs',
        type: 'HPA',
        data: { label: 'rs-hpa' },
      },
      {
        id: 'rs-target-id',
        type: 'ReplicaSet',
        data: { label: '' },
      },
    ];
    const edgesRS = [{ id: 'e-hpa-rs', source: 'hpa-rs', target: 'rs-target-id' }];
    const yamlRS = generateYamlClientSide(nodesRS, edgesRS);
    const docsRS = yaml.loadAll(yamlRS) as any[];

    const hpaDocRS = docsRS.find((d) => d?.kind === 'HorizontalPodAutoscaler');
    expect(hpaDocRS).toBeDefined();
    expect(hpaDocRS.spec.scaleTargetRef).toEqual({
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
      name: 'rs-target-id',
    });
    expect(hpaDocRS.spec.minReplicas).toBe(1);
    expect(hpaDocRS.spec.maxReplicas).toBe(10);

    // 4. Standalone unattached HPA fallback to Deployment / tbd-deployment
    const nodesStandalone = [
      {
        id: 'hpa-unattached',
        type: 'HPA',
        data: { label: 'unattached-hpa' },
      },
    ];
    const yamlStandalone = generateYamlClientSide(nodesStandalone, []);
    const docsStandalone = yaml.loadAll(yamlStandalone) as any[];

    const hpaDocUnattached = docsStandalone.find((d) => d?.kind === 'HorizontalPodAutoscaler');
    expect(hpaDocUnattached.spec.scaleTargetRef).toEqual({
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      name: 'tbd-deployment',
    });

    // 5. HPA with disabled yamlSettings
    const nodesDisabled = [
      {
        id: 'hpa-disabled',
        type: 'HPA',
        data: {
          label: 'disabled-hpa',
          minReplicas: 5,
          maxReplicas: 20,
          targetCPU: 80,
          targetMemory: 90,
          yamlSettings: {
            replicas: false,
            targetCPU: false,
            targetMemory: false,
          },
        },
      },
    ];
    const yamlDisabled = generateYamlClientSide(nodesDisabled, []);
    const docsDisabled = yaml.loadAll(yamlDisabled) as any[];

    const hpaDocDisabled = docsDisabled.find((d) => d?.kind === 'HorizontalPodAutoscaler');
    expect(hpaDocDisabled.spec.minReplicas).toBe(1);
    expect(hpaDocDisabled.spec.maxReplicas).toBe(10);
    expect(hpaDocDisabled.spec.metrics).toBeUndefined();

    // 6. HPA within a Namespace
    const nodesNs = [
      { id: 'ns-prod', type: 'Namespace', data: { label: 'production' } },
      {
        id: 'hpa-in-ns',
        type: 'HPA',
        parentId: 'ns-prod',
        data: { label: 'prod-hpa' },
      },
    ];
    const yamlNs = generateYamlClientSide(nodesNs, []);
    const docsNs = yaml.loadAll(yamlNs) as any[];

    const hpaDocNs = docsNs.find((d) => d?.kind === 'HorizontalPodAutoscaler');
    expect(hpaDocNs.metadata.namespace).toBe('production');

    // 7. Attached HPA item on StatefulSet card
    const nodesAttachedSS = [
      {
        id: 'ss-with-hpa',
        type: 'StatefulSet',
        data: {
          label: 'redis-cluster',
          replicas: 3,
          hpas: [
            {
              id: 'hpa-item-1',
              name: 'redis-autoscale',
              minReplicas: 3,
              maxReplicas: 9,
              targetCPU: 70,
              targetMemory: 85,
            },
          ],
        },
      },
    ];
    const yamlAttached = generateYamlClientSide(nodesAttachedSS, []);
    const docsAttached = yaml.loadAll(yamlAttached) as any[];

    const ssDoc = docsAttached.find((d) => d?.kind === 'StatefulSet');
    const hpaAttachedDoc = docsAttached.find((d) => d?.kind === 'HorizontalPodAutoscaler');

    expect(ssDoc).toBeDefined();
    expect(hpaAttachedDoc).toBeDefined();
    expect(hpaAttachedDoc.metadata.name).toBe('redis-autoscale');
    expect(hpaAttachedDoc.spec.scaleTargetRef).toEqual({
      apiVersion: 'apps/v1',
      kind: 'StatefulSet',
      name: 'redis-cluster',
    });
    expect(hpaAttachedDoc.spec.minReplicas).toBe(3);
    expect(hpaAttachedDoc.spec.maxReplicas).toBe(9);
    expect(hpaAttachedDoc.spec.metrics).toEqual([
      {
        type: 'Resource',
        resource: {
          name: 'cpu',
          target: { type: 'Utilization', averageUtilization: 70 },
        },
      },
      {
        type: 'Resource',
        resource: {
          name: 'memory',
          target: { type: 'Utilization', averageUtilization: 85 },
        },
      },
    ]);
  });

  it('detects stateful workload for child pod under StatefulSet parent when targeted by Service', () => {
    const nodes = [
      { id: 'ss-parent', type: 'StatefulSet', data: { label: 'Stateful Parent' } },
      { id: 'pod-child', type: 'Pod', parentId: 'ss-parent', data: { label: 'Child Pod' } },
      { id: 'svc-headless', type: 'Service', data: { label: 'Headless Svc', serviceType: 'Headless' } },
    ];
    const edges = [
      { id: 'e1', source: 'svc-headless', target: 'pod-child' },
    ];

    const yamlOutput = generateYamlClientSide(nodes, edges);
    expect(yamlOutput).toContain('clusterIP: None');
  });

  it('sets namespace on attached HPA manifest when workload is nested inside a Namespace', () => {
    const nodes = [
      { id: 'ns1', type: 'Namespace', data: { label: 'production' } },
      {
        id: 'dep1',
        type: 'Deployment',
        parentId: 'ns1',
        data: {
          label: 'api-gateway',
          replicas: 2,
          hpas: [
            {
              id: 'hpa-item-ns',
              name: 'api-hpa',
              minReplicas: 2,
              maxReplicas: 10,
              targetCPU: 75,
            },
          ],
        },
      },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    const docs = yaml.loadAll(yamlOutput) as any[];
    const hpaDoc = docs.find((d) => d?.kind === 'HorizontalPodAutoscaler');

    expect(hpaDoc).toBeDefined();
    expect(hpaDoc.metadata.name).toBe('api-hpa');
    expect(hpaDoc.metadata.namespace).toBe('production');
  });

  it('generates attached ConfigMap and Secret manifests and injects container env references', () => {
    const nodes = [
      {
        id: 'dep1',
        type: 'Deployment',
        data: {
          label: 'app-deploy',
          configMaps: [
            {
              id: 'cm-1',
              name: 'app-config',
              configData: [{ key: 'API_URL', value: 'https://api.example.com' }],
            },
          ],
          secrets: [
            {
              id: 'sec-1',
              name: 'app-secret',
              secretData: [{ key: 'DB_PASS', value: 's3cret' }],
            },
          ],
        },
      },
      {
        id: 'sec-node',
        type: 'Secret',
        data: {
          label: 'connected-secret',
          secretData: [{ key: 'JWT_KEY', value: 'jwt-val' }],
        },
      },
    ];

    const edges = [
      { id: 'e1', source: 'sec-node', target: 'dep1' },
    ];

    const yamlOutput = generateYamlClientSide(nodes, edges);
    const docs = yaml.loadAll(yamlOutput) as any[];

    const depDoc = docs.find((d) => d?.kind === 'Deployment');
    const cmDoc = docs.find((d) => d?.kind === 'ConfigMap' && d?.metadata?.name === 'app-config');
    const attachedSecDoc = docs.find((d) => d?.kind === 'Secret' && d?.metadata?.name === 'app-secret');
    const connectedSecDoc = docs.find((d) => d?.kind === 'Secret' && d?.metadata?.name === 'connected-secret');

    expect(depDoc).toBeDefined();
    expect(cmDoc).toBeDefined();
    expect(cmDoc.data.API_URL).toBe('https://api.example.com');
    expect(attachedSecDoc).toBeDefined();
    expect(attachedSecDoc.stringData.DB_PASS).toBe('s3cret');
    expect(connectedSecDoc).toBeDefined();

    const env = depDoc.spec.template.spec.containers[0].env;
    expect(env).toEqual(
      expect.arrayContaining([
        {
          name: 'API_URL',
          valueFrom: { configMapKeyRef: { name: 'app-config', key: 'API_URL' } },
        },
        {
          name: 'DB_PASS',
          valueFrom: { secretKeyRef: { name: 'app-secret', key: 'DB_PASS' } },
        },
        {
          name: 'JWT_KEY',
          valueFrom: { secretKeyRef: { name: 'connected-secret', key: 'JWT_KEY' } },
        },
      ])
    );
  });

  it('sets namespace on attached ConfigMaps and Secrets when parent workload is inside a Namespace', () => {
    const nodes = [
      {
        id: 'ns-prod',
        type: 'Namespace',
        data: { label: 'prod' },
      },
      {
        id: 'dep-in-ns',
        type: 'Deployment',
        parentId: 'ns-prod',
        data: {
          label: 'web-prod',
          configMaps: [
            {
              id: 'cm-prod-1',
              name: 'prod-config',
              configData: [{ key: 'FEATURE_FLAG', value: 'true' }],
            },
            {
              id: 'cm-prod-empty',
              name: '',
              configData: [{ key: '', value: 'ignored' }, { key: 'FALLBACK_VAL', value: 42 }],
            },
          ],
          secrets: [
            {
              id: 'sec-prod-1',
              name: 'prod-secret',
              secretData: [{ key: 'API_KEY', value: 'secret-key-123' }],
            },
            {
              id: 'sec-prod-fallback',
              name: '',
              configData: [{ key: 'TOKEN', value: 'token-val' }],
            },
          ],
        },
      },
    ];

    const yamlOutput = generateYamlClientSide(nodes, []);
    const docs = yaml.loadAll(yamlOutput) as any[];

    const cmDoc = docs.find((d) => d?.kind === 'ConfigMap' && d?.metadata?.name === 'prod-config');
    expect(cmDoc).toBeDefined();
    expect(cmDoc.metadata.namespace).toBe('prod');
    expect(cmDoc.data.FEATURE_FLAG).toBe('true');

    const fallbackCmDoc = docs.find((d) => d?.kind === 'ConfigMap' && d?.metadata?.name === 'configmap');
    expect(fallbackCmDoc).toBeDefined();
    expect(fallbackCmDoc.metadata.namespace).toBe('prod');
    expect(fallbackCmDoc.data.FALLBACK_VAL).toBe('42');
    expect(fallbackCmDoc.data['']).toBeUndefined();

    const secDoc = docs.find((d) => d?.kind === 'Secret' && d?.metadata?.name === 'prod-secret');
    expect(secDoc).toBeDefined();
    expect(secDoc.metadata.namespace).toBe('prod');
    expect(secDoc.stringData.API_KEY).toBe('secret-key-123');

    const fallbackSecDoc = docs.find((d) => d?.kind === 'Secret' && d?.metadata?.name === 'secret');
    expect(fallbackSecDoc).toBeDefined();
    expect(fallbackSecDoc.metadata.namespace).toBe('prod');
    expect(fallbackSecDoc.stringData.TOKEN).toBe('token-val');
  });
});
