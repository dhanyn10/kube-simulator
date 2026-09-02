import { K8sResourceType } from '../types';

export const VALID_CONNECTIONS: Record<K8sResourceType | 'ReplicaSet', (K8sResourceType | 'ReplicaSet')[]> = {
  Internet: ['Ingress', 'Service', 'Deployment', 'Pod', 'ReplicaSet'],
  Ingress: ['Service'],
  Service: ['Deployment', 'Pod', 'ReplicaSet', 'Service', 'Role'],
  Deployment: ['Service', 'PVC', 'ConfigMap', 'Secret', 'Role'],
  Pod: ['Service', 'PVC', 'ConfigMap', 'Secret', 'Role'],
  ReplicaSet: ['Service', 'PVC', 'ConfigMap', 'Secret', 'Role'],
  HPA: ['Deployment', 'ReplicaSet'],
  PVC: ['Role'],
  ConfigMap: ['Role'],
  Secret: ['Role'],
  Namespace: [],
  Role: ['Deployment', 'Pod', 'Service', 'ReplicaSet', 'PVC', 'ConfigMap', 'Secret'],
};

export const getConnectionError = (sourceType: string, targetType: string): string | null => {
  const validTargets = VALID_CONNECTIONS[sourceType as K8sResourceType];
  if (!validTargets) return `Source type ${sourceType} is not recognized.`;

  if (!validTargets.includes(targetType as K8sResourceType)) {
    return `${sourceType} cannot be connected to ${targetType}.`;
  }

  return null;
};
