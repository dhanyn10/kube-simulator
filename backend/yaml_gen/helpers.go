package yaml_gen

import (
	"build-wails/backend/k8s"
	"fmt"
)

func getEnvFromConnections(targetIDs []string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge) []k8s.EnvVar {
	var env []k8s.EnvVar

	targets := make(map[string]bool)
	for _, id := range targetIDs {
		targets[id] = true
	}

	for _, e := range edges {
		if targets[e.Target] {
			sourceNode := findNodeByID(e.Source, nodes)
			env = append(env, getEnvFromNode(sourceNode)...)
		}
	}

	return env
}

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

func getVolumeConfig(sourceIDs []string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge) ([]k8s.Volume, []k8s.VolumeMount) {
	var volumes []k8s.Volume
	var volumeMounts []k8s.VolumeMount

	sources := make(map[string]bool)
	for _, id := range sourceIDs {
		sources[id] = true
	}

	pvcEdges := []k8s.FrontendEdge{}
	for _, e := range edges {
		if sources[e.Source] {
			targetNode := findNodeByID(e.Target, nodes)
			if targetNode != nil && targetNode.Type == "PVC" {
				pvcEdges = append(pvcEdges, e)
			}
		}
	}

	for i, e := range pvcEdges {
		pvcNode := findNodeByID(e.Target, nodes)
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

func getResourceConfig(data k8s.K8sNodeData) *k8s.ResourceRequirements {
	if val, ok := data.YamlSettings["resources"]; ok && !val {
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
