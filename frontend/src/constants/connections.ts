import { K8sResourceType } from '@/types';

export const VALID_CONNECTIONS: Record<K8sResourceType | 'ReplicaSet', (K8sResourceType | 'ReplicaSet')[]> = {
  Internet: ['Ingress', 'Service'],
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

export const getConnectionError = (
  sourceType: string,
  targetType: string,
  sourceData?: Record<string, any>,
  targetData?: Record<string, any>
): string | null => {
  const validTargets = VALID_CONNECTIONS[sourceType as K8sResourceType];
  if (!validTargets) return `Source type ${sourceType} is not recognized.`;

  if (!validTargets.includes(targetType as K8sResourceType)) {
    return `${sourceType} cannot be connected to ${targetType}.`;
  }

  const isWorkloadTarget = ['Deployment', 'Pod', 'ReplicaSet'].includes(targetType);
  if (isWorkloadTarget && sourceType === 'Service') {
    const serviceType = sourceData?.serviceType || 'ClusterIP';
    if (serviceType !== 'ClusterIP' && serviceType !== 'NodePort') {
      return `Service type "${serviceType}" is not allowed to connect to ${targetType}. Only ClusterIP or NodePort Services are permitted.`;
    }
  }

  return null;
};
