import { K8sResourceType } from '@/types';

export const VALID_CONNECTIONS: Record<K8sResourceType | 'ReplicaSet', (K8sResourceType | 'ReplicaSet')[]> = {
  Internet: ['Service'],
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

const checkInternetRules = (targetType: string, targetData?: Record<string, any>): string | null => {
  if (targetType === 'Service') {
    const targetServiceType = targetData?.serviceType || 'ClusterIP';
    if (targetServiceType !== 'LoadBalancer' && targetServiceType !== 'NodePort') {
      return `Internet can only connect to LoadBalancer or NodePort Services. Cannot connect to ${targetServiceType} Service.`;
    }
  }
  return null;
};

const checkIngressTargetRules = (sourceType: string, sourceData?: Record<string, any>): string | null => {
  if (sourceType !== 'Service') {
    return `${sourceType} cannot be connected to Ingress. Only LoadBalancer or NodePort Services can connect to Ingress.`;
  }
  const sourceServiceType = sourceData?.serviceType || 'ClusterIP';
  if (sourceServiceType !== 'LoadBalancer' && sourceServiceType !== 'NodePort') {
    return `${sourceServiceType} Service cannot be connected to Ingress. Only LoadBalancer or NodePort Services can connect to Ingress.`;
  }
  return null;
};

const checkIngressSourceRules = (targetType: string, targetData?: Record<string, any>): string | null => {
  if (targetType === 'Service') {
    const targetServiceType = targetData?.serviceType || 'ClusterIP';
    if (targetServiceType !== 'ClusterIP') {
      return `Ingress can only connect to ClusterIP Service. Cannot connect to ${targetServiceType} Service.`;
    }
    return null;
  }
  return `Ingress cannot be connected directly to ${targetType}. Direct routing without a Service is prohibited.`;
};

const checkServiceTargetRules = (sourceType: string, targetData?: Record<string, any>): string | null => {
  const targetServiceType = targetData?.serviceType || 'ClusterIP';
  if (targetServiceType === 'LoadBalancer' && sourceType !== 'Internet') {
    return `${sourceType} cannot be connected to LoadBalancer Service. Only Internet can connect to LoadBalancer Service.`;
  }
  return null;
};

const checkServiceSourceRules = (
  targetType: string,
  sourceData?: Record<string, any>,
  targetData?: Record<string, any>
): string | null => {
  const sourceServiceType = sourceData?.serviceType || 'ClusterIP';
  if (sourceServiceType !== 'LoadBalancer') return null;

  if (targetType === 'Ingress') return null;

  if (targetType === 'Service') {
    const targetServiceType = targetData?.serviceType || 'ClusterIP';
    if (targetServiceType === 'ClusterIP' || targetServiceType === 'NodePort') {
      return null;
    }
    return `LoadBalancer Service cannot connect to ${targetServiceType} Service.`;
  }

  return `Service type "LoadBalancer" is not allowed to connect to ${targetType}.`;
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

  if (sourceType === 'Internet') {
    const err = checkInternetRules(targetType, targetData);
    if (err) return err;
  }

  if (targetType === 'Ingress') {
    const err = checkIngressTargetRules(sourceType, sourceData);
    if (err) return err;
  }

  if (sourceType === 'Ingress') {
    const err = checkIngressSourceRules(targetType, targetData);
    if (err) return err;
  }

  if (targetType === 'Service') {
    const err = checkServiceTargetRules(sourceType, targetData);
    if (err) return err;
  }

  if (sourceType === 'Service') {
    const err = checkServiceSourceRules(targetType, sourceData, targetData);
    if (err) return err;
  }

  return null;
};
