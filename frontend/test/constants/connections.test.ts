import { describe, it, expect } from 'vitest';
import {
  getConnectionError,
  VALID_CONNECTIONS,
  isStatefulSetResource,
  checkPvcTemplateTopologyConflict,
  checkNamespaceIsolation,
} from '@/constants/connections';

describe('connections constants', () => {
  it('should return null for valid connections', () => {
    expect(getConnectionError('Internet', 'Service', {}, { serviceType: 'LoadBalancer' })).toBeNull();
    expect(getConnectionError('Internet', 'Service', {}, { serviceType: 'NodePort' })).toBeNull();
    expect(getConnectionError('Ingress', 'Service', {}, { serviceType: 'ClusterIP' })).toBeNull();
    expect(getConnectionError('Service', 'Pod')).toBeNull();
    expect(getConnectionError('Service', 'Pod', { serviceType: 'ClusterIP' })).toBeNull();
    expect(getConnectionError('Service', 'Pod', { serviceType: 'NodePort' })).toBeNull();
    expect(getConnectionError('Service', 'Pod', { serviceType: 'LoadBalancer' })).toBeNull();
    expect(getConnectionError('Service', 'Deployment', { serviceType: 'LoadBalancer' })).toBeNull();
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'LoadBalancer' })).toBeNull();
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'NodePort' })).toBeNull();
    expect(getConnectionError('Deployment', 'PVC')).toBeNull();
    expect(getConnectionError('StatefulSet', 'PVC')).toBeNull();
    expect(getConnectionError('Pod', 'Service')).toBeNull();
  });

  it('should return error message for invalid connections', () => {
    const error = getConnectionError('Internet', 'Namespace');
    expect(error).toBe('Internet cannot be connected to Namespace.');
  });

  it('should validate Internet connections to Ingress and workloads', () => {
    expect(getConnectionError('Internet', 'Ingress')).toBe(
      'Internet cannot connect directly to Ingress. Traffic must enter through an Ingress Controller exposed via a LoadBalancer or NodePort Service.'
    );
    expect(getConnectionError('Internet', 'Service', {}, { serviceType: 'ClusterIP' })).toBe(
      'Internet can only connect to LoadBalancer Services or NodePort Services. Cannot connect to ClusterIP Service.'
    );
    expect(getConnectionError('Internet', 'Pod')).toBe('Internet cannot be connected to Pod.');
    expect(getConnectionError('Internet', 'Deployment')).toBe('Internet cannot be connected to Deployment.');
    expect(getConnectionError('Internet', 'ReplicaSet')).toBe('Internet cannot be connected to ReplicaSet.');
  });

  it('should return null for valid Ingress incoming and outgoing connections', () => {
    // Service: LoadBalancer -> Ingress
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'LoadBalancer' })).toBeNull();
    // Service: NodePort -> Ingress
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'NodePort' })).toBeNull();
    // Ingress -> Service: ClusterIP
    expect(getConnectionError('Ingress', 'Service', {}, { serviceType: 'ClusterIP' })).toBeNull();
  });

  it('should return error for invalid incoming connections to Ingress', () => {
    // Internet -> Ingress
    expect(getConnectionError('Internet', 'Ingress')).toBe(
      'Internet cannot connect directly to Ingress. Traffic must enter through an Ingress Controller exposed via a LoadBalancer or NodePort Service.'
    );

    // ClusterIP Service -> Ingress
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'ClusterIP' })).toBe(
      'ClusterIP Service cannot be connected to Ingress. Only LoadBalancer or NodePort Services can connect to Ingress.'
    );

    // Workloads -> Ingress (forbidden in K8s standard routing)
    expect(getConnectionError('Pod', 'Ingress')).toBe(
      'Workloads cannot connect to Ingress. Ingress routes traffic to Workloads through a ClusterIP Service.'
    );
    expect(getConnectionError('Deployment', 'Ingress')).toBe(
      'Workloads cannot connect to Ingress. Ingress routes traffic to Workloads through a ClusterIP Service.'
    );
    expect(getConnectionError('StatefulSet', 'Ingress')).toBe(
      'Workloads cannot connect to Ingress. Ingress routes traffic to Workloads through a ClusterIP Service.'
    );
    expect(getConnectionError('ReplicaSet', 'Ingress')).toBe(
      'Workloads cannot connect to Ingress. Ingress routes traffic to Workloads through a ClusterIP Service.'
    );

    // PVC -> Ingress
    expect(getConnectionError('PVC', 'Ingress')).toBe(
      'PVC cannot be connected to Ingress. Only LoadBalancer or NodePort Services can connect to Ingress.'
    );
  });

  it('should return error for invalid outgoing connections from Ingress', () => {
    // Ingress -> Service: NodePort / LoadBalancer
    expect(getConnectionError('Ingress', 'Service', {}, { serviceType: 'NodePort' })).toBe(
      'Ingress can only connect to ClusterIP Service. Cannot connect to NodePort Service.'
    );
    expect(getConnectionError('Ingress', 'Service', {}, { serviceType: 'LoadBalancer' })).toBe(
      'Ingress can only connect to ClusterIP Service. Cannot connect to LoadBalancer Service.'
    );

    // Ingress -> Pod / Deployment
    expect(getConnectionError('Ingress', 'Pod')).toBe(
      'Ingress cannot be connected directly to Pod. Ingress routes traffic strictly through a ClusterIP Service (via backend.service.name).'
    );
    expect(getConnectionError('Ingress', 'Deployment')).toBe(
      'Ingress cannot be connected directly to Deployment. Ingress routes traffic strictly through a ClusterIP Service (via backend.service.name).'
    );
  });

  it('should return error when connecting Pod, Deployment, or ReplicaSet directly to another Pod or Deployment', () => {
    expect(getConnectionError('Pod', 'Pod')).toBe('Pod cannot be connected to Pod.');
    expect(getConnectionError('Pod', 'Deployment')).toBe('Pod cannot be connected to Deployment.');
    expect(getConnectionError('Deployment', 'Deployment')).toBe('Deployment cannot be connected to Deployment.');
    expect(getConnectionError('Deployment', 'Pod')).toBe('Deployment cannot be connected to Pod.');
  });

  it('should return null for valid LoadBalancer incoming and outgoing connections', () => {
    // Internet -> Service: LoadBalancer
    expect(getConnectionError('Internet', 'Service', {}, { serviceType: 'LoadBalancer' })).toBeNull();

    // Service: LoadBalancer -> Ingress
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'LoadBalancer' })).toBeNull();

    // Service: LoadBalancer -> Pod / Deployment (via spec.selector)
    expect(getConnectionError('Service', 'Pod', { serviceType: 'LoadBalancer' })).toBeNull();
    expect(getConnectionError('Service', 'Deployment', { serviceType: 'LoadBalancer' })).toBeNull();

    // Service: LoadBalancer -> Service: ClusterIP / NodePort
    expect(
      getConnectionError('Service', 'Service', { serviceType: 'LoadBalancer' }, { serviceType: 'ClusterIP' })
    ).toBeNull();
    expect(
      getConnectionError('Service', 'Service', { serviceType: 'LoadBalancer' }, { serviceType: 'NodePort' })
    ).toBeNull();
  });

  it('should return error for invalid incoming connections to LoadBalancer Service', () => {
    // ReplicaSet -> Service: LoadBalancer is forbidden (only Pod/Deployment/Internet/Service allowed)
    expect(getConnectionError('ReplicaSet', 'Service', {}, { serviceType: 'LoadBalancer' })).toBe(
      'ReplicaSet cannot be connected to LoadBalancer Service.'
    );

    // PVC / ConfigMap / Secret -> Service: LoadBalancer is forbidden
    expect(getConnectionError('PVC', 'Service', {}, { serviceType: 'LoadBalancer' })).toBe(
      'PVC cannot be connected to LoadBalancer Service.'
    );
    expect(getConnectionError('ConfigMap', 'Service', {}, { serviceType: 'LoadBalancer' })).toBe(
      'ConfigMap cannot be connected to LoadBalancer Service.'
    );
  });

  it('should return error when LoadBalancer Service connects to another LoadBalancer Service', () => {
    expect(
      getConnectionError('Service', 'Service', { serviceType: 'LoadBalancer' }, { serviceType: 'LoadBalancer' })
    ).toBe('LoadBalancer Service cannot connect to LoadBalancer Service.');
  });

  it('should return error for unrecognized source type', () => {
    const error = getConnectionError('Unknown', 'Pod');
    expect(error).toBe('Source type Unknown is not recognized.');
  });

  it('should return null when Ingress connects to Service with default ClusterIP targetData', () => {
    expect(getConnectionError('Ingress', 'Service')).toBeNull();
  });

  it('should evaluate checkIngressTargetRules fallback for non-workload source', () => {
    // Temporarily add Ingress to VALID_CONNECTIONS for Secret
    const originalSecret = VALID_CONNECTIONS.Secret;
    (VALID_CONNECTIONS as any).Secret = ['Ingress'];

    const err = getConnectionError('Secret', 'Ingress');
    expect(err).toBe('Secret cannot be connected to Ingress. Only LoadBalancer or NodePort Services can connect to Ingress.');

    // Cleanup
    (VALID_CONNECTIONS as any).Secret = originalSecret;
  });

  it('should evaluate checkIngressSourceRules fallback for non-Service target', () => {
    // Temporarily add Pod to VALID_CONNECTIONS for Ingress
    (VALID_CONNECTIONS as any).Ingress = ['Service', 'Pod'];

    const err = getConnectionError('Ingress', 'Pod');
    expect(err).toBe('Ingress cannot be connected directly to Pod. Ingress routes traffic strictly through a ClusterIP Service (via backend.service.name).');

    // Cleanup
    (VALID_CONNECTIONS as any).Ingress = ['Service'];
  });

  it('covers checkServiceSourceRules when NodePort Service connects to Ingress or Service without LoadBalancer type', () => {
    // Temporarily allow Service -> Service
    (VALID_CONNECTIONS as any).Service = ['Deployment', 'Pod', 'ReplicaSet', 'Service', 'Ingress'];

    // NodePort Service connecting to Ingress
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'NodePort' }, {})).toBeNull();

    // ClusterIP Service connecting to Service returns null
    expect(getConnectionError('Service', 'Service', { serviceType: 'ClusterIP' }, { serviceType: 'ClusterIP' })).toBeNull();
  });

  it('covers checkInternetRules when targetType is not Service, checkIngressTargetRules when sourceType is LoadBalancer/NodePort or Workload, checkIngressSourceRules when targetType is ClusterIP Service, and checkServiceTargetRules when tType is not LoadBalancer', () => {
    // 1. checkInternetRules when targetType !== 'Service' (safely temporarily modify and restore VALID_CONNECTIONS.Internet)
    const originalInternet = VALID_CONNECTIONS.Internet;
    (VALID_CONNECTIONS as any).Internet = ['Service', 'Pod'];
    expect(getConnectionError('Internet', 'Pod')).toBeNull();
    (VALID_CONNECTIONS as any).Internet = originalInternet;

    // 2. checkIngressTargetRules when sourceType is Service with LoadBalancer or NodePort
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'LoadBalancer' })).toBeNull();
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'NodePort' })).toBeNull();
    expect(getConnectionError('ReplicaSet', 'Ingress')).toBe(
      'Workloads cannot connect to Ingress. Ingress routes traffic to Workloads through a ClusterIP Service.'
    );

    // 3. checkIngressSourceRules when targetType is Service with targetData.serviceType as ClusterIP
    expect(getConnectionError('Ingress', 'Service', {}, { serviceType: 'ClusterIP' })).toBeNull();

    // 4. checkServiceTargetRules when targetData.serviceType !== 'LoadBalancer' (e.g. ClusterIP or NodePort)
    expect(getConnectionError('Pod', 'Service', {}, { serviceType: 'ClusterIP' })).toBeNull();
    expect(getConnectionError('Pod', 'Service', {}, { serviceType: 'NodePort' })).toBeNull();
  });

  it('covers fallback default serviceType ClusterIP across rules and else branch when LoadBalancer targets non-Ingress non-Service', () => {
    // 1. checkInternetRules fallback targetData?.serviceType || 'ClusterIP'
    expect(getConnectionError('Internet', 'Service')).toBe(
      'Internet can only connect to LoadBalancer Services or NodePort Services. Cannot connect to ClusterIP Service.'
    );
    expect(getConnectionError('Internet', 'Service', {}, {})).toBe(
      'Internet can only connect to LoadBalancer Services or NodePort Services. Cannot connect to ClusterIP Service.'
    );

    // 2. checkIngressTargetRules fallback sourceData?.serviceType || 'ClusterIP'
    expect(getConnectionError('Service', 'Ingress')).toBe(
      'ClusterIP Service cannot be connected to Ingress. Only LoadBalancer or NodePort Services can connect to Ingress.'
    );
    expect(getConnectionError('Service', 'Ingress', {})).toBe(
      'ClusterIP Service cannot be connected to Ingress. Only LoadBalancer or NodePort Services can connect to Ingress.'
    );

    // 3. checkLoadBalancerTargetService fallback targetData?.serviceType || 'ClusterIP'
    expect(
      getConnectionError('Service', 'Service', { serviceType: 'LoadBalancer' })
    ).toBeNull();
    expect(
      getConnectionError('Service', 'Service', { serviceType: 'LoadBalancer' }, {})
    ).toBeNull();

    // 4. checkServiceSourceRules false branch when targetType is neither Ingress nor Service for LoadBalancer
    const originalService = VALID_CONNECTIONS.Service;
    (VALID_CONNECTIONS as any).Service = [...originalService, 'PVC'];
    expect(
      getConnectionError('Service', 'PVC', { serviceType: 'LoadBalancer' })
    ).toBeNull();
    (VALID_CONNECTIONS as any).Service = originalService;
  });

  it('enforces Kubernetes namespace isolation rules across resource types', () => {
    // 1. Service <-> Workload in different namespaces (ClusterIP, NodePort, Headless)
    expect(
      getConnectionError('Service', 'Pod', { serviceType: 'ClusterIP' }, {}, 'staging', 'production')
    ).toContain('Cross-namespace connection is not allowed: Service in namespace "staging" cannot connect to workload in namespace "production".');

    expect(
      getConnectionError('Service', 'Deployment', { serviceType: 'NodePort' }, {}, 'ns-a', 'ns-b')
    ).toContain('Cross-namespace connection is not allowed');

    expect(
      getConnectionError('Pod', 'Service', {}, { serviceType: 'ClusterIP' }, 'staging', 'production')
    ).toContain('Cross-namespace connection is not allowed');

    // Service <-> Workload in the same namespace is allowed
    expect(
      getConnectionError('Service', 'Pod', { serviceType: 'ClusterIP' }, {}, 'production', 'production')
    ).toBeNull();

    // Service (LoadBalancer) is cluster-external / edge and allowed across namespaces
    expect(
      getConnectionError('Service', 'Deployment', { serviceType: 'LoadBalancer' }, {}, 'default', 'production')
    ).toBeNull();

    // 2. Ingress -> Service in different namespaces
    expect(
      getConnectionError('Ingress', 'Service', {}, { serviceType: 'ClusterIP' }, 'staging', 'production')
    ).toContain('Cross-namespace backend is not allowed: Ingress in namespace "staging" cannot route to Service in namespace "production".');

    // Ingress -> Service in the same namespace is allowed
    expect(
      getConnectionError('Ingress', 'Service', {}, { serviceType: 'ClusterIP' }, 'production', 'production')
    ).toBeNull();

    // 3. Workload <-> ConfigMap / Secret / PVC in different namespaces
    expect(
      getConnectionError('Deployment', 'ConfigMap', {}, {}, 'staging', 'production')
    ).toContain('Cross-namespace resource binding is not allowed: Deployment in namespace "staging" cannot bind to ConfigMap in namespace "production".');

    expect(
      getConnectionError('Pod', 'Secret', {}, {}, 'staging', 'production')
    ).toContain('Cross-namespace resource binding is not allowed: Pod in namespace "staging" cannot bind to Secret in namespace "production".');

    expect(
      getConnectionError('StatefulSet', 'PVC', {}, {}, 'staging', 'production')
    ).toContain('Cross-namespace resource binding is not allowed: StatefulSet in namespace "staging" cannot bind to PVC in namespace "production".');

    // Workload <-> Config in same namespace is allowed
    expect(
      getConnectionError('Deployment', 'ConfigMap', {}, {}, 'production', 'production')
    ).toBeNull();

    // 4. HPA -> Workload in different namespaces
    expect(
      getConnectionError('HPA', 'Deployment', {}, {}, 'staging', 'production')
    ).toContain('Cross-namespace scaling is not allowed: HPA in namespace "staging" cannot scale workload in namespace "production".');

    // HPA -> Workload in same namespace is allowed
    expect(
      getConnectionError('HPA', 'Deployment', {}, {}, 'production', 'production')
    ).toBeNull();

    // Check bidirectional namespace isolation helpers
    expect(
      checkNamespaceIsolation('Deployment', 'Service', {}, { serviceType: 'LoadBalancer' }, 'ns-a', 'ns-b')
    ).toBeNull();
    expect(
      checkNamespaceIsolation('Deployment', 'Service', {}, {}, 'ns-a', 'ns-b')
    ).toContain('Cross-namespace connection is not allowed: Service in namespace "ns-a" cannot connect to workload in namespace "ns-b".');
    expect(
      checkNamespaceIsolation('ConfigMap', 'Deployment', {}, {}, 'ns-a', 'ns-b')
    ).toContain('Cross-namespace resource binding is not allowed: ConfigMap in namespace "ns-a" cannot bind to Deployment in namespace "ns-b".');
    expect(
      checkNamespaceIsolation('Deployment', 'HPA', {}, {}, 'ns-a', 'ns-b')
    ).toContain('Cross-namespace scaling is not allowed: HPA in namespace "ns-a" cannot scale workload in namespace "ns-b".');
  });

  describe('PVC Volume Claim Template topology rules', () => {
    it('identifies StatefulSet resources by type or workloadType', () => {
      expect(isStatefulSetResource('StatefulSet', {})).toBe(true);
      expect(isStatefulSetResource('Pod', { workloadType: 'StatefulSet' })).toBe(true);
      expect(isStatefulSetResource('Deployment', {})).toBe(false);
      expect(isStatefulSetResource(undefined, undefined)).toBe(false);
    });

    it('permits connecting PVC to a single workload without existing connections', () => {
      const pvc = { id: 'pvc-1', type: 'PVC', data: { label: 'my-pvc' } };
      const ss = { id: 'ss-1', type: 'StatefulSet', data: { label: 'my-ss' } };
      expect(checkPvcTemplateTopologyConflict(pvc, ss, [])).toBeNull();

      const dep = { id: 'dep-1', type: 'Deployment', data: { label: 'my-dep' } };
      expect(checkPvcTemplateTopologyConflict(pvc, dep, [])).toBeNull();
    });

    it('rejects connecting StatefulSet when PVC is already connected to another workload', () => {
      const pvc = { id: 'pvc-1', type: 'PVC', data: { label: 'shared-pvc' } };
      const newSS = { id: 'ss-2', type: 'StatefulSet', data: { label: 'order-ss' } };
      const existingDep = { id: 'dep-1', type: 'Deployment', data: { label: 'web-dep' } };

      const error = checkPvcTemplateTopologyConflict(pvc, newSS, [existingDep]);
      expect(error).toBe(
        'Volume Claim Template Conflict: PVC "shared-pvc" cannot be connected to StatefulSet "order-ss" while already connected to "web-dep".'
      );
    });

    it('rejects connecting Deployment or Pod when PVC is already claimed by a StatefulSet', () => {
      const pvc = { id: 'pvc-1', type: 'PVC', data: { label: 'db-pvc' } };
      const newDep = { id: 'dep-1', type: 'Deployment', data: { label: 'web-dep' } };
      const existingSS = { id: 'ss-1', type: 'StatefulSet', data: { label: 'database-ss' } };

      const error = checkPvcTemplateTopologyConflict(pvc, newDep, [existingSS]);
      expect(error).toBe(
        'Volume Claim Template Conflict: PVC "db-pvc" is claimed as a StatefulSet volumeClaimTemplate by "database-ss" and cannot be connected to "web-dep".'
      );
    });

    it('rejects connecting second StatefulSet to the same PVC', () => {
      const pvc = { id: 'pvc-1', type: 'PVC', data: { label: 'db-pvc' } };
      const secondSS = { id: 'ss-2', type: 'StatefulSet', data: { label: 'backup-ss' } };
      const firstSS = { id: 'ss-1', type: 'StatefulSet', data: { label: 'primary-ss' } };

      const error = checkPvcTemplateTopologyConflict(pvc, secondSS, [firstSS]);
      expect(error).toBe(
        'Volume Claim Template Conflict: PVC "db-pvc" cannot be connected to StatefulSet "backup-ss" while already connected to "primary-ss".'
      );
    });

    it('permits connecting multiple Deployments sharing a PVC without StatefulSets', () => {
      const pvc = { id: 'pvc-1', type: 'PVC', data: { label: 'rwx-pvc' } };
      const newDep = { id: 'dep-2', type: 'Deployment', data: { label: 'worker-dep' } };
      const existingDep = { id: 'dep-1', type: 'Deployment', data: { label: 'web-dep' } };

      expect(checkPvcTemplateTopologyConflict(pvc, newDep, [existingDep])).toBeNull();
    });

    it('falls back to node IDs when labels are missing and skips existing workload matching current workload id', () => {
      const pvcNoLabel = { id: 'pvc-raw', type: 'PVC' };
      const ssNoLabel = { id: 'ss-raw', type: 'StatefulSet' };
      const depNoLabel = { id: 'dep-raw', type: 'Deployment' };

      // 1. skips self if existing.id === workloadNode.id
      expect(checkPvcTemplateTopologyConflict(pvcNoLabel, ssNoLabel, [ssNoLabel])).toBeNull();

      // 2. target StatefulSet with ID fallbacks
      const errTargetSS = checkPvcTemplateTopologyConflict(pvcNoLabel, ssNoLabel, [depNoLabel]);
      expect(errTargetSS).toBe(
        'Volume Claim Template Conflict: PVC "pvc-raw" cannot be connected to StatefulSet "ss-raw" while already connected to "dep-raw".'
      );

      // 3. existing StatefulSet with ID fallbacks
      const errExistingSS = checkPvcTemplateTopologyConflict(pvcNoLabel, depNoLabel, [ssNoLabel]);
      expect(errExistingSS).toBe(
        'Volume Claim Template Conflict: PVC "pvc-raw" is claimed as a StatefulSet volumeClaimTemplate by "ss-raw" and cannot be connected to "dep-raw".'
      );
    });
  });
});
