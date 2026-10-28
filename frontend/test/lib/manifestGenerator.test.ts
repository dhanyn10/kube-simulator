import { describe, it, expect } from 'vitest';
import { generateYamlClientSide } from '@/lib/manifestGenerator';
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

  it('generates Service manifests with custom serviceType and nodePort', () => {
    const nodes = [
      { id: 'svc1', type: 'Service', data: { label: 'NodePort Service', serviceType: 'NodePort', port: '80', targetPort: '8080', nodePort: '30080' } },
      { id: 'svc2', type: 'Service', data: { label: 'LoadBalancer Service', serviceType: 'LoadBalancer', port: '443', targetPort: '8443', nodePort: '30443' } },
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
});