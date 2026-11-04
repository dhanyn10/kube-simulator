package yaml_gen

import (
	"build-wails/backend/pkg/k8s"
	"fmt"
	"strconv"
	"strings"
)

// getEnvFromConnections extracts environment variable references from attached ConfigMap and Secret source nodes.
func getEnvFromConnections(targetIDs []string, ctx *GenContext) []k8s.EnvVar {
	var env []k8s.EnvVar

	for _, targetID := range targetIDs {
		for _, edge := range ctx.targetEdgeMap[targetID] {
			sourceNode := ctx.nodeMap[edge.Source]
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
	for _, sourceID := range sourceIDs {
		for _, edge := range ctx.sourceEdgeMap[sourceID] {
			targetNode := ctx.nodeMap[edge.Target]
			if targetNode != nil && targetNode.Type == "PVC" {
				pvcEdges = append(pvcEdges, edge)
			}
		}
	}

	for index, edge := range pvcEdges {
		pvcNode := ctx.nodeMap[edge.Target]
		pvcName := "pvc-storage"
		if pvcNode != nil && pvcNode.Data.Label != "" {
			pvcName = sanitizeName(pvcNode.Data.Label)
		}
		volName := fmt.Sprintf("vol-%d", index)
		volumes = append(volumes, k8s.Volume{
			Name: volName,
			PersistentVolumeClaim: &k8s.PersistentVolumeClaimVolumeSource{
				ClaimName: pvcName,
			},
		})
		volumeMounts = append(volumeMounts, k8s.VolumeMount{
			Name:      volName,
			MountPath: fmt.Sprintf("/data-%d", index),
		})
	}

	return volumes, volumeMounts
}

// createResourceMap converts CPU and memory string inputs into a key-value resource specification map.
func createResourceMap(cpu, memory string) map[string]string {
	if cpu == "" && memory == "" {
		return nil
	}
	resourceMap := make(map[string]string)
	if cpu != "" {
		resourceMap["cpu"] = cpu
	}
	if memory != "" {
		resourceMap["memory"] = memory
	}
	return resourceMap
}

// isConnectedToResourceLimit checks if any edge in the provided list connects to a ResourceLimit node.
func isConnectedToResourceLimit(edges []k8s.FrontendEdge, nodeMap map[string]*k8s.FrontendNode, isTarget bool) bool {
	for _, edge := range edges {
		nodeID := edge.Source
		if isTarget {
			nodeID = edge.Target
		}
		if node, ok := nodeMap[nodeID]; ok && node != nil && node.Type == "ResourceLimit" {
			return true
		}
	}
	return false
}

// checkConnectedResourceLimit determines whether any of the target node IDs connect to a ResourceLimit node in the canvas graph.
func checkConnectedResourceLimit(targetIDs []string, ctx *GenContext) bool {
	if ctx == nil {
		return false
	}
	for _, id := range targetIDs {
		if isConnectedToResourceLimit(ctx.targetEdgeMap[id], ctx.nodeMap, false) {
			return true
		}
		if isConnectedToResourceLimit(ctx.sourceEdgeMap[id], ctx.nodeMap, true) {
			return true
		}
	}
	return false
}

// parseCpuMilli normalizes Kubernetes CPU strings (e.g. "500m", "1.5", "2") into millicores.
func parseCpuMilli(cpu string) int64 {
	trimmed := strings.TrimSpace(cpu)
	if trimmed == "" {
		return 0
	}
	if strings.HasSuffix(trimmed, "m") {
		val, err := strconv.ParseInt(strings.TrimSuffix(trimmed, "m"), 10, 64)
		if err == nil {
			return val
		}
		return 0
	}
	val, err := strconv.ParseFloat(trimmed, 64)
	if err == nil {
		return int64(val * 1000)
	}
	return 0
}

// parseMemoryBytes normalizes Kubernetes memory strings (e.g. "256Mi", "1Gi", "1024") into bytes.
func parseMemoryBytes(mem string) int64 {
	trimmed := strings.TrimSpace(mem)
	if trimmed == "" {
		return 0
	}
	if strings.HasSuffix(trimmed, "Gi") {
		val, err := strconv.ParseFloat(strings.TrimSuffix(trimmed, "Gi"), 64)
		if err == nil {
			return int64(val * 1024 * 1024 * 1024)
		}
	}
	if strings.HasSuffix(trimmed, "Mi") {
		val, err := strconv.ParseFloat(strings.TrimSuffix(trimmed, "Mi"), 64)
		if err == nil {
			return int64(val * 1024 * 1024)
		}
	}
	if strings.HasSuffix(trimmed, "Ki") {
		val, err := strconv.ParseFloat(strings.TrimSuffix(trimmed, "Ki"), 64)
		if err == nil {
			return int64(val * 1024)
		}
	}
	val, err := strconv.ParseInt(trimmed, 10, 64)
	if err == nil {
		return val
	}
	return 0
}

// resolveEffectiveCpu determines the effective CPU request value, defaulting to limit and clamping to limit if exceeded.
func resolveEffectiveCpu(cpuReq, cpuLimit string) string {
	if cpuReq == "" {
		return cpuLimit
	}
	if cpuLimit != "" && parseCpuMilli(cpuReq) > parseCpuMilli(cpuLimit) {
		return cpuLimit
	}
	return cpuReq
}

// resolveEffectiveMemory determines the effective memory request value, defaulting to limit and clamping to limit if exceeded.
func resolveEffectiveMemory(memReq, memLimit string) string {
	if memReq == "" {
		return memLimit
	}
	if memLimit != "" && parseMemoryBytes(memReq) > parseMemoryBytes(memLimit) {
		return memLimit
	}
	return memReq
}

// getResourceConfig builds resource requirements (requests and limits) from workload node settings.
func getResourceConfig(data k8s.K8sNodeData, targetIDs []string, ctx *GenContext) *k8s.ResourceRequirements {
	if val, ok := data.YamlSettings["resources"]; ok && !val {
		return nil
	}

	hasResourceLimit := len(data.ResourceLimits) > 0 || checkConnectedResourceLimit(targetIDs, ctx)
	if !hasResourceLimit {
		return nil
	}

	effectiveCpuReq := resolveEffectiveCpu(data.CpuRequest, data.CpuLimit)
	effectiveMemReq := resolveEffectiveMemory(data.MemoryRequest, data.MemoryLimit)

	requests := createResourceMap(effectiveCpuReq, effectiveMemReq)
	limits := createResourceMap(data.CpuLimit, data.MemoryLimit)

	if requests == nil && limits == nil {
		return nil
	}

	return &k8s.ResourceRequirements{
		Requests: requests,
		Limits:   limits,
	}
}
