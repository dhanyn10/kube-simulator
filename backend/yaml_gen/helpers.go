package yaml_gen

import (
	"build-wails/backend/k8s"
	"fmt"
)

func getEnvFromConnections(targetIDs []string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge) []k8s.EnvVar {
	var env []k8s.EnvVar

	for _, targetID := range targetIDs {
		for _, e := range edges {
			if e.Target == targetID {
				sourceNode := findNodeByID(e.Source, nodes)
				if sourceNode == nil {
					continue
				}

				if sourceNode.Type != "ConfigMap" && sourceNode.Type != "Secret" {
					continue
				}

				resourceName := sanitizeName(sourceNode.Data.Label)
				if resourceName == "" {
					resourceName = "config"
				}

				for _, item := range sourceNode.Data.ConfigData {
					if item.Key == "" {
						continue
					}

					envEntry := k8s.EnvVar{
						Name:      item.Key,
						ValueFrom: &k8s.EnvVarSource{},
					}

					if sourceNode.Type == "ConfigMap" {
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
			}
		}
	}

	return env
}

func getVolumeConfig(sourceIDs []string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge) ([]k8s.Volume, []k8s.VolumeMount) {
	var volumes []k8s.Volume
	var volumeMounts []k8s.VolumeMount

	pvcEdges := []k8s.FrontendEdge{}
	for _, sourceID := range sourceIDs {
		for _, e := range edges {
			if e.Source == sourceID {
				targetNode := findNodeByID(e.Target, nodes)
				if targetNode != nil && targetNode.Type == "PVC" {
					pvcEdges = append(pvcEdges, e)
				}
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

func getResourceConfig(data k8s.K8sNodeData) *k8s.ResourceRequirements {
	if val, ok := data.YamlSettings["resources"]; ok && !val {
		return nil
	}

	hasRequests := data.CpuRequest != "" || data.MemoryRequest != ""
	hasLimits := data.CpuLimit != "" || data.MemoryLimit != ""

	if !hasRequests && !hasLimits {
		return nil
	}

	res := &k8s.ResourceRequirements{}
	if hasRequests {
		res.Requests = make(map[string]string)
		if data.CpuRequest != "" {
			res.Requests["cpu"] = data.CpuRequest
		}
		if data.MemoryRequest != "" {
			res.Requests["memory"] = data.MemoryRequest
		}
	}
	if hasLimits {
		res.Limits = make(map[string]string)
		if data.CpuLimit != "" {
			res.Limits["cpu"] = data.CpuLimit
		}
		if data.MemoryLimit != "" {
			res.Limits["memory"] = data.MemoryLimit
		}
	}

	return res
}
