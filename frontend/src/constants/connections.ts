import { K8sResourceType } from '@/types';

export const VALID_CONNECTIONS: Record<K8sResourceType | 'ReplicaSet', (K8sResourceType | 'ReplicaSet')[]> = {
  Internet: ['Ingress', 'Service'],
  Ingress: ['Service'],
  Service: ['Deployment', 'Pod', 'ReplicaSet', 'Service', 'Ingress'],
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

  // Incoming edge rule for LoadBalancer Service: only Internet allowed as source
  if (targetType === 'Service') {
    const targetServiceType = targetData?.serviceType || 'ClusterIP';
    if (targetServiceType === 'LoadBalancer' && sourceType !== 'Internet') {
      return `${sourceType} cannot be connected to LoadBalancer Service. Only Internet can connect to LoadBalancer Service.`;
    }
  }

  // Outgoing edge rules for Service
  if (sourceType === 'Service') {
    const sourceServiceType = sourceData?.serviceType || 'ClusterIP';

    if (sourceServiceType === 'LoadBalancer') {
      if (targetType === 'Ingress') {
        return null;
      }
      if (targetType === 'Service') {
        const targetServiceType = targetData?.serviceType || 'ClusterIP';
        if (targetServiceType === 'ClusterIP' || targetServiceType === 'NodePort') {
          return null;
        }
        return `LoadBalancer Service cannot connect to ${targetServiceType} Service.`;
      }
      return `Service type "LoadBalancer" is not allowed to connect to ${targetType}.`;
    } else {
      // ClusterIP or NodePort Services cannot connect to Ingress
      if (targetType === 'Ingress') {
        return `${sourceServiceType} Service cannot be connected to Ingress.`;
      }
    }
  }

  return null;
};
