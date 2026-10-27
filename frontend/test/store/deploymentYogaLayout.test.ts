import { describe, it, expect, beforeAll } from 'vitest';
import { Node } from '@xyflow/react';
import {
  calculateDeploymentLayoutWithYoga,
  getYogaEngine,
  getYogaInstanceSync
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
});
