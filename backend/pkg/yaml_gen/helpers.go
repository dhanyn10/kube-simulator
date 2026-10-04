package yaml_gen

import (
	"build-wails/backend/pkg/k8s"
	"fmt"
)

// getEnvFromConnections extracts environment variable references from attached ConfigMap and Secret source nodes.
func getEnvFromConnections(targetIDs []string, ctx *GenContext) []k8s.EnvVar {
	var env []k8s.EnvVar

	for _, id := range targetIDs {
		for _, e := range ctx.targetEdgeMap[id] {
			sourceNode := ctx.nodeMap[e.Source]
			env = append(env, getEnvFromNode(sourceNode)...)
		}
	}

	return env
}

// getEnvFromNode constructs environment variable objects for data items stored inside a ConfigMap or Secret node.
func getEnvFromNode(node *k8s.FrontendNode) []k8s.EnvVar {
	if node == nil || (node.Type != "ConfigMap" && node.Type != "Secret") {
		return nil
	}

	resourceName := sanitizeName(node.Data.Label)
	if resourceName == "" {
		resourceName = "config"
	}

	var env []k8s.EnvVar
	for _, item := range node.Data.ConfigData {
		if item.Key == "" {
			continue
		}

		envEntry := k8s.EnvVar{
			Name:      item.Key,
			ValueFrom: &k8s.EnvVarSource{},
		}

		if node.Type == "ConfigMap" {
			envEntry.ValueFrom.ConfigMapKeyRef = &k8s.ConfigMapKeySelector{
				Name: resourceName,
				Key:  item.Key,
			}
		} else {
			envEntry.ValueFrom.SecretKeyRef = &k8s.SecretKeySelector{
				Name: resourceName,
				Key:  item.Key,
			}
		}
		env = append(env, envEntry)
	}
	return env
}

// getVolumeConfig constructs Volume and VolumeMount definitions for workloads attached to PVC nodes.
func getVolumeConfig(sourceIDs []string, ctx *GenContext) ([]k8s.Volume, []k8s.VolumeMount) {
	var volumes []k8s.Volume
	var volumeMounts []k8s.VolumeMount

	pvcEdges := []k8s.FrontendEdge{}
	for _, id := range sourceIDs {
		for _, e := range ctx.sourceEdgeMap[id] {
			targetNode := ctx.nodeMap[e.Target]
			if targetNode != nil && targetNode.Type == "PVC" {
				pvcEdges = append(pvcEdges, e)
			}
		}
	}

	for i, e := range pvcEdges {
		pvcNode := ctx.nodeMap[e.Target]
		pvcName := "pvc-storage"
		if pvcNode != nil && pvcNode.Data.Label != "" {
			pvcName = sanitizeName(pvcNode.Data.Label)
		}
		volName := fmt.Sprintf("vol-%d", i)
		volumes = append(volumes, k8s.Volume{
			Name: volName,
			PersistentVolumeClaim: &k8s.PersistentVolumeClaimVolumeSource{
				ClaimName: pvcName,
			},
		})
		volumeMounts = append(volumeMounts, k8s.VolumeMount{
			Name:      volName,
			MountPath: fmt.Sprintf("/data-%d", i),
		})
	}

	return volumes, volumeMounts
}

// createResourceMap converts CPU and memory string inputs into a key-value resource specification map.
func createResourceMap(cpu, memory string) map[string]string {
	if cpu == "" && memory == "" {
		return nil
	}
	res := make(map[string]string)
	if cpu != "" {
		res["cpu"] = cpu
	}
	if memory != "" {
		res["memory"] = memory
	}
	return res
}

// getResourceConfig builds resource requirements (requests and limits) from workload node settings.
func getResourceConfig(data k8s.K8sNodeData, targetIDs []string, ctx *GenContext) *k8s.ResourceRequirements {
	if val, ok := data.YamlSettings["resources"]; ok && !val {
		return nil
	}

	hasResourceLimit := len(data.ResourceLimits) > 0

	if !hasResourceLimit && ctx != nil {
		for _, id := range targetIDs {
			for _, e := range ctx.targetEdgeMap[id] {
				sourceNode := ctx.nodeMap[e.Source]
				if sourceNode != nil && sourceNode.Type == "ResourceLimit" {
					hasResourceLimit = true
					break
				}
			}
			if !hasResourceLimit {
				for _, e := range ctx.sourceEdgeMap[id] {
					targetNode := ctx.nodeMap[e.Target]
					if targetNode != nil && targetNode.Type == "ResourceLimit" {
						hasResourceLimit = true
						break
					}
				}
			}
			if hasResourceLimit {
				break
			}
		}
	}

	if !hasResourceLimit {
		return nil
	}

	requests := createResourceMap(data.CpuRequest, data.MemoryRequest)
	limits := createResourceMap(data.CpuLimit, data.MemoryLimit)

	if requests == nil && limits == nil {
		return nil
	}

	return &k8s.ResourceRequirements{
		Requests: requests,
		Limits:   limits,
	}
}
