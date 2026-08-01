import { describe, it, expect } from 'vitest';
import { isPeerPod, getVisibilityUpdates, getAutoNameUpdate, getWorkloadUpdates } from '@/store/slices/node-handlers/configUtils';

describe('configUtils', () => {
  describe('isPeerPod', () => {
    it('returns false if node is not a Pod', () => {
      const node = { id: 'n1', type: 'Service', data: {} };
      const selectedNode = { id: 'n2', type: 'Pod', data: {} };
      expect(isPeerPod(node, selectedNode, 'label')).toBe(false);
    });

    it('returns false if node is the same as selected node', () => {
      const node = { id: 'n1', type: 'Pod', data: {} };
      expect(isPeerPod(node, node, 'label')).toBe(false);
    });

    it('returns true if both pods have the same parent and same label', () => {
      const node = { id: 'n1', type: 'Pod', parentId: 'p1', data: { label: 'pod-a' } };
      const selectedNode = { id: 'n2', type: 'Pod', parentId: 'p1', data: { label: 'pod-a' } };
      expect(isPeerPod(node, selectedNode, 'pod-a')).toBe(true);
    });

    it('returns false if both pods have the same parent but different labels', () => {
      const node = { id: 'n1', type: 'Pod', parentId: 'p1', data: { label: 'pod-a' } };
      const selectedNode = { id: 'n2', type: 'Pod', parentId: 'p1', data: { label: 'pod-b' } };
      expect(isPeerPod(node, selectedNode, 'pod-b')).toBe(false);
    });

    it('returns true if both pods have no parent and same label', () => {
      const node = { id: 'n1', type: 'Pod', data: { label: 'pod-a' } };
      const selectedNode = { id: 'n2', type: 'Pod', data: { label: 'pod-a' } };
      expect(isPeerPod(node, selectedNode, 'pod-a')).toBe(true);
    });

    it('returns false if one has parent and the other does not', () => {
      const node = { id: 'n1', type: 'Pod', parentId: 'p1', data: { label: 'pod-a' } };
      const selectedNode = { id: 'n2', type: 'Pod', data: { label: 'pod-a' } };
      expect(isPeerPod(node, selectedNode, 'pod-a')).toBe(false);
    });
  });

  describe('getVisibilityUpdates', () => {
    it('returns resource defaults when enabling resources visibility', () => {
      const data = {};
      const updates = getVisibilityUpdates('resources', true, data);
      expect(updates).toEqual({
        cpuRequest: '100m',
        cpuLimit: '250m',
        memoryRequest: '128Mi',
        memoryLimit: '256Mi',
      });
    });

    it('does not return resource defaults if already set', () => {
      const data = { cpuLimit: '500m' };
      const updates = getVisibilityUpdates('resources', true, data);
      expect(updates).toEqual({});
    });

    it('returns webserver default when enabling webserver visibility', () => {
      const data = { webserver: 'none' };
      const updates = getVisibilityUpdates('webserver', true, data);
      expect(updates.webserver).toBe('nginx');
    });

    it('returns runtime default when enabling runtime visibility', () => {
      const data = { runtime: 'none' };
      const updates = getVisibilityUpdates('runtime', true, data);
      expect(updates.runtime).toBe('nodejs');
    });

    it('returns empty updates when visibility is turned off', () => {
      expect(getVisibilityUpdates('resources', false, {})).toEqual({});
    });
  });

  describe('getAutoNameUpdate', () => {
    it('returns lowercase slugified label when auto-named and ready', () => {
      const nextData = { status: 'ready', isAutoNamed: true, webserver: 'Nginx Server', runtime: 'Node JS' };
      const update = getAutoNameUpdate(nextData);
      expect(update.label).toBe('nginx-server-node-js');
    });

    it('returns webserver only if runtime is none', () => {
      const nextData = { status: 'ready', isAutoNamed: true, webserver: 'Nginx', runtime: 'none' };
      const update = getAutoNameUpdate(nextData);
      expect(update.label).toBe('nginx');
    });

    it('returns runtime only if webserver is none', () => {
      const nextData = { status: 'ready', isAutoNamed: true, webserver: 'none', runtime: 'Go' };
      const update = getAutoNameUpdate(nextData);
      expect(update.label).toBe('go');
    });

    it('returns undefined image if status is pending', () => {
      const nextData = { status: 'pending' };
      expect(getAutoNameUpdate(nextData)).toEqual({ image: undefined });
    });

    it('returns empty object if not auto-named', () => {
      const nextData = { status: 'ready', isAutoNamed: false };
      expect(getAutoNameUpdate(nextData)).toEqual({});
    });
  });

  describe('getWorkloadUpdates', () => {
    it('syncs metadata and autoname', () => {
      const data = { type: 'Pod', runtime: 'none', webserver: 'none', isAutoNamed: true };
      const updates = { runtime: 'nodejs' };
      const result = getWorkloadUpdates('Pod', data, updates);

      expect(result.runtime).toBe('nodejs');
      expect(result.status).toBe('ready');
      expect(result.label).toBe('nodejs');
    });

    it('deletes replica info for child pods', () => {
        const data = { type: 'Pod', parentId: 'parent-1', replicas: 3 };
        const updates = { label: 'new-label' };
        const result = getWorkloadUpdates('Pod', data, updates);
        expect(result.replicas).toBeUndefined();
        expect(result.parentReplicas).toBeUndefined();
    });
  });
});
