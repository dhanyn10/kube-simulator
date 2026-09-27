export const getPodSpacing = (_isMegaPod?: boolean) => 20;

export const getReplicaThresholds = (totalReplicas: number) => {
  const targetPodReplicas: number[] = [];
  if (totalReplicas <= 3) {
    for (let i = 0; i < totalReplicas; i++) targetPodReplicas.push(1);
  } else if (totalReplicas < 100) {
    let remaining = totalReplicas;
    while (remaining > 0) {
      const count = Math.min(remaining, 10);
      targetPodReplicas.push(count);
      remaining -= count;
    }
  } else {
    let remaining = totalReplicas;
    while (remaining > 0) {
      const count = Math.min(remaining, 100);
      targetPodReplicas.push(count);
      remaining -= count;
    }
  }
  return targetPodReplicas;
};
