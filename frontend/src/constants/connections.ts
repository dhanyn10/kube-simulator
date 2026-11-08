import { K8sResourceType } from '@/types';

/**
 * Record mapping each source Kubernetes resource type to an array of valid target resource types.
 * Defines the macro-level edge connection matrix for canvas diagramming and validation.
 */
export const VALID_CONNECTIONS: Record<K8sResourceType | 'ReplicaSet', (K8sResourceType | 'ReplicaSet')[]> = {
  Internet: ['Service'],
  Ingress: ['Service'],
  Service: ['Deployment', 'StatefulSet', 'Pod', 'ReplicaSet', 'Service', 'Ingress'],
  Deployment: ['Service', 'PVC', 'ConfigMap', 'Secret'],
  StatefulSet: ['Service', 'PVC', 'ConfigMap', 'Secret'],
  Pod: ['Service', 'PVC', 'ConfigMap', 'Secret'],
  ReplicaSet: ['Service', 'PVC', 'ConfigMap', 'Secret'],
  HPA: ['Deployment', 'StatefulSet', 'ReplicaSet'],
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
  if (targetType === 'Ingress') {
    return 'Internet cannot connect directly to Ingress. Traffic must enter through an Ingress Controller exposed via a LoadBalancer or NodePort Service.';
  }
  if (targetType !== 'Service') return null;
  const targetServiceType = targetData?.serviceType || 'ClusterIP';
  return targetServiceType === 'LoadBalancer' || targetServiceType === 'NodePort'
    ? null
    : `Internet can only connect to LoadBalancer Services or NodePort Services. Cannot connect to ${targetServiceType} Service.`;
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
    const sourceServiceType = sourceData?.serviceType || 'ClusterIP';
    return sourceServiceType === 'LoadBalancer' || sourceServiceType === 'NodePort'
      ? null
      : `${sourceServiceType} Service cannot be connected to Ingress. Only LoadBalancer or NodePort Services can connect to Ingress.`;
  }
  if (sourceType === 'Pod' || sourceType === 'Deployment' || sourceType === 'StatefulSet' || sourceType === 'ReplicaSet') {
    return 'Workloads cannot connect to Ingress. Ingress routes traffic to Workloads through a ClusterIP Service.';
  }
  return `${sourceType} cannot be connected to Ingress. Only LoadBalancer or NodePort Services can connect to Ingress.`;
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
  const targetServiceType = targetData?.serviceType || 'ClusterIP';
  return targetServiceType === 'ClusterIP'
    ? null
    : `Ingress can only connect to ClusterIP Service. Cannot connect to ${targetServiceType} Service.`;
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
  const targetServiceType = targetData?.serviceType || 'ClusterIP';
  if (targetServiceType === 'LoadBalancer' && sourceType !== 'Internet' && sourceType !== 'Service' && sourceType !== 'Pod' && sourceType !== 'Deployment' && sourceType !== 'StatefulSet') {
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
  const targetServiceType = targetData?.serviceType || 'ClusterIP';
  return targetServiceType === 'ClusterIP' || targetServiceType === 'NodePort'
    ? null
    : `LoadBalancer Service cannot connect to ${targetServiceType} Service.`;
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
  const sourceServiceType = sourceData?.serviceType || 'ClusterIP';
  if (targetType === 'Pod' || targetType === 'Deployment' || targetType === 'StatefulSet' || targetType === 'ReplicaSet') {
    return null;
  }
  if (sourceServiceType === 'LoadBalancer' || sourceServiceType === 'NodePort') {
    if (targetType === 'Ingress') return null;
    if (targetType === 'Service') return checkLoadBalancerTargetService(targetData);
  }
  if (targetType === 'Ingress') {
    return `${sourceServiceType} Service cannot be connected to Ingress. Only LoadBalancer or NodePort Services can connect to Ingress.`;
  }
  return null;
};

type RuleChecker = (
  sourceType: string,
  targetType: string,
  sourceData?: Record<string, any>,
  targetData?: Record<string, any>
) => string | null;

const SPECIFIC_RULES: RuleChecker[] = [
  (sourceType, targetType, _sourceData, targetData) => (sourceType === 'Internet' ? checkInternetRules(targetType, targetData) : null),
  (sourceType, targetType, sourceData) => (targetType === 'Ingress' ? checkIngressTargetRules(sourceType, sourceData) : null),
  (sourceType, targetType, _sourceData, targetData) => (sourceType === 'Ingress' ? checkIngressSourceRules(targetType, targetData) : null),
  (sourceType, targetType, _sourceData, targetData) => (targetType === 'Service' ? checkServiceTargetRules(sourceType, targetData) : null),
  (sourceType, targetType, sourceData, targetData) => (sourceType === 'Service' ? checkServiceSourceRules(targetType, sourceData, targetData) : null),
];

