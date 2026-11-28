import { describe, it, expect } from 'vitest';
import {
  resolveWorkloadController,
  extractExistingSuffixes,
  buildWorkloadPodList,
  getWorkerDistribution,
  filterWorkloadPods,
} from '@/activities/modals/workloadPodsModalHelpers';

describe('workloadPodsModalHelpers', () => {
  describe('resolveWorkloadController', () => {
    it('returns parent deployment when child pod is selected', () => {
      const parentDeployment = { id: 'deploy-1', type: 'Deployment', data: { label: 'web-app', replicas: 4 } };
      const childPod = { id: 'pod-1', type: 'Pod', parentId: 'deploy-1', data: {} };
      const allNodes = [parentDeployment, childPod];

      const resolved = resolveWorkloadController(childPod, allNodes);
      expect(resolved).toBe(parentDeployment);
    });

    it('returns selected node directly when it is already a controller', () => {
      const parentDeployment = { id: 'deploy-1', type: 'Deployment', data: { label: 'web-app', replicas: 4 } };
      const allNodes = [parentDeployment];

      const resolved = resolveWorkloadController(parentDeployment, allNodes);
      expect(resolved).toBe(parentDeployment);
    });

    it('returns parent StatefulSet or ReplicaSet when a child pod is selected', () => {
      const statefulSet = { id: 'sts-1', type: 'StatefulSet', data: {} };
      const replicaSet = { id: 'rs-1', type: 'ReplicaSet', data: {} };
      const statefulPod = { id: 'pod-sts', type: 'Pod', parentId: 'sts-1', data: {} };
      const replicaPod = { id: 'pod-rs', type: 'Pod', parentId: 'rs-1', data: {} };

      expect(resolveWorkloadController(statefulPod, [statefulSet, statefulPod])).toBe(statefulSet);
      expect(resolveWorkloadController(replicaPod, [replicaSet, replicaPod])).toBe(replicaSet);
    });

    it('returns the selected pod when its parent is missing or not a workload controller', () => {
      const service = { id: 'svc-1', type: 'Service', data: {} };
      const orphanPod = { id: 'pod-orphan', type: 'Pod', parentId: 'missing', data: {} };
      const podWithServiceParent = { id: 'pod-svc', type: 'Pod', parentId: 'svc-1', data: {} };

      expect(resolveWorkloadController(orphanPod, [orphanPod])).toBe(orphanPod);
      expect(resolveWorkloadController(podWithServiceParent, [service, podWithServiceParent])).toBe(
        podWithServiceParent
      );
    });

    it('returns null when selectedNode is null or undefined', () => {
      expect(resolveWorkloadController(null, [])).toBeNull();
      expect(resolveWorkloadController(undefined, [])).toBeNull();
    });
  });

  describe('extractExistingSuffixes', () => {
    it('extracts suffixes from array replicaSuffixes and single replicaSuffix', () => {
      const childPods = [
        { data: { replicaSuffixes: ['suf1', 'suf2'] } },
        { data: { replicaSuffix: 'suf3' } },
        { data: {} },
      ];
      const suffixes = extractExistingSuffixes(childPods);
      expect(suffixes).toEqual(['suf1', 'suf2', 'suf3']);
    });
  });

  describe('buildWorkloadPodList', () => {
    it('builds full pod list for Deployment with Ready status when simulation is not running', () => {
      const deployment = {
        id: 'deploy-1',
        type: 'Deployment',
        data: {
          label: 'web-app',
          replicas: 4,
          podHash: '1pd4l',
          image: 'nginx:latest',
          status: 'ready',
        },
      };
      const childPods = [
        {
          id: 'pod-group-1',
          type: 'Pod',
          parentId: 'deploy-1',
          data: {
            replicaSuffixes: ['ktdhh', 'e4u71', 'tns6q', '9a2bc'],
            podHash: '1pd4l',
          },
        },
      ];
      const allNodes = [deployment, ...childPods];

      const pods = buildWorkloadPodList(deployment, allNodes, {}, 3, false);
      expect(pods).toHaveLength(4);

      expect(pods[0]).toEqual({
        index: 1,
        podName: 'web-app-1pd4l-ktdhh',
        podHash: '1pd4l',
        replicaSuffix: 'ktdhh',
        workerId: 'worker-1',
        workerInfo: expect.objectContaining({ id: 'worker-1' }),
        status: 'Ready',
      });

      expect(pods[1]).toEqual({
        index: 2,
        podName: 'web-app-1pd4l-e4u71',
        podHash: '1pd4l',
        replicaSuffix: 'e4u71',
        workerId: 'worker-2',
        workerInfo: expect.objectContaining({ id: 'worker-2' }),
        status: 'Ready',
      });

      expect(pods[2]).toEqual({
        index: 3,
        podName: 'web-app-1pd4l-tns6q',
        podHash: '1pd4l',
        replicaSuffix: 'tns6q',
        workerId: 'worker-3',
        workerInfo: expect.objectContaining({ id: 'worker-3' }),
        status: 'Ready',
      });

      expect(pods[3]).toEqual({
        index: 4,
        podName: 'web-app-1pd4l-9a2bc',
        podHash: '1pd4l',
        replicaSuffix: '9a2bc',
        workerId: 'worker-1',
        workerInfo: expect.objectContaining({ id: 'worker-1' }),
        status: 'Ready',
      });
    });

    it('builds full pod list with Running status when simulation is actively running', () => {
      const deployment = {
        id: 'deploy-1',
        type: 'Deployment',
        data: {
          label: 'web-app',
          replicas: 1,
          podHash: '1pd4l',
          image: 'nginx:latest',
          status: 'ready',
        },
      };
      const pods = buildWorkloadPodList(deployment, [deployment], {}, 3, true);
      expect(pods[0].status).toBe('Running');
    });

    it('builds ordinal pod list for StatefulSet with replicas > 3', () => {
      const statefulSet = {
        id: 'sts-1',
        type: 'StatefulSet',
        data: {
          label: 'db-cluster',
          replicas: 4,
          image: 'postgres:15',
          status: 'ready',
        },
      };
      const allNodes = [statefulSet];

      const pods = buildWorkloadPodList(statefulSet, allNodes);
      expect(pods).toHaveLength(4);

      expect(pods[0].podName).toBe('db-cluster-0');
      expect(pods[0].podHash).toBe('');
      expect(pods[0].replicaSuffix).toBe('0');
      expect(pods[0].workerId).toBe('worker-1');
      expect(pods[0].status).toBe('Ready');

      expect(pods[1].podName).toBe('db-cluster-1');
      expect(pods[1].replicaSuffix).toBe('1');
      expect(pods[1].workerId).toBe('worker-2');

      expect(pods[2].podName).toBe('db-cluster-2');
      expect(pods[2].replicaSuffix).toBe('2');
      expect(pods[2].workerId).toBe('worker-3');

      expect(pods[3].podName).toBe('db-cluster-3');
      expect(pods[3].replicaSuffix).toBe('3');
      expect(pods[3].workerId).toBe('worker-1');
    });

    it('returns empty array if controller cannot be resolved', () => {
      expect(buildWorkloadPodList(null, [])).toEqual([]);
    });

    it('uses cached suffixes if provided', () => {
      const deployment = {
        id: 'deploy-1',
        type: 'Deployment',
        data: { label: 'web-app', replicas: 2, podHash: 'abcde' },
      };
      const cached = { 0: 'myfix', 1: 'other' };
      const pods = buildWorkloadPodList(deployment, [deployment], cached);
      expect(pods[0].replicaSuffix).toBe('myfix');
      expect(pods[1].replicaSuffix).toBe('other');
    });

    it('uses an empty data object when the controller has no data', () => {
      const controller = { id: 'dep-empty-data', type: 'Deployment' };
      const pods = buildWorkloadPodList(controller, [controller]);

      expect(pods).toHaveLength(1);
      expect(pods[0].podName).toBe('pod');
      expect(pods[0].podHash).toBe('1pd4l');
      expect(pods[0].workerId).toBe('worker-1');
    });
  });

  describe('getWorkerDistribution', () => {
    it('counts pods correctly across all 3 workers', () => {
      const deployment = {
        id: 'deploy-1',
        type: 'Deployment',
        data: { label: 'web-app', replicas: 5, podHash: '1pd4l' },
      };
      const pods = buildWorkloadPodList(deployment, [deployment]);
      const dist = getWorkerDistribution(pods);

      expect(dist).toHaveLength(3);
      // 5 pods spread round-robin: 0 -> w1, 1 -> w2, 2 -> w3, 3 -> w1, 4 -> w2
      expect(dist.find((d) => d.workerId === 'worker-1')?.count).toBe(2);
      expect(dist.find((d) => d.workerId === 'worker-2')?.count).toBe(2);
      expect(dist.find((d) => d.workerId === 'worker-3')?.count).toBe(1);
    });
  });

  describe('filterWorkloadPods', () => {
    const samplePods = [
      {
        index: 1,
        podName: 'web-app-1pd4l-ktdhh',
        podHash: '1pd4l',
        replicaSuffix: 'ktdhh',
        workerId: 'worker-1' as const,
        workerInfo: { id: 'worker-1' as const, name: 'worker-1', ip: '192.168.1.101', badgeBg: '', badgeText: '', badgeBorder: '' },
        status: 'Running' as const,
      },
      {
        index: 2,
        podName: 'web-app-1pd4l-e4u71',
        podHash: '1pd4l',
        replicaSuffix: 'e4u71',
        workerId: 'worker-2' as const,
        workerInfo: { id: 'worker-2' as const, name: 'worker-2', ip: '192.168.1.102', badgeBg: '', badgeText: '', badgeBorder: '' },
        status: 'Running' as const,
      },
      {
        index: 3,
        podName: 'worker-node-pod',
        podHash: '55555',
        replicaSuffix: 'zzzzz',
        workerId: 'worker-3' as const,
        workerInfo: { id: 'worker-3' as const, name: 'worker-3', ip: '192.168.1.103', badgeBg: '', badgeText: '', badgeBorder: '' },
        status: 'Pending' as const,
      },
    ];

    it('returns all pods on empty query', () => {
      expect(filterWorkloadPods(samplePods, '')).toEqual(samplePods);
      expect(filterWorkloadPods(samplePods, '   ')).toEqual(samplePods);
    });

    it('filters by suffix hash or replica suffix', () => {
      const res = filterWorkloadPods(samplePods, 'ktdhh');
      expect(res).toHaveLength(1);
      expect(res[0].podName).toBe('web-app-1pd4l-ktdhh');
    });

    it('filters by worker id or IP address', () => {
      const resWorker = filterWorkloadPods(samplePods, 'worker-2');
      expect(resWorker).toHaveLength(1);
      expect(resWorker[0].workerId).toBe('worker-2');

      const resIp = filterWorkloadPods(samplePods, '192.168.1.103');
      expect(resIp).toHaveLength(1);
      expect(resIp[0].workerId).toBe('worker-3');
    });
  });

  describe('buildWorkloadPodList edge branches', () => {
    it('uses assignedNode on child pod when valid worker-N, respects cachedSuffixes and isSimulating', () => {
      const deployment = {
        id: 'dep-1',
        type: 'Deployment',
        data: { baseName: 'api', replicas: 2, status: 'ready' },
      };
      const childPod = {
        id: 'pod-1',
        type: 'Pod',
        parentId: 'dep-1',
        data: { assignedNode: 'worker-4', podHash: 'abcde' },
      };

      const pods = buildWorkloadPodList(
        deployment,
        [deployment, childPod],
        { 0: 'c0001', 1: 'c0002' },
        3,
        true
      );

      expect(pods).toHaveLength(2);
      expect(pods[0].workerId).toBe('worker-4');
      expect(pods[0].status).toBe('Running');
      expect(pods[0].replicaSuffix).toBe('c0001');

      const dist = getWorkerDistribution(pods, 4);
      expect(dist).toHaveLength(4);
      expect(dist.find((d) => d.workerId === 'worker-4')?.count).toBe(1);
    });

    it('handles workloadType StatefulSet on Deployment node and falls back to pod label', () => {
      const sts = {
        id: 'sts-1',
        type: 'Deployment',
        data: { workloadType: 'StatefulSet', replicas: 1 },
      };
      const pods = buildWorkloadPodList(sts, [sts]);
      expect(pods).toHaveLength(1);
      expect(pods[0].podName).toBe('pod-0');
      expect(pods[0].status).toBe('Pending');
    });
  });
});

