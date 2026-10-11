import { describe, it, expect } from 'vitest';
import { calculateCardLayoutWithYoga, calculateDeploymentLayoutWithYoga, getYogaEngine } from '@/store/deploymentYogaLayout';
import { Node } from '@xyflow/react';

describe('Hybrid Yoga Layout Engine (Card/Node Layer)', () => {
  it('calculates dynamic card dimensions based on content without fixed height hardcoding', async () => {
    const yoga = await getYogaEngine();

    const emptyPodData = { type: 'Pod', label: 'test-pod' };
    const podWithImageAndBadges = {
      type: 'Pod',
      label: 'test-pod-large',
      image: 'nginx:latest-alpine-long-name-for-testing',
      displaySettings: { image: true },
      roles: [{ id: 'role-1', name: 'admin-role' }],
      configMaps: [{ id: 'cm-1', name: 'app-config' }]
    };

    const emptyLayout = calculateCardLayoutWithYoga({ type: 'Pod', data: emptyPodData }, yoga);
    const expandedLayout = calculateCardLayoutWithYoga({ type: 'Pod', data: podWithImageAndBadges }, yoga);

    expect(expandedLayout.height).toBeGreaterThan(emptyLayout.height);
  });

  it('automatically collapses layout and eliminates gaps when internal components are hidden', async () => {
    const yoga = await getYogaEngine();

    const podWithImageShown = {
      type: 'Pod',
      label: 'pod-1',
      image: 'redis:alpine',
      displaySettings: { image: true }
    };

    const podWithImageHidden = {
      type: 'Pod',
      label: 'pod-1',
      image: 'redis:alpine',
      displaySettings: { image: false }
    };

    const layoutShown = calculateCardLayoutWithYoga({ type: 'Pod', data: podWithImageShown }, yoga);
    const layoutHidden = calculateCardLayoutWithYoga({ type: 'Pod', data: podWithImageHidden }, yoga);

    expect(layoutHidden.height).toBeLessThan(layoutShown.height);
  });

  it('pushes footer and adjacent elements consistently when adding attached resources to Pods inside Deployments', async () => {
    const yoga = await getYogaEngine();

    const deploymentNode: Node = {
      id: 'dept-1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { label: 'app-deployment', replicas: 2 }
    };

    const childPodsBase: Node[] = [
      { id: 'pod-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'app-pod-1' } },
      { id: 'pod-2', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'app-pod-2' } }
    ];

    const childPodsWithAttached: Node[] = [
      {
        id: 'pod-1',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: {
          label: 'app-pod-1',
          roles: [{ id: 'r1', name: 'role-1' }],
          configMaps: [{ id: 'c1', name: 'cm-1' }],
          secrets: [{ id: 's1', name: 'sec-1' }]
        }
      },
      { id: 'pod-2', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'app-pod-2' } }
    ];

    const baseLayout = calculateDeploymentLayoutWithYoga(deploymentNode, childPodsBase, yoga);
    const attachedLayout = calculateDeploymentLayoutWithYoga(deploymentNode, childPodsWithAttached, yoga);

    expect(attachedLayout.height).toBeGreaterThan(baseLayout.height);
    expect(attachedLayout.laidOutPods[1].position.y).toBeGreaterThan(baseLayout.laidOutPods[1].position.y);
  });

  it('calculates auto-sizing for non-pod card nodes (Service, Ingress, PVC, ConfigMap, Secret, Role, HPA, ResourceLimit, Internet)', async () => {
    const yoga = await getYogaEngine();

    const serviceNode = { type: 'Service', data: { label: 'my-service' } };
    const ingressNode = { type: 'Ingress', data: { label: 'my-ingress-controller-very-long-label' } };
    const configMapNode = {
      type: 'ConfigMap',
      data: {
        label: 'my-configmap',
        roles: [{ id: 'r1', name: 'role' }]
      }
    };

    const serviceLayout = calculateCardLayoutWithYoga(serviceNode, yoga);
    const ingressLayout = calculateCardLayoutWithYoga(ingressNode, yoga);
    const configMapLayout = calculateCardLayoutWithYoga(configMapNode, yoga);

    expect(serviceLayout.width).toBeGreaterThan(0);
    expect(serviceLayout.height).toBeGreaterThan(0);
    expect(ingressLayout.width).toBeGreaterThan(serviceLayout.width);
    expect(configMapLayout.height).toBeGreaterThan(80);
  });
});