const WORKLOAD_TYPES = new Set(['Pod', 'Deployment', 'StatefulSet', 'ReplicaSet']);
const CONFIG_TYPES = new Set(['ConfigMap', 'Secret', 'PVC']);

const isWorkload = (resourceType: string): boolean => WORKLOAD_TYPES.has(resourceType);
const isConfigResource = (resourceType: string): boolean => CONFIG_TYPES.has(resourceType);

const checkServiceWorkloadNamespace = (
  sourceType: string,
  targetType: string,
  sourceData?: Record<string, any>,
  targetData?: Record<string, any>,
  sourceNs?: string,
  targetNs?: string
): string | null => {
  const isSvcWorkload = (sourceType === 'Service' && isWorkload(targetType)) || (isWorkload(sourceType) && targetType === 'Service');
  if (!isSvcWorkload) return null;
  const serviceType = (sourceType === 'Service' ? sourceData : targetData)?.serviceType || 'ClusterIP';
  if (serviceType === 'LoadBalancer') return null;
  return `Cross-namespace connection is not allowed: Service in namespace "${sourceNs}" cannot connect to workload in namespace "${targetNs}".`;
};

const checkIngressServiceNamespace = (
  sourceType: string,
  targetType: string,
  sourceNs?: string,
  targetNs?: string
): string | null => {
  if (sourceType === 'Ingress' && targetType === 'Service') {
    return `Cross-namespace backend is not allowed: Ingress in namespace "${sourceNs}" cannot route to Service in namespace "${targetNs}".`;
  }
  return null;
};

const checkWorkloadConfigNamespace = (
  sourceType: string,
  targetType: string,
  sourceNs?: string,
  targetNs?: string
): string | null => {
  const isMatch = (isWorkload(sourceType) && isConfigResource(targetType)) || (isConfigResource(sourceType) && isWorkload(targetType));
  if (isMatch) {
    return `Cross-namespace resource binding is not allowed: ${sourceType} in namespace "${sourceNs}" cannot bind to ${targetType} in namespace "${targetNs}".`;
  }
  return null;
};

const checkHpaWorkloadNamespace = (
  sourceType: string,
  targetType: string,
  sourceNs?: string,
  targetNs?: string
): string | null => {
  const isMatch = (sourceType === 'HPA' && isWorkload(targetType)) || (isWorkload(sourceType) && targetType === 'HPA');
  if (isMatch) {
    return `Cross-namespace scaling is not allowed: HPA in namespace "${sourceNs}" cannot scale workload in namespace "${targetNs}".`;
  }
  return null;
};

type NamespaceRuleChecker = (
  sourceType: string,
  targetType: string,
  sourceData?: Record<string, any>,
  targetData?: Record<string, any>,
  sourceNs?: string,
  targetNs?: string
) => string | null;

const NAMESPACE_RULES: NamespaceRuleChecker[] = [
  checkServiceWorkloadNamespace,
  (sourceType, targetType, _sourceData, _targetData, sourceNs, targetNs) => checkIngressServiceNamespace(sourceType, targetType, sourceNs, targetNs),
  (sourceType, targetType, _sourceData, _targetData, sourceNs, targetNs) => checkWorkloadConfigNamespace(sourceType, targetType, sourceNs, targetNs),
  (sourceType, targetType, _sourceData, _targetData, sourceNs, targetNs) => checkHpaWorkloadNamespace(sourceType, targetType, sourceNs, targetNs),
];

export const checkNamespaceIsolation = (
  sourceType: string,
  targetType: string,
  sourceData?: Record<string, any>,
  targetData?: Record<string, any>,
  sourceNs?: string,
  targetNs?: string
): string | null => {
  if (!sourceNs || !targetNs || sourceNs === targetNs) {
    return null;
  }
  for (const checker of NAMESPACE_RULES) {
    const err = checker(sourceType, targetType, sourceData, targetData, sourceNs, targetNs);
    if (err) return err;
  }
  return null;
};

/**
 * Evaluates whether a proposed edge connection between a source node and a target node is valid.
 * Checks the macro-level matrix in `VALID_CONNECTIONS` as well as fine-grained resource rules for
 * Internet, Ingress, and Service components (ClusterIP, NodePort, LoadBalancer), as well as namespace scoping.
 *
 * @param sourceType - The string resource type of the source node (e.g., 'Internet', 'Service', 'Ingress', 'Deployment').
 * @param targetType - The string resource type of the target node (e.g., 'Service', 'Pod', 'PVC').
 * @param sourceData - Optional data object containing configuration properties (e.g. `serviceType`) for the source node.
 * @param targetData - Optional data object containing configuration properties for the target node.
 * @param sourceNamespace - Optional Kubernetes namespace of the source node.
 * @param targetNamespace - Optional Kubernetes namespace of the target node.
 * @returns `null` if the connection is permitted, or a descriptive English error message string explaining why it is rejected.
 */
