import { POD_SEPARATED_THRESHOLD, POD_MEGA_THRESHOLD } from '@/lib/podReplicaHelpers';

export const getPodSpacing = (_isMegaPod?: boolean) => 20;

export const getReplicaThresholds = (totalReplicas: number) => {
  const targetPodReplicas: number[] = [];
  if (totalReplicas <= POD_SEPARATED_THRESHOLD) {
    for (let i = 0; i < totalReplicas; i++) targetPodReplicas.push(1);
  } else if (totalReplicas < POD_MEGA_THRESHOLD) {
    let remaining = totalReplicas;
    while (remaining > 0) {
      const count = Math.min(remaining, 10);
      targetPodReplicas.push(count);
      remaining -= count;
    }
  } else {
    let remaining = totalReplicas;
    while (remaining > 0) {
      const count = Math.min(remaining, POD_MEGA_THRESHOLD);
      targetPodReplicas.push(count);
      remaining -= count;
    }
  }
  return targetPodReplicas;
};
