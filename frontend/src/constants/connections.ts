import { K8sResourceType } from '../types';

export const VALID_CONNECTIONS: Record<K8sResourceType | 'ReplicaSet', (K8sResourceType | 'ReplicaSet')[]> = {
  Internet: ['Ingress', 'Service', 'Deployment', 'Pod', 'ReplicaSet'],
  Ingress: ['Service'],
  Service: ['Deployment', 'Pod', 'ReplicaSet', 'Service'],
  Deployment: ['Service', 'PVC', 'ConfigMap', 'Secret'],
  Pod: ['Service', 'PVC', 'ConfigMap', 'Secret'],
  ReplicaSet: ['Service', 'PVC', 'ConfigMap', 'Secret'],
  HPA: ['Deployment', 'ReplicaSet'],
  PVC: [],
  ConfigMap: [],
  Secret: [],
  Namespace: [],
  Role: [],
};

export const getConnectionError = (sourceType: string, targetType: string): string | null => {
  const validTargets = VALID_CONNECTIONS[sourceType as K8sResourceType];
  if (!validTargets) return `Source type ${sourceType} is not recognized.`;

  if (!validTargets.includes(targetType as K8sResourceType)) {
    return `${sourceType} cannot be connected to ${targetType}.`;
  }

  return null;
};