export const getConnectionError = (
  sourceType: string,
  targetType: string,
  sourceData?: Record<string, any>,
  targetData?: Record<string, any>,
  sourceNamespace?: string,
  targetNamespace?: string
): string | null => {
  const validTargets = VALID_CONNECTIONS[sourceType as K8sResourceType];
  if (!validTargets) return `Source type ${sourceType} is not recognized.`;

  for (const checkRule of SPECIFIC_RULES) {
    const err = checkRule(sourceType, targetType, sourceData, targetData);
    if (err) return err;
  }

  if (!validTargets.includes(targetType as K8sResourceType)) {
    return `${sourceType} cannot be connected to ${targetType}.`;
  }

  const nsError = checkNamespaceIsolation(
    sourceType,
    targetType,
    sourceData,
    targetData,
    sourceNamespace,
    targetNamespace
  );
  if (nsError) return nsError;

  return null;
};

export const isStatefulSetResource = (
  type?: string,
  data?: Record<string, any>
): boolean => {
  return type === 'StatefulSet' || data?.workloadType === 'StatefulSet';
};

/**
 * Validates whether connecting a PVC node to a workload violates volumeClaimTemplate topology rules.
 * A PVC node absorbed as a StatefulSet volumeClaimTemplate cannot be shared with standalone workloads
 * (Deployment, ReplicaSet, Pod) or another StatefulSet.
 */
export const checkPvcTemplateTopologyConflict = (
  pvcNode: { id: string; type?: string; data?: Record<string, any> },
  workloadNode: { id: string; type?: string; data?: Record<string, any> },
  existingConnectedWorkloads: Array<{ id: string; type?: string; data?: Record<string, any> }>
): string | null => {
  const pvcLabel = pvcNode.data?.label || pvcNode.id;
  const isTargetStatefulSet = isStatefulSetResource(workloadNode.type, workloadNode.data);

  for (const existing of existingConnectedWorkloads) {
    if (existing.id === workloadNode.id) continue;
    const isExistingStatefulSet = isStatefulSetResource(existing.type, existing.data);
    const existingLabel = existing.data?.label || existing.id;
    const currentLabel = workloadNode.data?.label || workloadNode.id;

    if (isTargetStatefulSet) {
      return `Volume Claim Template Conflict: PVC "${pvcLabel}" cannot be connected to StatefulSet "${currentLabel}" while already connected to "${existingLabel}".`;
    }
    if (isExistingStatefulSet) {
      return `Volume Claim Template Conflict: PVC "${pvcLabel}" is claimed as a StatefulSet volumeClaimTemplate by "${existingLabel}" and cannot be connected to "${currentLabel}".`;
    }
  }

  return null;
};

const resolveServiceGuidance = (data?: Record<string, any>): string => {
  const serviceType = data?.serviceType || 'ClusterIP';
  if (serviceType === 'LoadBalancer') {
    return 'Ingress Controller, ClusterIP Service, or Workload';
  }
  if (serviceType === 'NodePort') {
    return 'Ingress Controller or Workload (Deployment/StatefulSet/Pod)';
  }
  if (serviceType === 'Headless') {
    return 'Workload endpoints (Deployment, StatefulSet, or Pod)';
  }
  return 'Workload (Deployment, StatefulSet, Pod, or ReplicaSet)';
};

/**
 * Returns human-readable guidance on the valid next architectural edge connection targets
 * for a given Kubernetes resource card.
 */
export const getNodeConnectionGuidance = (
  resourceType: string,
  data?: Record<string, any>
): string => {
  switch (resourceType) {
    case 'Internet':
      return 'LoadBalancer or NodePort Service (traffic entrypoint)';
    case 'Ingress':
      return 'ClusterIP Service (L7 routing backend)';
    case 'Service':
      return resolveServiceGuidance(data);
    case 'Deployment':
    case 'StatefulSet':
    case 'Pod':
    case 'ReplicaSet':
      return 'Storage (PVC), Configuration (ConfigMap, Secret), or backend Service';
    case 'HPA':
      return 'Workload with CPU/Memory Resource Limits (Deployment or StatefulSet)';
    case 'ResourceLimit':
      return 'Workload (Deployment, StatefulSet, or Pod)';
    case 'ConfigMap':
    case 'Secret':
    case 'PVC':
      return 'Workload (via volume mounts or environment variables)';
    default:
      return 'Compatible Kubernetes resource';
  }
};


