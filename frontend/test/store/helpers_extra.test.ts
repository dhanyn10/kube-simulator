import { describe, it, expect, } from 'vitest';
import {
  syncPodsInDeployment,
  resolveGlobalCollisions
} from '../../src/store/helpers';

describe('store helpers extra coverage', () => {
    it('syncPodsInDeployment should handle dataTemplate for displaySettings', () => {
        const deployment = { id: 'd1', type: 'Deployment', data: { replicas: 1, label: 'app' } } as any;
        const dataTemplate = { data: { displaySettings: { some: 'setting' }, image: 'templ-img' } } as any;
        const pods = syncPodsInDeployment(deployment, [], dataTemplate);

        expect(pods[0].data.displaySettings).toEqual({ some: 'setting' });
        expect(pods[0].data.image).toBe('templ-img');
    });

    it('syncPodsInDeployment should fallback to deployment displaySettings if template and pods are missing', () => {
        const deployment = {
            id: 'd1',
            type: 'Deployment',
            data: {
                replicas: 1,
                label: 'app',
                displaySettings: { dep: 'setting' }
            }
        } as any;
        const pods = syncPodsInDeployment(deployment, []);
        expect(pods[0].data.displaySettings).toEqual({ dep: 'setting' });
    });

    it('resolveGlobalCollisions should skip Deployment and ReplicaSet parents', () => {
        const nodes = [
            { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as any,
            { id: 'p1', parentId: 'dep1', position: { x: 10, y: 10 }, width: 100, height: 100, data: {} } as any,
            { id: 'p2', parentId: 'dep1', position: { x: 20, y: 20 }, width: 100, height: 100, data: {} } as any,
        ];
        // Collision detection should skip siblings under Deployment
        const resolved = resolveGlobalCollisions(nodes);
        expect(resolved.find(n => n.id === 'p1')?.position.x).toBe(10);
        expect(resolved.find(n => n.id === 'p2')?.position.x).toBe(20);
    });

    it('resolveGlobalCollisions should handle manual resizing in getEffectiveSize for Pods', () => {
        const pods = [
            { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { replicas: 1, isManuallyResized: true }, width: 500, height: 500 } as any,
            { id: 'p2', type: 'Pod', position: { x: 10, y: 10 }, data: { replicas: 1 }, width: 100, height: 100 } as any,
        ];
        const resolved = resolveGlobalCollisions(pods);
        // p1 size should be 500 based on manual resize
        // Should trigger collision and move nodes
        expect(resolved[0].position.x).not.toBe(0);
    });
});