describe('workloadPodsModalHelpers dynamic worker fallback', () => {
  it('handles worker-5 beyond default WORKER_NODES and default podHash fallback', () => {
    const dep = { id: 'd1', type: 'Deployment', data: { label: 'svc', replicas: 1 } };
    const pod = { id: 'p1', type: 'Pod', parentId: 'd1', data: { assignedNode: 'worker-5' } };

    const pods = buildWorkloadPodList(dep, [dep, pod]);
    expect(pods[0].workerId).toBe('worker-5');
    expect(pods[0].podHash).toBe('1pd4l');

    const dist = getWorkerDistribution(pods);
    expect(dist).toHaveLength(5);
    expect(dist.find((d) => d.workerId === 'worker-5')?.count).toBe(1);
  });

  it('derives worker info dynamically when distribution reaches an uncached worker id', () => {
    const dist = getWorkerDistribution(
      [
        {
          index: 1,
          podName: 'api-1pd4l-abcde',
          podHash: '1pd4l',
          replicaSuffix: 'abcde',
          workerId: 'worker-42',
          workerInfo: expect.objectContaining({ id: 'worker-42' }) as any,
          status: 'Ready',
        },
      ],
      42
    );

    expect(dist).toHaveLength(42);
    expect(dist[41]).toEqual(
      expect.objectContaining({
        workerId: 'worker-42',
        workerInfo: expect.objectContaining({ id: 'worker-42', name: 'worker-42' }),
        count: 1,
      })
    );
  });

  it('matches child pods via data.parentId and handles non-worker-N workerId in getWorkerDistribution', () => {
    const dep = { id: 'd-data-p', type: 'Deployment', data: { label: 'svc', replicas: 1 } };
    const pod = {
      id: 'p-data-p',
      type: 'Pod',
      data: { parentId: 'd-data-p', replicaSuffix: 'abc99' },
    };

    const pods = buildWorkloadPodList(dep, [dep, pod]);
    expect(pods[0].replicaSuffix).toBe('abc99');

    const customDist = getWorkerDistribution([
      {
        ...pods[0],
        workerId: 'custom-node',
      },
    ]);
    expect(customDist).toHaveLength(3);
    expect(customDist.every((d) => d.count === 0)).toBe(true);
  });
});
