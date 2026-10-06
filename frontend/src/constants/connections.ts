import { K8sResourceType } from '@/types';

/**
 * Record mapping each source Kubernetes resource type to an array of valid target resource types.
 * Defines the macro-level edge connection matrix for canvas diagramming and validation.
 */
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

/**
 * Validates outgoing edge connection rules originating from an Internet source node.
 * Internet can strictly connect only to LoadBalancer or NodePort Services.
 *
 * @param targetType - The resource type of the connection target.
 * @param targetData - Optional node configuration data for the target node.
 * @returns An English error message if the connection is invalid, or `null` if valid.
 */
const checkInternetRules = (targetType: string, targetData?: Record<string, any>): string | null => {
  if (targetType === 'Service') {
    const targetServiceType = targetData?.serviceType || 'ClusterIP';
    if (targetServiceType !== 'LoadBalancer' && targetServiceType !== 'NodePort') {
      return `Internet can only connect to LoadBalancer or NodePort Services. Cannot connect to ${targetServiceType} Service.`;
    }
  }
  return null;
};

/**
 * Validates incoming edge connection rules targeting an Ingress resource node.
 * Ingress only accepts incoming traffic from LoadBalancer or NodePort Services.
 *
 * @param sourceType - The resource type of the connection source.
 * @param sourceData - Optional node configuration data for the source node.
 * @returns An English error message if the incoming connection is invalid, or `null` if valid.
 */
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

/**
 * Validates outgoing edge connection rules originating from an Ingress resource node.
 * Ingress can strictly connect only to ClusterIP Services (bypassing direct routing to Pods/Deployments).
 *
 * @param targetType - The resource type of the connection target.
 * @param targetData - Optional node configuration data for the target node.
 * @returns An English error message if the outgoing connection is invalid, or `null` if valid.
 */
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

/**
 * Validates incoming edge connection rules targeting a Service resource node.
 * Specifically enforces that LoadBalancer Services accept incoming connections exclusively from Internet.
 *
 * @param sourceType - The resource type of the connection source.
 * @param targetData - Optional node configuration data for the target node.
 * @returns An English error message if the incoming connection is invalid, or `null` if valid.
 */
const checkServiceTargetRules = (sourceType: string, targetData?: Record<string, any>): string | null => {
  const targetServiceType = targetData?.serviceType || 'ClusterIP';
  if (targetServiceType === 'LoadBalancer' && sourceType !== 'Internet') {
    return `${sourceType} cannot be connected to LoadBalancer Service. Only Internet can connect to LoadBalancer Service.`;
  }
  return null;
};

/**
 * Validates outgoing edge connection rules originating from a Service resource node.
 * Enforces specific restrictions for LoadBalancer Services (allowing connection to Ingress or ClusterIP/NodePort Services).
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
