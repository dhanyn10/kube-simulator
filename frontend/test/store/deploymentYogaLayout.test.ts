import { describe, it, expect, beforeAll } from 'vitest';
import { Node } from '@xyflow/react';
import {
  calculateCardLayoutWithYoga,
  calculateDeploymentLayoutWithYoga,
  getYogaEngine,
  getYogaInstanceSync,
  calculateCardContentExtraHeight,
} from '@/store/deploymentYogaLayout';
import type { YogaEngine } from '@/store/deploymentYogaLayout';

describe('deploymentYogaLayout', () => {
  let yoga: YogaEngine;

  beforeAll(async () => {
    yoga = await getYogaEngine();
  });

  it('initializes and returns the cached Yoga engine instance synchronously and asynchronously', async () => {
    const engine = await getYogaEngine();
    expect(engine).toBeDefined();
    expect(getYogaInstanceSync()).toBe(engine);
  });

  it('ensures child Pods are horizontally centered with symmetrical left and right padding inside Deployment', () => {
    const deployment: Node = {
      id: 'dep1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { replicas: 2, label: 'app-deployment' },
    };

    const pod1: Node = {
      id: 'pod1',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: {
        replicas: 1,
        label: 'app-deployment-iprbh-h255s',
        image: 'nginx:latest',
        assignedNode: 'worker-1',
        restartPolicy: 'Always',
      },
    };

    const pod2: Node = {
      id: 'pod2',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: {
        replicas: 1,
        label: 'app-deployment-iprbh-huvly',
        image: 'nginx:latest',
        assignedNode: 'worker-2',
        restartPolicy: 'Always',
      },
    };

    const layout = calculateDeploymentLayoutWithYoga(deployment, [pod1, pod2], yoga);
    const leftGap = layout.laidOutPods[0].position.x;
    const rightGap = layout.width - layout.laidOutPods[0].position.x - (layout.laidOutPods[0].width || 0);

    expect(leftGap).toBe(24);
    expect(rightGap).toBe(24);
    expect(leftGap).toBe(rightGap);

    // Also verify base pod (minimum dimensions) has symmetrical 24px left and right padding
    const basePod: Node = {
      id: 'base-pod',
      type: 'Pod',
      parentId: 'dep-base',
      position: { x: 0, y: 0 },
      data: { replicas: 1 },
    };
    const baseDep: Node = {
      id: 'dep-base',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { replicas: 1 },
    };
    const baseLayout = calculateDeploymentLayoutWithYoga(baseDep, [basePod], yoga);
    const baseLeftGap = baseLayout.laidOutPods[0].position.x;
    const baseRightGap = baseLayout.width - baseLayout.laidOutPods[0].position.x - (baseLayout.laidOutPods[0].width || 0);
    expect(baseLeftGap).toBe(24);
    expect(baseRightGap).toBe(24);
  });

  it('scenario 1: Pod inserted into Deployment -> Deployment height increases', () => {
    const deployment: Node = {
      id: 'dep1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { replicas: 0, label: 'test-dep' },
    };

    const emptyLayout = calculateDeploymentLayoutWithYoga(deployment, [], yoga);
    const baseHeight = emptyLayout.height;

    const pod1: Node = {
      id: 'pod1',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: { replicas: 1, image: 'nginx:latest' },
    };

    const layoutWithPod = calculateDeploymentLayoutWithYoga(deployment, [pod1], yoga);

    expect(layoutWithPod.laidOutPods).toHaveLength(1);
    expect(layoutWithPod.height).toBeGreaterThan(baseHeight);
  });

  it('scenario 2 & 3: Toggle Show Content -> Deployment height expands & elements below shift down; Toggle Hide Content -> Deployment height collapses BACK with zero empty gap', () => {
    const deployment: Node = {
      id: 'dep1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { replicas: 2, label: 'app' },
    };

    const pod1Hidden: Node = {
      id: 'pod1',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: { replicas: 1, image: 'nginx:latest', displaySettings: { image: false } },
    };

    const pod2: Node = {
      id: 'pod2',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: { replicas: 1, image: 'redis:alpine' },
    };

    // 1. Initial layout with Pod 1 image HIDDEN
    const layoutHidden = calculateDeploymentLayoutWithYoga(deployment, [pod1Hidden, pod2], yoga);
    const pod2YInitial = layoutHidden.laidOutPods[1].position.y;
    const initialHeight = layoutHidden.height;

    // 2. Toggle SHOW Content on Pod 1
    const pod1Shown: Node = {
      ...pod1Hidden,
      data: {
        ...pod1Hidden.data,
        displaySettings: { image: true },
      },
    };

    const layoutShown = calculateDeploymentLayoutWithYoga(deployment, [pod1Shown, pod2], yoga);
    const pod2YExpanded = layoutShown.laidOutPods[1].position.y;
    const expandedHeight = layoutShown.height;

    // Verify Show Content expands height and pushes Pod 2 down
    expect(expandedHeight).toBeGreaterThan(initialHeight);
    expect(pod2YExpanded).toBeGreaterThan(pod2YInitial);

    // 3. Toggle HIDE Content back on Pod 1
    const layoutHiddenAgain = calculateDeploymentLayoutWithYoga(deployment, [pod1Hidden, pod2], yoga);
    const pod2YCollapsed = layoutHiddenAgain.laidOutPods[1].position.y;
    const collapsedHeight = layoutHiddenAgain.height;

    // Verify Hide Content shrinks height back to exact initial height with zero remaining gap
    expect(collapsedHeight).toBe(initialHeight);
    expect(pod2YCollapsed).toBe(pod2YInitial);
  });

  it('scenario 4: Pod removed -> Deployment height returns to base size', () => {
    const deployment: Node = {
      id: 'dep1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { replicas: 1, label: 'app' },
    };

    const pod1: Node = {
      id: 'pod1',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: { replicas: 1, image: 'nginx:latest' },
    };

    const layoutWithPod = calculateDeploymentLayoutWithYoga(deployment, [pod1], yoga);
    expect(layoutWithPod.laidOutPods).toHaveLength(1);

    // Remove pod
    const layoutAfterRemove = calculateDeploymentLayoutWithYoga(deployment, [], yoga);
    expect(layoutAfterRemove.laidOutPods).toHaveLength(0);
    expect(layoutAfterRemove.height).toBeLessThan(layoutWithPod.height);
  });

  it('ensures uniform margin bottom spacing between adjacent pods', () => {
    const deployment: Node = {
      id: 'dep1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { replicas: 3, label: 'multi-pod' },
    };

    const pod1: Node = { id: 'p1', type: 'Pod', parentId: 'dep1', position: { x: 0, y: 0 }, data: { replicas: 1 } };
    const pod2: Node = { id: 'p2', type: 'Pod', parentId: 'dep1', position: { x: 0, y: 0 }, data: { replicas: 1 } };
    const pod3: Node = { id: 'p3', type: 'Pod', parentId: 'dep1', position: { x: 0, y: 0 }, data: { replicas: 1 } };

    const result = calculateDeploymentLayoutWithYoga(deployment, [pod1, pod2, pod3], yoga);
    const p1 = result.laidOutPods[0];
    const p2 = result.laidOutPods[1];
    const p3 = result.laidOutPods[2];

    const gap12 = p2.position.y - (p1.position.y + (p1.height || 0));
    const gap23 = p3.position.y - (p2.position.y + (p2.height || 0));

    expect(gap12).toBe(20);
    expect(gap23).toBe(20);
  });

  it('dynamically expands pod height when footer attached components grow without clipping margin to pod below', () => {
    const deployment: Node = {
      id: 'dep1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { replicas: 2, label: 'app' },
    };

    const pod1NoAttached: Node = {
      id: 'pod1',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: { replicas: 1, roles: [] },
    };

    const pod2: Node = {
      id: 'pod2',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: { replicas: 1 },
    };

    const initialLayout = calculateDeploymentLayoutWithYoga(deployment, [pod1NoAttached, pod2], yoga);
    const p1InitialH = initialLayout.laidOutPods[0].height || 0;
    const p2InitialY = initialLayout.laidOutPods[1].position.y;

    // Add multiple attached roles to pod 1 footer
    const pod1WithAttached: Node = {
      ...pod1NoAttached,
      data: {
        ...pod1NoAttached.data,
        roles: [{ id: 'r1', name: 'role-1' }, { id: 'r2', name: 'role-2' }],
      },
    };

    const updatedLayout = calculateDeploymentLayoutWithYoga(deployment, [pod1WithAttached, pod2], yoga);
    const p1ExpandedH = updatedLayout.laidOutPods[0].height || 0;
    const p2ExpandedY = updatedLayout.laidOutPods[1].position.y;

    expect(p1ExpandedH).toBeGreaterThan(p1InitialH);
    expect(p2ExpandedY).toBeGreaterThan(p2InitialY);

    const gapAfterFooterExpansion = p2ExpandedY - (updatedLayout.laidOutPods[0].position.y + p1ExpandedH);
    expect(gapAfterFooterExpansion).toBe(20);
  });

  it('models individual attached item badges (ConfigMap, Secret, Role, HPA, ResourceLimit) as dynamic Yoga child nodes', () => {
    const deployment: Node = {
      id: 'dep1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { replicas: 2, label: 'cm-app' },
    };

    const pod1WithCM: Node = {
      id: 'pod1',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: {
        replicas: 1,
        configMaps: [{ id: 'cm1', name: 'app-config' }, { id: 'cm2', name: 'db-config' }],
        secrets: [{ id: 'sec1', name: 'app-secret' }],
      },
    };

    const pod2: Node = {
      id: 'pod2',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: { replicas: 1 },
    };

    const layout = calculateDeploymentLayoutWithYoga(deployment, [pod1WithCM, pod2], yoga);
    const p1 = layout.laidOutPods[0];
    const p2 = layout.laidOutPods[1];

    expect(p1.style?.height).toBeUndefined(); // Verify rigid style.height is removed
    expect(p1.height).toBeGreaterThan(92);
    expect(p2.position.y - (p1.position.y + (p1.height || 0))).toBe(20);
  });

  it('correctly calculates dynamic pod height and prevents pod overlap when scaling to 2 replicas with parent ConfigMap variables', () => {
    const deploymentWithCM: Node = {
      id: 'dep1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: {
        replicas: 2,
        label: 'web-deploy',
        configMaps: [{ id: 'cm-vars', name: 'app-env', configData: [{ key: 'PORT', value: '8080' }, { key: 'DB_HOST', value: 'postgres' }, { key: 'DB_USER', value: 'admin' }] }],
      },
    };

    // Child pods do not have direct configMaps (inherited from parent deployment)
    const pod1: Node = {
      id: 'pod1',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: { replicas: 1, label: 'web-deploy-pod-1' },
    };

    const pod2: Node = {
      id: 'pod2',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: { replicas: 1, label: 'web-deploy-pod-2' },
    };

    const layout = calculateDeploymentLayoutWithYoga(deploymentWithCM, [pod1, pod2], yoga);
    const p1 = layout.laidOutPods[0];
    const p2 = layout.laidOutPods[1];

    // ConfigMap variables add 12 + 3 * 18 = 66px to base height (92 + 66 = 158px)
    expect(p1.height).toBeGreaterThanOrEqual(158);
    expect(p2.height).toBeGreaterThanOrEqual(158);

    // Pod 2 must be positioned below Pod 1 with 20px gap, NO overlap
    const p1Bottom = p1.position.y + (p1.height || 0);
    expect(p2.position.y).toBe(p1Bottom + 20);

    // Total deployment container height must accommodate both pods plus padding
    const p2Bottom = p2.position.y + (p2.height || 0);
    expect(layout.height).toBeGreaterThanOrEqual(p2Bottom);
  });

  it('handles fallback layout calculation when yoga instance is null', () => {
    const deployment: Node = {
      id: 'dep1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { replicas: 1, label: 'fallback-dep' },
    };

    const pod1: Node = {
      id: 'pod1',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: { replicas: 1, image: 'nginx:latest' },
    };

    const result = calculateDeploymentLayoutWithYoga(deployment, [pod1], null);
    expect(result.laidOutPods).toHaveLength(1);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('prevents pod overlap in fallback layout when yoga instance is null with parent ConfigMap variables', () => {
    const deploymentWithCM: Node = {
      id: 'dep1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: {
        replicas: 2,
        label: 'fallback-cm-dep',
        configMaps: [{ id: 'cm-fallback', name: 'fallback-config', configData: [{ key: 'VAR_A', value: 'alpha' }, { key: 'VAR_B', value: 'beta' }] }],
      },
    };

    const pod1: Node = {
      id: 'pod1',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: { replicas: 1 },
    };

    const pod2: Node = {
      id: 'pod2',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 0, y: 0 },
      data: { replicas: 1 },
    };

    const result = calculateDeploymentLayoutWithYoga(deploymentWithCM, [pod1, pod2], null);
    const p1 = result.laidOutPods[0];
    const p2 = result.laidOutPods[1];

    expect(p1.height).toBeGreaterThan(92);
    expect(p2.height).toBeGreaterThan(92);
    expect(p2.position.y).toBe((p1.position.y + (p1.height || 0)) + 20);
  });

  it('handles ReplicaSet container type and manually resized deployment bounds', () => {
    const rsNode: Node = {
      id: 'rs1',
      type: 'ReplicaSet',
      width: 500,
      height: 400,
      position: { x: 0, y: 0 },
      data: { replicas: 1, isManuallyResized: true },
    };

    const pod1: Node = {
      id: 'pod1',
      type: 'Pod',
      parentId: 'rs1',
      position: { x: 0, y: 0 },
      data: { replicas: 1 },
    };

    const result = calculateDeploymentLayoutWithYoga(rsNode, [pod1], yoga);
    expect(result.width).toBeGreaterThanOrEqual(500);
    expect(result.height).toBeGreaterThanOrEqual(400);
  });

  it('expands Ingress card height when multiple ingressPaths are displayed', () => {
    const singlePathLayout = calculateCardLayoutWithYoga(
      {
        type: 'Ingress',
        data: { label: 'ing-1', ingressPath: '/' },
      },
      yoga
    );

    const multiPathLayout = calculateCardLayoutWithYoga(
      {
        type: 'Ingress',
        data: {
          label: 'ing-1',
          displaySettings: { path: true },
          ingressPaths: [
            { id: 'p1', path: '/api', serviceName: 'api-svc', servicePort: 80 },
            { id: 'p2', path: '/pay', serviceName: 'pay-svc', servicePort: 80 },
            { id: 'p3', path: '/web', serviceName: 'web-svc', servicePort: 80 },
          ],
        },
      },
      yoga
    );

    expect(multiPathLayout.height).toBe(singlePathLayout.height + 32);

    const hiddenPathLayout = calculateCardLayoutWithYoga(
      {
        type: 'Ingress',
        data: {
          label: 'ing-1',
          displaySettings: { path: false },
          ingressPaths: [
            { id: 'p1', path: '/api', serviceName: 'api-svc', servicePort: 80 },
            { id: 'p2', path: '/pay', serviceName: 'pay-svc', servicePort: 80 },
          ],
        },
      },
      yoga
    );
    expect(hiddenPathLayout.height).toBe(singlePathLayout.height);
  });

  it('calculateCardContentExtraHeight covers ResourceLimit with threshold excess and invalid parsing', () => {
    // Standard baseline
    const base = calculateCardContentExtraHeight('ResourceLimit', {
      cpuRequest: '500m',
      cpuLimit: '1000m',
      memoryRequest: '256Mi',
      memoryLimit: '512Mi',
    } as any);
    expect(base).toBe(92);

    // CPU excess
    const cpuExcess = calculateCardContentExtraHeight('ResourceLimit', {
      cpuRequest: '2000m',
      cpuLimit: '1000m',
      memoryRequest: '256Mi',
      memoryLimit: '512Mi',
    } as any);
    expect(cpuExcess).toBe(116);

    // Memory excess
    const memExcess = calculateCardContentExtraHeight('ResourceLimit', {
      cpuRequest: '500m',
      cpuLimit: '1000m',
      memoryRequest: '1024Mi',
      memoryLimit: '512Mi',
    } as any);
    expect(memExcess).toBe(116);

    // Parsing exception fallback
    const invalidFallback = calculateCardContentExtraHeight('ResourceLimit', {
      cpuRequest: 'invalid-cpu',
    } as any);
    expect(invalidFallback).toBe(92);
  });

  it('calculateCardContentExtraHeight covers HPA displaySettings toggles', () => {
    const allShown = calculateCardContentExtraHeight('HPA', {
      displaySettings: { replicas: true, targetMemory: true, targetCPU: true },
    } as any);
    expect(allShown).toBe(38 + 34 + 80);

    const allHidden = calculateCardContentExtraHeight('HPA', {
      displaySettings: { replicas: false, targetMemory: false, targetCPU: false },
    } as any);
    expect(allHidden).toBe(0);
  });

  it('calculateCardContentExtraHeight covers Role rules overflow and hiding', () => {
    const overflowRules = calculateCardContentExtraHeight('Role', {
      rules: [{ id: '1' }, { id: '2' }, { id: '3' }],
    } as any);
    expect(overflowRules).toBe(24 + 2 * 38 + 18);

    const singleRule = calculateCardContentExtraHeight('Role', {
      rules: [{ id: '1' }],
    } as any);
    expect(singleRule).toBe(24 + 1 * 38);

    const emptyRules = calculateCardContentExtraHeight('Role', {
      rules: [],
    } as any);
    expect(emptyRules).toBe(0);

    const hiddenRules = calculateCardContentExtraHeight('Role', {
      rules: [{ id: '1' }],
      displaySettings: { rules: false },
    } as any);
    expect(hiddenRules).toBe(0);
  });

  it('calculateCardContentExtraHeight covers ConfigMap and Secret with item overflow and fallback', () => {
    // ConfigMap overflow (> 3)
    const cmOverflow = calculateCardContentExtraHeight('ConfigMap', {
      configData: [{ key: 'k1' }, { key: 'k2' }, { key: 'k3' }, { key: 'k4' }],
    } as any);
    expect(cmOverflow).toBe(24 + 3 * 18 + 18);

    // ConfigMap hidden
    const cmHidden = calculateCardContentExtraHeight('ConfigMap', {
      configData: [{ key: 'k1' }],
      displaySettings: { data: false },
    } as any);
    expect(cmHidden).toBe(0);

    // Secret with secretData overflow
    const secOverflow = calculateCardContentExtraHeight('Secret', {
      secretData: [{ key: 's1' }, { key: 's2' }, { key: 's3' }, { key: 's4' }],
    } as any);
    expect(secOverflow).toBe(24 + 3 * 18 + 18);

    // Secret fallback to configData
    const secFallback = calculateCardContentExtraHeight('Secret', {
      configData: [{ key: 'c1' }, { key: 'c2' }],
    } as any);
    expect(secFallback).toBe(24 + 2 * 18);

    // Secret hidden
    const secHidden = calculateCardContentExtraHeight('Secret', {
      secretData: [{ key: 's1' }],
      displaySettings: { data: false },
    } as any);
    expect(secHidden).toBe(0);
  });

  it('calculateCardContentExtraHeight covers PVC storageClass and Service types', () => {
    // PVC with storageClass
    const pvcWithSc = calculateCardContentExtraHeight('PVC', {
      storageClass: 'standard',
    } as any);
    expect(pvcWithSc).toBe(58 + 28);

    // PVC without storageClass
    const pvcWithoutSc = calculateCardContentExtraHeight('PVC', {} as any);
    expect(pvcWithoutSc).toBe(58);

    // PVC storageClass hidden
    const pvcHiddenSc = calculateCardContentExtraHeight('PVC', {
      storageClass: 'standard',
      displaySettings: { storageClass: false },
    } as any);
    expect(pvcHiddenSc).toBe(58);

    // Service NodePort
    const svcNodePort = calculateCardContentExtraHeight('Service', {
      serviceType: 'NodePort',
      nodePort: 30080,
    } as any);
    expect(svcNodePort).toBe(18 + 18 + 18 + 18 + 40);

    // Service LoadBalancer
    const svcLoadBalancer = calculateCardContentExtraHeight('Service', {
      serviceType: 'LoadBalancer',
      nodePort: 30080,
    } as any);
    expect(svcLoadBalancer).toBe(18 + 18 + 18 + 18 + 40);

    // Service ClusterIP
    const svcClusterIp = calculateCardContentExtraHeight('Service', {
      serviceType: 'ClusterIP',
    } as any);
    expect(svcClusterIp).toBe(18 + 18 + 18 + 40);

    // Service all hidden
    const svcAllHidden = calculateCardContentExtraHeight('Service', {
      serviceType: 'ClusterIP',
      displaySettings: { serviceType: false, port: false, targetPort: false, selector: false },
    } as any);
    expect(svcAllHidden).toBe(0);

    // Unknown node type
    expect(calculateCardContentExtraHeight('UnknownType', {} as any)).toBe(0);
  });

  it('calculateCardLayoutWithYoga supports Pod node and attached badges subtrees', () => {
    const podLayout = calculateCardLayoutWithYoga(
      {
        type: 'Pod',
        data: { replicas: 1, label: 'pod-card' },
      },
      yoga
    );
    expect(podLayout.width).toBeGreaterThan(0);
    expect(podLayout.height).toBeGreaterThan(0);

    const manualCardWithYoga = calculateCardLayoutWithYoga(
      {
        type: 'Service',
        width: 300,
        height: 220,
        data: { label: 'svc-manual', isManuallyResized: true },
      },
      yoga
    );
    expect(manualCardWithYoga.width).toBe(300);
    expect(manualCardWithYoga.height).toBe(220);

    const attachedCard = calculateCardLayoutWithYoga(
      {
        type: 'Service',
        data: {
          label: 'service-attached',
          roles: [{ id: 'r1', name: 'role-1' }],
          configMaps: [{ id: 'cm1', name: 'cm-1' }],
          secrets: [{ id: 'sec1', name: 'sec-1' }],
          resourceLimits: [{ id: 'rl1', name: 'rl-1' }],
          hpas: [{ id: 'hpa1', name: 'hpa-1' }],
        },
      },
      yoga
    );
    expect(attachedCard.height).toBeGreaterThan(100);
  });

  it('calculateCardLayoutWithYoga falls back gracefully when yoga engine is null', () => {
    const normalFallback = calculateCardLayoutWithYoga(
      {
        type: 'Service',
        data: { label: 'svc-fallback' },
      },
      null
    );
    expect(normalFallback.width).toBeGreaterThan(0);
    expect(normalFallback.height).toBeGreaterThan(0);

    const manualFallback = calculateCardLayoutWithYoga(
      {
        type: 'Service',
        width: 320,
        height: 240,
        data: { label: 'svc-manual', isManuallyResized: true },
      },
      null
    );
    expect(manualFallback.width).toBe(320);
    expect(manualFallback.height).toBe(240);
  });

  it('calculateDeploymentLayoutWithYoga handles fallback calculation when yoga engine is null', () => {
    const dep: Node = {
      id: 'dep-fb',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { replicas: 2, label: 'dep-fb' },
    };

    const pod1: Node = {
      id: 'pod-fb-1',
      type: 'Pod',
      parentId: 'dep-fb',
      position: { x: 0, y: 0 },
      data: { replicas: 1, label: 'p1', isManuallyResized: true },
      width: 140,
      measured: { width: 140, height: 80 },
    };

    const megaPod: Node = {
      id: 'pod-fb-2',
      type: 'Pod',
      parentId: 'dep-fb',
      position: { x: 0, y: 0 },
      data: { replicas: 5, label: 'p2' },
    };

    const result = calculateDeploymentLayoutWithYoga(dep, [pod1, megaPod], null);
    expect(result.laidOutPods).toHaveLength(2);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);

    // Empty pods fallback
    const emptyResult = calculateDeploymentLayoutWithYoga(dep, [], null);
    expect(emptyResult.laidOutPods).toHaveLength(0);
  });

  it('calculateDeploymentLayoutWithYoga handles ReplicaSet type and attached badges with Yoga', () => {
    const rs: Node = {
      id: 'rs-attached',
      type: 'ReplicaSet',
      position: { x: 0, y: 0 },
      data: {
        replicas: 1,
        roles: ['r1'],
        secrets: ['s1'],
        configMaps: ['c1'],
        hpas: ['h1'],
        resourceLimits: ['rl1'],
      },
    };

    const podWithAttachments: Node = {
      id: 'pod-attached',
      type: 'Pod',
      parentId: 'rs-attached',
      position: { x: 0, y: 0 },
      data: {
        replicas: 1,
        roles: [{ id: 'r1' }],
        configMaps: [{ id: 'c1' }],
        secrets: [{ id: 's1' }],
      },
    };

    const layout = calculateDeploymentLayoutWithYoga(rs, [podWithAttachments], yoga);
    expect(layout.laidOutPods).toHaveLength(1);
    expect(layout.height).toBeGreaterThan(150);
  });
});
