import { K8sResourceType } from '@/types';

/**
 * Record mapping each source Kubernetes resource type to an array of valid target resource types.
 * Defines the macro-level edge connection matrix for canvas diagramming and validation.
 */
export const VALID_CONNECTIONS: Record<K8sResourceType | 'ReplicaSet', (K8sResourceType | 'ReplicaSet')[]> = {
  Internet: ['Service'],
  Ingress: ['Service'],
  Service: ['Deployment', 'Pod', 'ReplicaSet', 'Service', 'Ingress'],
  Deployment: ['Service', 'Ingress', 'PVC', 'ConfigMap', 'Secret'],
  Pod: ['Service', 'Ingress', 'PVC', 'ConfigMap', 'Secret'],
  ReplicaSet: ['Service', 'Ingress', 'PVC', 'ConfigMap', 'Secret'],
  HPA: ['Deployment', 'ReplicaSet'],
  PVC: [],
  ConfigMap: [],
  Secret: [],
  Namespace: [],
  Role: [],
};

/**
 * Validates outgoing edge connection rules originating from an Internet source node.
 * Internet can strictly connect only to LoadBalancer or NodePort Services.
 *
 * @param targetType - The resource type of the connection target.
 * @param targetData - Optional node configuration data for the target node.
 * @returns An English error message if the connection is invalid, or `null` if valid.
 */
const checkInternetRules = (targetType: string, targetData?: Record<string, any>): string | null => {
  if (targetType !== 'Service') return null;
  const tType = targetData?.serviceType || 'ClusterIP';
  return tType === 'LoadBalancer' || tType === 'NodePort'
    ? null
    : `Internet can only connect to LoadBalancer or NodePort Services. Cannot connect to ${tType} Service.`;
};

/**
 * Validates incoming edge connection rules targeting an Ingress resource node.
 * Ingress accepts incoming traffic from LoadBalancer or NodePort Services or Ingress Controller workloads.
 *
 * @param sourceType - The resource type of the connection source.
 * @param sourceData - Optional node configuration data for the source node.
 * @returns An English error message if the incoming connection is invalid, or `null` if valid.
 */
const checkIngressTargetRules = (sourceType: string, sourceData?: Record<string, any>): string | null => {
  if (sourceType === 'Service') {
    const sType = sourceData?.serviceType || 'ClusterIP';
    return sType === 'LoadBalancer' || sType === 'NodePort'
      ? null
      : `${sType} Service cannot be connected to Ingress. Only LoadBalancer or NodePort Services can connect to Ingress.`;
  }
  if (sourceType === 'Pod' || sourceType === 'Deployment' || sourceType === 'ReplicaSet') {
    return null;
  }
  return `${sourceType} cannot be connected to Ingress. Only Services or Workloads can connect to Ingress.`;
};

/**
 * Validates outgoing edge connection rules originating from an Ingress resource node.
 * Ingress can strictly connect only to ClusterIP Services (bypassing direct routing to Pods/Deployments).
 *
 * @param targetType - The resource type of the connection target.
 * @param targetData - Optional node configuration data for the target node.
 * @returns An English error message if the outgoing connection is invalid, or `null` if valid.
 */
const checkIngressSourceRules = (targetType: string, targetData?: Record<string, any>): string | null => {
  if (targetType !== 'Service') {
    return `Ingress cannot be connected directly to ${targetType}. Ingress routes traffic strictly through a ClusterIP Service (via backend.service.name).`;
  }
  const tType = targetData?.serviceType || 'ClusterIP';
  return tType === 'ClusterIP'
    ? null
    : `Ingress can only connect to ClusterIP Service. Cannot connect to ${tType} Service.`;
};

/**
 * Validates incoming edge connection rules targeting a Service resource node.
 * Enforces specific restrictions for LoadBalancer Services.
 *
 * @param sourceType - The resource type of the connection source.
 * @param targetData - Optional node configuration data for the target node.
 * @returns An English error message if the incoming connection is invalid, or `null` if valid.
 */
const checkServiceTargetRules = (sourceType: string, targetData?: Record<string, any>): string | null => {
  const tType = targetData?.serviceType || 'ClusterIP';
  if (tType === 'LoadBalancer' && sourceType !== 'Internet' && sourceType !== 'Service' && sourceType !== 'Pod' && sourceType !== 'Deployment') {
    return `${sourceType} cannot be connected to LoadBalancer Service.`;
  }
  return null;
};

/**
 * Validates target Service types when originating from a LoadBalancer Service.
 *
 * @param targetData - Optional node configuration data for the target node.
 * @returns An English error message if target Service type is invalid, or `null` if valid.
 */
const checkLoadBalancerTargetService = (targetData?: Record<string, any>): string | null => {
  const tType = targetData?.serviceType || 'ClusterIP';
  return tType === 'ClusterIP' || tType === 'NodePort'
    ? null
    : `LoadBalancer Service cannot connect to ${tType} Service.`;
};

/**
 * Validates outgoing edge connection rules originating from a Service resource node.
 * Service nodes route traffic to Pods/Deployments (via spec.selector), Ingress, or downstream Services.
 *
 * @param targetType - The resource type of the connection target.
 * @param sourceData - Optional node configuration data for the source Service node.
 * @param targetData - Optional node configuration data for the target node.
 * @returns An English error message if the outgoing connection is invalid, or `null` if valid.
 */
const checkServiceSourceRules = (
  targetType: string,
  sourceData?: Record<string, any>,
  targetData?: Record<string, any>
): string | null => {
  const sType = sourceData?.serviceType || 'ClusterIP';
  if (targetType === 'Pod' || targetType === 'Deployment' || targetType === 'ReplicaSet') {
    return null;
  }
  if (sType === 'LoadBalancer') {
    if (targetType === 'Ingress') return null;
    if (targetType === 'Service') return checkLoadBalancerTargetService(targetData);
  }
  return null;
};

/**
 * Evaluates whether a proposed edge connection between a source node and a target node is valid.
 * Checks the macro-level matrix in `VALID_CONNECTIONS` as well as fine-grained resource rules for
 * Internet, Ingress, and Service components (ClusterIP, NodePort, LoadBalancer).
 *
 * @param sourceType - The string resource type of the source node (e.g., 'Internet', 'Service', 'Ingress', 'Deployment').
 * @param targetType - The string resource type of the target node (e.g., 'Service', 'Pod', 'PVC').
 * @param sourceData - Optional data object containing configuration properties (e.g. `serviceType`) for the source node.
 * @param targetData - Optional data object containing configuration properties for the target node.
 * @returns `null` if the connection is permitted, or a descriptive English error message string explaining why it is rejected.
 */
type RuleChecker = (
  s: string,
  t: string,
  sData?: Record<string, any>,
  tData?: Record<string, any>
) => string | null;

const SPECIFIC_RULES: RuleChecker[] = [
  (s, t, _, tData) => (s === 'Internet' ? checkInternetRules(t, tData) : null),
  (s, t, sData) => (t === 'Ingress' ? checkIngressTargetRules(s, sData) : null),
  (s, t, _, tData) => (s === 'Ingress' ? checkIngressSourceRules(t, tData) : null),
  (s, t, _, tData) => (t === 'Service' ? checkServiceTargetRules(s, tData) : null),
  (s, t, sData, tData) => (s === 'Service' ? checkServiceSourceRules(t, sData, tData) : null),
];

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

  for (const checkRule of SPECIFIC_RULES) {
    const err = checkRule(sourceType, targetType, sourceData, targetData);
    if (err) return err;
  }

  return null;
};
