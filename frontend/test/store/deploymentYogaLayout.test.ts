import { describe, it, expect } from 'vitest';
import { Node } from '@xyflow/react';
import {
  calculateDeploymentLayoutWithYoga,
  calculatePodBaseHeight,
  calculatePodContentHeight,
} from '@/store/deploymentYogaLayout';

describe('Deployment Yoga Layout Calculations', () => {
  const createDeployment = (id = 'dep-1', width = 320, height = 160): Node => ({
    id,
    type: 'Deployment',
    position: { x: 100, y: 100 },
    width,
    height,
    data: {
      label: 'nginx-deployment',
      replicas: 1,
      displaySettings: { image: true },
    },
  });

  const createPod = (id = 'pod-1', parentId = 'dep-1', image?: string): Node => ({
    id,
    type: 'Pod',
    parentId,
    position: { x: 0, y: 0 },
    width: 200,
    height: 92,
    data: {
      label: id,
      replicas: 1,
      parentReplicas: 1,
      image,
      displaySettings: { image: Boolean(image) },
    },
  });

  it('Scenario 1: Pods added to Deployment -> Deployment height increases', () => {
    const deployment = createDeployment();
    const emptyLayout = calculateDeploymentLayoutWithYoga(deployment, []);
    const baseHeightWithNoPods = emptyLayout.height;

    const pod1 = createPod('pod-1');
    const pod2 = createPod('pod-2');
    const layoutWithPods = calculateDeploymentLayoutWithYoga(deployment, [pod1, pod2]);

    expect(layoutWithPods.laidOutPods).toHaveLength(2);
    expect(layoutWithPods.height).toBeGreaterThan(baseHeightWithNoPods);
    expect(layoutWithPods.laidOutPods[0].position.y).toBe(48); // Top padding
    expect(layoutWithPods.laidOutPods[1].position.y).toBeGreaterThan(layoutWithPods.laidOutPods[0].position.y);
  });

  it('Scenario 2: Toggle Show Content -> Deployment height increases & elements below shift down', () => {
    const deployment = createDeployment();
    const pod1NoImage = createPod('pod-1', 'dep-1');
    const pod2NoImage = createPod('pod-2', 'dep-1');

    const layoutBeforeShow = calculateDeploymentLayoutWithYoga(deployment, [pod1NoImage, pod2NoImage]);
    const pod2TopBefore = layoutBeforeShow.laidOutPods[1].position.y;
    const deploymentHeightBefore = layoutBeforeShow.height;

    // Show Content (add image to Pod 1)
    const pod1WithImage = createPod('pod-1', 'dep-1', 'nginx:latest');
    const layoutAfterShow = calculateDeploymentLayoutWithYoga(deployment, [pod1WithImage, pod2NoImage]);

    expect(layoutAfterShow.height).toBeGreaterThan(deploymentHeightBefore);
    expect(layoutAfterShow.laidOutPods[1].position.y).toBeGreaterThan(pod2TopBefore);
  });

  it('Scenario 3: Toggle Hide Content -> Deployment height collapses BACK and leaves NO gap', () => {
    const deployment = createDeployment();

    // 1. Initial layout without image content
    const pod1Hidden = createPod('pod-1', 'dep-1');
    const pod2 = createPod('pod-2', 'dep-1');
    const initialLayout = calculateDeploymentLayoutWithYoga(deployment, [pod1Hidden, pod2]);

    // 2. Show Content
    const pod1Shown = createPod('pod-1', 'dep-1', 'docker.io/library/redis:alpine');
    const shownLayout = calculateDeploymentLayoutWithYoga(deployment, [pod1Shown, pod2]);

    // 3. Hide Content
    const pod1Collapsed = {
      ...pod1Shown,
      data: {
        ...pod1Shown.data,
        displaySettings: { ...pod1Shown.data.displaySettings, image: false },
      },
    };
    const collapsedLayout = calculateDeploymentLayoutWithYoga(deployment, [pod1Collapsed, pod2]);

    // Verify heights collapse back exactly to initial values without gaps
    expect(collapsedLayout.height).toBe(initialLayout.height);
    expect(collapsedLayout.laidOutPods[0].height).toBe(initialLayout.laidOutPods[0].height);
    expect(collapsedLayout.laidOutPods[1].position.y).toBe(initialLayout.laidOutPods[1].position.y);
    expect(collapsedLayout.height).toBeLessThan(shownLayout.height);
  });

  it('Scenario 4: Pod removed -> Deployment height returns to base size', () => {
    const deployment = createDeployment();
    const emptyLayoutBefore = calculateDeploymentLayoutWithYoga(deployment, []);

    const pod1 = createPod('pod-1', 'dep-1', 'nginx:1.25');
    const pod2 = createPod('pod-2', 'dep-1', 'redis:latest');
    const layoutWithPods = calculateDeploymentLayoutWithYoga(deployment, [pod1, pod2]);
    expect(layoutWithPods.height).toBeGreaterThan(emptyLayoutBefore.height);

    // Remove Pods
    const layoutAfterRemoval = calculateDeploymentLayoutWithYoga(deployment, []);
    expect(layoutAfterRemoval.height).toBe(emptyLayoutBefore.height);
    expect(layoutAfterRemoval.laidOutPods).toHaveLength(0);
  });

  it('calculates pod base height and content height correctly', () => {
    const podData = {
      displaySettings: { image: true },
      image: 'bitnami/postgresql:16.1.0-debian-11-r10',
    };
    const baseHeight = calculatePodBaseHeight(podData, false);
    const contentHeight = calculatePodContentHeight(podData, 200);

    expect(baseHeight).toBe(92);
    expect(contentHeight).toBeGreaterThan(0);

    const hiddenContentHeight = calculatePodContentHeight(
      { displaySettings: { image: false }, image: 'test:latest' },
      200
    );
    expect(hiddenContentHeight).toBe(0);
  });

  it('handles fallback layout gracefully if Yoga instance is null', () => {
    const deployment = createDeployment();
    const pod1 = createPod('pod-1', 'dep-1', 'nginx:latest');
    const fallbackLayout = calculateDeploymentLayoutWithYoga(deployment, [pod1], null);

    expect(fallbackLayout.laidOutPods).toHaveLength(1);
    expect(fallbackLayout.width).toBeGreaterThanOrEqual(200);
    expect(fallbackLayout.height).toBeGreaterThan(0);
  });
});
