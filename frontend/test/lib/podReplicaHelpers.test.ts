import { describe, it, expect } from 'vitest';
import {
  POD_SEPARATED_THRESHOLD,
  POD_MEGA_THRESHOLD,
  getPodReplicaInfo,
} from '@/lib/podReplicaHelpers';

describe('podReplicaHelpers', () => {
  it('exports correct threshold constants', () => {
    expect(POD_SEPARATED_THRESHOLD).toBe(3);
    expect(POD_MEGA_THRESHOLD).toBe(100);
  });

  describe('getPodReplicaInfo', () => {
    it('handles undefined/empty data with safe defaults', () => {
      const info = getPodReplicaInfo();
      expect(info.replicas).toBe(1);
      expect(info.parentReplicas).toBe(0);
      expect(info.totalReplicas).toBe(1);
      expect(info.isStackedPod).toBe(false);
      expect(info.isStackedCard).toBe(false);
      expect(info.isMegaPod).toBe(false);
      expect(info.showDashedProgress).toBe(false);
    });

    it('identifies standalone Pod with replicas <= 3 as separated non-stacked card', () => {
      const info = getPodReplicaInfo({ type: 'Pod', replicas: 3 });
      expect(info.replicas).toBe(3);
      expect(info.parentReplicas).toBe(0);
      expect(info.totalReplicas).toBe(3);
      expect(info.isStackedPod).toBe(false);
      expect(info.isStackedCard).toBe(false);
      expect(info.showDashedProgress).toBe(false);
      expect(info.isMegaPod).toBe(false);
    });

    it('identifies standalone Pod with replicas > 3 as stacked card with progress bar', () => {
      const info = getPodReplicaInfo({ type: 'Pod', replicas: 5 });
      expect(info.replicas).toBe(5);
      expect(info.isStackedPod).toBe(true);
      expect(info.isStackedCard).toBe(true);
      expect(info.showDashedProgress).toBe(true);
      expect(info.isMegaPod).toBe(false);
    });

    it('identifies child Pod in Deployment with parentReplicas <= 3 as separated card', () => {
      const info = getPodReplicaInfo({
        type: 'Pod',
        parentId: 'dep-1',
        parentReplicas: 3,
        replicas: 1,
      });
      expect(info.totalReplicas).toBe(3);
      expect(info.isStackedPod).toBe(false);
      expect(info.isStackedCard).toBe(false);
      expect(info.showDashedProgress).toBe(false);
    });

    it('identifies child Pod in Deployment with parentReplicas > 3 as stacked workload', () => {
      // Chunk card with 10 replicas
      const chunkCard = getPodReplicaInfo({
        type: 'Pod',
        parentId: 'dep-1',
        parentReplicas: 12,
        replicas: 10,
      });
      expect(chunkCard.totalReplicas).toBe(12);
      expect(chunkCard.isStackedPod).toBe(true);
      expect(chunkCard.isStackedCard).toBe(true);
      expect(chunkCard.showDashedProgress).toBe(true);

      // Remainder card with 1 replica in stacked workload
      const remainderCard = getPodReplicaInfo({
        type: 'Pod',
        parentId: 'dep-1',
        parentReplicas: 11,
        replicas: 1,
      });
      expect(remainderCard.isStackedPod).toBe(true);
      expect(remainderCard.isStackedCard).toBe(false); // only 1 replica on this card, so no xN badge
      expect(remainderCard.showDashedProgress).toBe(true);
    });

    it('identifies mega pod when replicas >= 100 or parentReplicas >= 100', () => {
      const megaReplicas = getPodReplicaInfo({
        type: 'Pod',
        parentId: 'dep-1',
        parentReplicas: 150,
        replicas: 100,
      });
      expect(megaReplicas.isMegaPod).toBe(true);

      const megaParentOnly = getPodReplicaInfo({
        type: 'Pod',
        parentId: 'dep-1',
        parentReplicas: 100,
        replicas: 1,
      });
      expect(megaParentOnly.isMegaPod).toBe(true);

      const megaStandalone = getPodReplicaInfo({
        type: 'Pod',
        replicas: 100,
      });
      expect(megaStandalone.isMegaPod).toBe(true);
    });

    it('returns isStackedPod false for non-Pod resource types even with high replicas', () => {
      const info = getPodReplicaInfo({
        type: 'Deployment',
        replicas: 5,
        parentReplicas: 5,
      });
      expect(info.isStackedPod).toBe(false);
      expect(info.isStackedCard).toBe(false);
      expect(info.showDashedProgress).toBe(false);
    });
  });
});
