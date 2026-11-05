package yaml_gen

import (
	"fmt"

	"build-wails/backend/pkg/k8s"
)

const appsApiVersion = "apps/v1"

// createPodSpec constructs a PodSpec populated with containers, environment variables, volumes, and resources.
func createPodSpec(data k8s.K8sNodeData, ctx *GenContext) k8s.PodSpec {
	targetIDs := []string{data.ID}
	volumes, volumeMounts := getVolumeConfig(targetIDs, ctx)
	env := getEnvFromConnections(targetIDs, ctx)
	resources := getResourceConfig(data, targetIDs, ctx)

	containerName := "main"
	if data.Label != "" {
		containerName = sanitizeName(data.Label)
	}

	image := "nginx:latest"
	if val, ok := data.YamlSettings["image"]; !ok || val {
		if data.Image != "" {
			image = data.Image
		}
	}

	container := k8s.Container{
		Name:            containerName,
		Image:           image,
		ImagePullPolicy: "IfNotPresent",
		Env:             env,
		Resources:       resources,
		VolumeMounts:    volumeMounts,
	}

	if data.Port != 0 {
		container.Ports = []k8s.ContainerPort{{ContainerPort: data.Port}}
	}

	restartPolicy := "Always"
	if data.RestartPolicy != "" {
		restartPolicy = data.RestartPolicy
	}
	if val, ok := data.YamlSettings["restartPolicy"]; ok && !val {
		restartPolicy = ""
	}

	return k8s.PodSpec{
		Containers:    []k8s.Container{container},
		Volumes:       volumes,
		RestartPolicy: restartPolicy,
	}
}

// createVolumeClaimTemplate constructs a single PVC volume claim template and volume mount.
func createVolumeClaimTemplate(pvcNode *k8s.FrontendNode, index int) (k8s.PVC, k8s.VolumeMount) {
	pvcName := "data"
	accessMode := "ReadWriteOnce"
	storageCapacity := "1Gi"
	storageClass := "standard"

	if pvcNode != nil {
		if pvcNode.Data.Label != "" {
			pvcName = sanitizeName(pvcNode.Data.Label)
		}
		if pvcNode.Data.AccessMode != "" {
			accessMode = pvcNode.Data.AccessMode
		}
		if pvcNode.Data.StorageCapacity != "" {
			storageCapacity = pvcNode.Data.StorageCapacity
		}
		if pvcNode.Data.StorageClass != "" {
			storageClass = pvcNode.Data.StorageClass
		}
	}

	volName := pvcName
	volMount := k8s.VolumeMount{
		Name:      volName,
		MountPath: fmt.Sprintf("/data-%d", index),
	}

	vct := k8s.PVC{
		ApiVersion: "v1",
		Kind:       "PersistentVolumeClaim",
		Metadata:   k8s.ObjectMeta{Name: volName},
		Spec: k8s.PVCSpec{
			AccessModes: []string{accessMode},
			Resources: k8s.ResourceRequirements{
				Requests: map[string]string{"storage": storageCapacity},
			},
			StorageClassName: storageClass,
		},
	}

	return vct, volMount
}

// buildStatefulSetVolumeClaims builds VolumeClaimTemplates and VolumeMounts for connected PVCs.
func buildStatefulSetVolumeClaims(targetIDs []string, ctx *GenContext) ([]k8s.PVC, []k8s.VolumeMount) {
	var pvcEdges []k8s.FrontendEdge
	for _, sourceID := range targetIDs {
		for _, edge := range ctx.sourceEdgeMap[sourceID] {
			targetNode := ctx.nodeMap[edge.Target]
			if targetNode != nil && targetNode.Type == "PVC" {
				pvcEdges = append(pvcEdges, edge)
			}
		}
	}

	var volumeClaimTemplates []k8s.PVC
	var vctVolumeMounts []k8s.VolumeMount

	for index, edge := range pvcEdges {
		pvcNode := ctx.nodeMap[edge.Target]
		vct, volMount := createVolumeClaimTemplate(pvcNode, index)
		volumeClaimTemplates = append(volumeClaimTemplates, vct)
		vctVolumeMounts = append(vctVolumeMounts, volMount)
	}

	return volumeClaimTemplates, vctVolumeMounts
}

// isMatchingServiceSelector checks if Service node selector matches StatefulSet name or labels.
func isMatchingServiceSelector(svcNode *k8s.FrontendNode, ssNode *k8s.FrontendNode, fallbackName string) bool {
	sel := svcNode.Data.Selector
	if sel == "" {
		return false
	}
	if sel == ssNode.ID || sanitizeName(sel) == sanitizeName(fallbackName) {
		return true
	}
	if ssNode.Data.Label != "" && (sel == ssNode.Data.Label || sanitizeName(sel) == sanitizeName(ssNode.Data.Label)) {
		return true
	}
	return false
}

// collectSelectorMatchingServices finds Service nodes whose selector matches the StatefulSet.
func collectSelectorMatchingServices(ssNode *k8s.FrontendNode, fallbackName string, ctx *GenContext, addCandidate func(*k8s.FrontendNode)) {
	if ssNode == nil {
		return
	}
	for _, node := range ctx.nodeMap {
		if node.Type == "Service" && isMatchingServiceSelector(node, ssNode, fallbackName) {
			addCandidate(node)
		}
	}
}

// collectConnectedServices collects candidate Service nodes connected via edges or selector to StatefulSet.
func collectConnectedServices(nodeID string, ssNode *k8s.FrontendNode, fallbackName string, ctx *GenContext) []*k8s.FrontendNode {
	var candidates []*k8s.FrontendNode
	seen := make(map[string]bool)

	addCandidate := func(n *k8s.FrontendNode) {
		if n != nil && n.Type == "Service" && !seen[n.ID] {
			seen[n.ID] = true
			candidates = append(candidates, n)
		}
	}

	for _, edge := range ctx.targetEdgeMap[nodeID] {
		addCandidate(ctx.nodeMap[edge.Source])
	}
	for _, edge := range ctx.sourceEdgeMap[nodeID] {
		addCandidate(ctx.nodeMap[edge.Target])
	}
	collectSelectorMatchingServices(ssNode, fallbackName, ctx, addCandidate)

	return candidates
}

// selectBestServiceName chooses a headless service or first available service candidate name.
func selectBestServiceName(candidates []*k8s.FrontendNode, fallbackName string) string {
	if len(candidates) == 0 {
		return fallbackName
	}
	for _, c := range candidates {
		if c.Data.ServiceType == "Headless" {
			return sanitizeName(c.Data.Label)
		}
	}
	return sanitizeName(candidates[0].Data.Label)
}

// findStatefulSetServiceName identifies connected Service name for a StatefulSet or falls back to name.
func findStatefulSetServiceName(nodeID, fallbackName string, ctx *GenContext) string {
	ssNode := ctx.nodeMap[nodeID]
	if ssNode != nil && ssNode.Data.BackendServiceName != "" {
		return sanitizeName(ssNode.Data.BackendServiceName)
	}

	candidates := collectConnectedServices(nodeID, ssNode, fallbackName, ctx)
	return selectBestServiceName(candidates, fallbackName)
}

// generateStatefulSet constructs a Kubernetes StatefulSet resource object.
func generateStatefulSet(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	replicas := 1
	if data.Replicas != nil {
		replicas = *data.Replicas
	}

	_, targetIDs := getPodDataAndIDs(data, ctx)
	volumeClaimTemplates, vctVolumeMounts := buildStatefulSetVolumeClaims(targetIDs, ctx)
	svcName := findStatefulSetServiceName(data.ID, name, ctx)

	podTemplate := buildPodTemplateSpec(data, name, ctx)
	if len(volumeClaimTemplates) > 0 {
		podTemplate.Spec.Volumes = nil
		if len(podTemplate.Spec.Containers) > 0 {
			podTemplate.Spec.Containers[0].VolumeMounts = vctVolumeMounts
		}
	}

	return k8s.StatefulSet{
		ApiVersion: appsApiVersion,
		Kind:       "StatefulSet",
		Metadata: k8s.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: k8s.StatefulSetSpec{
			ServiceName:          svcName,
			Replicas:             replicas,
			Selector:             k8s.LabelSelector{MatchLabels: map[string]string{"app": name}},
			Template:             podTemplate,
			VolumeClaimTemplates: volumeClaimTemplates,
		},
	}
}

// generatePodOrDeployment generates a workload controller object if configured or a standalone Pod.
func generatePodOrDeployment(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	if data.WorkloadType == "StatefulSet" {
		return generateStatefulSet(data, name, namespace, ctx)
	}
	if data.WorkloadType == "Deployment" {
		return generateDeployment(data, name, namespace, ctx)
	}
	if data.WorkloadType == "ReplicaSet" {
		return generateReplicaSet(data, name, namespace, ctx)
	}

	replicas := 1
	if data.Replicas != nil {
		replicas = *data.Replicas
	}

	if replicas > 1 {
		return generateDeployment(data, name, namespace, ctx)
	}

	podSpec := createPodSpec(data, ctx)
	return k8s.Pod{
		ApiVersion: "v1",
		Kind:       "Pod",
		Metadata: k8s.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: podSpec,
	}
}

// extractConfigData extracts key-value string maps from node ConfigData.
func extractConfigData(data k8s.K8sNodeData) map[string]string {
	configData := make(map[string]string)
	if val, ok := data.YamlSettings["data"]; !ok || val {
		for _, item := range data.ConfigData {
			if item.Key != "" {
				configData[item.Key] = item.Value
			}
		}
	}
	return configData
}

// generateConfigMap constructs a Kubernetes ConfigMap resource object.
func generateConfigMap(data k8s.K8sNodeData, name, namespace string) interface{} {
	configData := extractConfigData(data)
	configMap := k8s.ConfigMap{
		ApiVersion: "v1",
		Kind:       "ConfigMap",
		Metadata:   k8s.ObjectMeta{Name: name, Namespace: namespace},
	}
	if len(configData) > 0 {
		configMap.Data = configData
	}
	return configMap
}

// generateSecret constructs a Kubernetes Secret resource object.
func generateSecret(data k8s.K8sNodeData, name, namespace string) interface{} {
	secretData := extractConfigData(data)
	secret := k8s.Secret{
		ApiVersion: "v1",
		Kind:       "Secret",
		Metadata:   k8s.ObjectMeta{Name: name, Namespace: namespace},
		Type:       "Opaque",
	}
	if len(secretData) > 0 {
		secret.StringData = secretData
	}
	return secret
}

// isStatefulSetPvc checks if the PVC is connected to a StatefulSet workload and thus converted into VolumeClaimTemplates.
func isStatefulSetPvc(nodeID string, ctx *GenContext) bool {
	if ctx == nil {
		return false
	}
	for _, edge := range ctx.targetEdgeMap[nodeID] {
		sourceNode := ctx.nodeMap[edge.Source]
		if sourceNode != nil && (sourceNode.Type == "StatefulSet" || sourceNode.Data.WorkloadType == "StatefulSet") {
			return true
		}
	}
	for _, edge := range ctx.sourceEdgeMap[nodeID] {
		targetNode := ctx.nodeMap[edge.Target]
		if targetNode != nil && (targetNode.Type == "StatefulSet" || targetNode.Data.WorkloadType == "StatefulSet") {
			return true
		}
	}
	return false
}

// generatePVC constructs a Kubernetes PersistentVolumeClaim resource object.
func generatePVC(data k8s.K8sNodeData, name, namespace string) interface{} {
	accessMode := "ReadWriteOnce"
	if data.AccessMode != "" {
		accessMode = data.AccessMode
	}

	storageClass := "standard"
	if data.StorageClass != "" {
		storageClass = data.StorageClass
	}
	useStorageClass := true
	if val, ok := data.YamlSettings["storageClass"]; ok && !val {
		useStorageClass = false
	}

	storageCapacity := "1Gi"
	if data.StorageCapacity != "" {
		storageCapacity = data.StorageCapacity
	}

	pvc := k8s.PVC{
		ApiVersion: "v1",
		Kind:       "PersistentVolumeClaim",
		Metadata: k8s.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: k8s.PVCSpec{
			AccessModes: []string{accessMode},
			Resources: k8s.ResourceRequirements{
				Requests: map[string]string{
					"storage": storageCapacity,
				},
			},
		},
	}
	if useStorageClass {
		pvc.Spec.StorageClassName = storageClass
	}
	return pvc
}

// getPodDataAndIDs retrieves child pod data and IDs when generating workload pod templates.
func getPodDataAndIDs(data k8s.K8sNodeData, ctx *GenContext) (k8s.K8sNodeData, []string) {
	targetIDs := []string{data.ID}
	for _, node := range ctx.nodes {
		if node.ParentID == data.ID && node.Type == "Pod" {
			return node.Data, append(targetIDs, node.ID)
		}
	}
	return data, targetIDs
}

// buildPodTemplateSpec constructs a PodTemplate specification for controller resources.
func buildPodTemplateSpec(data k8s.K8sNodeData, name string, ctx *GenContext) k8s.PodTemplate {
	podData, targetIDs := getPodDataAndIDs(data, ctx)

	volumes, volumeMounts := getVolumeConfig(targetIDs, ctx)
	env := getEnvFromConnections(targetIDs, ctx)
	resources := getResourceConfig(podData, targetIDs, ctx)

	containerName := "main"
	if podData.Label != "" {
		containerName = sanitizeName(podData.Label)
	}

	image := "nginx:latest"
	if podData.Image != "" {
		image = podData.Image
	}

	container := k8s.Container{
		Name:            containerName,
		Image:           image,
		ImagePullPolicy: "IfNotPresent",
		Env:             env,
		Resources:       resources,
		VolumeMounts:    volumeMounts,
	}

	if podData.Port != 0 {
		container.Ports = []k8s.ContainerPort{{ContainerPort: podData.Port}}
	}

	restartPolicy := "Always"
	if val, ok := podData.YamlSettings["restartPolicy"]; ok && !val {
		restartPolicy = ""
	}

	return k8s.PodTemplate{
		Metadata: k8s.ObjectMeta{
			Labels: map[string]string{"app": name},
		},
		Spec: k8s.PodSpec{
			Containers:    []k8s.Container{container},
			Volumes:       volumes,
			RestartPolicy: restartPolicy,
		},
	}
}

// generateDeployment constructs a Kubernetes Deployment resource object.
func generateDeployment(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	if data.WorkloadType == "StatefulSet" {
		return generateStatefulSet(data, name, namespace, ctx)
	}

	replicas := 1
	if data.Replicas != nil {
		replicas = *data.Replicas
	}

	return k8s.Deployment{
		ApiVersion: appsApiVersion,
		Kind:       "Deployment",
		Metadata: k8s.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: k8s.DeploymentSpec{
			Replicas: replicas,
			Selector: k8s.LabelSelector{
				MatchLabels: map[string]string{"app": name},
			},
			Strategy: &k8s.DeploymentStrategy{
				Type: "RollingUpdate",
				RollingUpdate: &k8s.RollingUpdateOptions{
					MaxSurge:       "25%",
					MaxUnavailable: "25%",
				},
			},
			Template: buildPodTemplateSpec(data, name, ctx),
		},
	}
}

// generateReplicaSet constructs a Kubernetes ReplicaSet resource object.
func generateReplicaSet(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	replicas := 1
	if data.Replicas != nil {
		replicas = *data.Replicas
	}

	return k8s.ReplicaSet{
		ApiVersion: appsApiVersion,
		Kind:       "ReplicaSet",
		Metadata: k8s.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: k8s.DeploymentSpec{
			Replicas: replicas,
			Selector: k8s.LabelSelector{
				MatchLabels: map[string]string{"app": name},
			},
			Template: buildPodTemplateSpec(data, name, ctx),
		},
	}
}

// isServiceTargetingIngress checks if a Service is LoadBalancer and routes to an Ingress.
func isServiceTargetingIngress(data k8s.K8sNodeData, ctx *GenContext) bool {
	if data.ServiceType != "LoadBalancer" {
		return false
	}
	if len(data.IngressTargets) > 0 {
		return true
	}
	if data.Selector != "" {
		for _, node := range ctx.nodeMap {
			if node.Type == "Ingress" && (node.Data.Label == data.Selector || node.ID == data.Selector) {
				return true
			}
		}
	}
	for _, edge := range ctx.sourceEdgeMap[data.ID] {
		target := ctx.nodeMap[edge.Target]
		if target != nil && target.Type == "Ingress" {
			return true
		}
	}
	return false
}

// findTargetWorkload identifies the target Deployment or Pod node connected to a Service.
func findTargetWorkload(serviceID string, ctx *GenContext) *k8s.FrontendNode {
	for _, edge := range ctx.sourceEdgeMap[serviceID] {
		target := ctx.nodeMap[edge.Target]
		if target != nil && (target.Type == "Deployment" || target.Type == "Pod" || target.Type == "StatefulSet" || target.Type == "ReplicaSet") {
			return target
		}
	}
	return nil
}

// determineServiceSelector derives selector label map from target workload or node settings.
func determineServiceSelector(data k8s.K8sNodeData, targetWorkload *k8s.FrontendNode, ctx *GenContext) map[string]string {
	if isServiceTargetingIngress(data, ctx) {
		return map[string]string{
			"app.kubernetes.io/name":      "ingress-nginx",
			"app.kubernetes.io/component": "controller",
		}
	}
	if data.Selector != "" {
		return map[string]string{"app": sanitizeName(data.Selector)}
	}
	if targetWorkload != nil {
		return map[string]string{"app": sanitizeName(targetWorkload.Data.Label)}
	}
	return map[string]string{"app": "app-label"}
}

// determineServicePort derives service port and target port from node settings.
func determineServicePort(data k8s.K8sNodeData) (int, int) {
	port := 80
	if data.Port != 0 {
		port = data.Port
	}

	targetPort := port
	if data.TargetPort != 0 {
		targetPort = data.TargetPort
	}
	if val, ok := data.YamlSettings["targetPort"]; ok && !val {
		targetPort = 0
	}

	return port, targetPort
}

// determineNodePort derives node port based on service type and yaml settings.
func determineNodePort(data k8s.K8sNodeData, serviceType string) int {
	if val, ok := data.YamlSettings["nodePort"]; ok && !val {
		return 0
	}
	if (serviceType == "NodePort" || serviceType == "LoadBalancer") && data.NodePort >= 30000 && data.NodePort <= 32767 {
		return data.NodePort
	}
	return 0
}

// isStatefulSetWorkload checks if a node is a StatefulSet or child pod of a StatefulSet.
func isStatefulSetWorkload(n *k8s.FrontendNode, ctx *GenContext) bool {
	if n == nil {
		return false
	}
	if n.Type == "StatefulSet" || n.Data.WorkloadType == "StatefulSet" {
		return true
	}
	if n.ParentID != "" {
		parent := ctx.nodeMap[n.ParentID]
		if parent != nil && (parent.Type == "StatefulSet" || parent.Data.WorkloadType == "StatefulSet") {
			return true
		}
	}
	return false
}

// isTargetingViaEdges checks if any incoming or outgoing edge connects to a StatefulSet workload.
func isTargetingViaEdges(dataID string, ctx *GenContext) bool {
	for _, edge := range ctx.targetEdgeMap[dataID] {
		if isStatefulSetWorkload(ctx.nodeMap[edge.Source], ctx) {
			return true
		}
	}
	for _, edge := range ctx.sourceEdgeMap[dataID] {
		if isStatefulSetWorkload(ctx.nodeMap[edge.Target], ctx) {
			return true
		}
	}
	return false
}

// isTargetingViaSelector checks if a Service selector matches a StatefulSet workload.
func isTargetingViaSelector(selector string, ctx *GenContext) bool {
	if selector == "" {
		return false
	}
	sanitizedSel := sanitizeName(selector)
	for _, node := range ctx.nodeMap {
		if !isStatefulSetWorkload(node, ctx) {
			continue
		}
		if node.Data.Label == selector || node.ID == selector || sanitizeName(node.Data.Label) == sanitizedSel {
			return true
		}
	}
	return false
}

// isTargetingStatefulSet checks if a Service targets a StatefulSet via edges or selector.
func isTargetingStatefulSet(data k8s.K8sNodeData, targetWorkload *k8s.FrontendNode, ctx *GenContext) bool {
	if isStatefulSetWorkload(targetWorkload, ctx) {
		return true
	}
	if isTargetingViaEdges(data.ID, ctx) {
		return true
	}
	return isTargetingViaSelector(data.Selector, ctx)
}

// generateService constructs a Kubernetes Service resource object.
func generateService(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	targetWorkload := findTargetWorkload(data.ID, ctx)
	selectorMap := determineServiceSelector(data, targetWorkload, ctx)
	port, targetPort := determineServicePort(data)

	serviceType := "ClusterIP"
	if data.ServiceType != "" {
		serviceType = data.ServiceType
	}

	nodePort := determineNodePort(data, serviceType)

	svcPort := k8s.ServicePort{
		Protocol:   "TCP",
		Port:       port,
		TargetPort: targetPort,
		NodePort:   nodePort,
	}

	svc := k8s.Service{
		ApiVersion: "v1",
		Kind:       "Service",
		Metadata: k8s.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: k8s.ServiceSpec{
			Ports: []k8s.ServicePort{svcPort},
		},
	}

	isStatefulTarget := isTargetingStatefulSet(data, targetWorkload, ctx)

	if val, ok := data.YamlSettings["serviceType"]; !ok || val {
		if serviceType == "Headless" || (isStatefulTarget && (serviceType == "ClusterIP" || serviceType == "")) {
			svc.Spec.Type = "ClusterIP"
			svc.Spec.ClusterIP = "None"
		} else {
			svc.Spec.Type = serviceType
		}
	}
	if val, ok := data.YamlSettings["clusterIP"]; ok && !val {
		svc.Spec.ClusterIP = ""
	}

	if val, ok := data.YamlSettings["selector"]; !ok || val {
		svc.Spec.Selector = selectorMap
	}

	return svc
}

// findTargetService identifies the target Service node connected to an Ingress.
func findTargetService(ingressID string, ctx *GenContext) *k8s.FrontendNode {
	for _, edge := range ctx.sourceEdgeMap[ingressID] {
		target := ctx.nodeMap[edge.Target]
		if target != nil && target.Type == "Service" {
			return target
		}
	}
	return nil
}

// generateIngress constructs a Kubernetes Ingress resource object.
func generateIngress(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	targetService := findTargetService(data.ID, ctx)

	serviceName := "tbd-service"
	servicePort := 80
	if data.BackendServiceName != "" {
		serviceName = sanitizeName(data.BackendServiceName)
	} else if targetService != nil {
		serviceName = sanitizeName(targetService.Data.Label)
	}

	if data.ServicePort != 0 {
		servicePort = data.ServicePort
	} else if targetService != nil && targetService.Data.Port != 0 {
		servicePort = targetService.Data.Port
	}

	path := "/"
	if data.IngressPath != "" {
		path = data.IngressPath
	}
	if val, ok := data.YamlSettings["path"]; ok && !val {
		path = "/"
	}

	host := "example.local"
	if data.IngressHost != "" {
		host = data.IngressHost
	}

	return k8s.Ingress{
		ApiVersion: "networking.k8s.io/v1",
		Kind:       "Ingress",
		Metadata: k8s.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Annotations: map[string]string{
				"nginx.ingress.kubernetes.io/rewrite-target": "/",
				"kubernetes.io/ingress.class":                "nginx",
			},
		},
		Spec: k8s.IngressSpec{
			IngressClassName: "nginx",
			Rules: []k8s.IngressRule{
				{
					Host: host,
					HTTP: &k8s.HTTPIngressRuleValue{
						Paths: []k8s.HTTPIngressPath{
							{
								Path:     path,
								PathType: "Prefix",
								Backend: k8s.IngressBackend{
									Service: k8s.IngressServiceBackend{
										Name: serviceName,
										Port: k8s.ServiceBackendPort{Number: servicePort},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

// findTargetScaleWorkload identifies the target workload node (Deployment, StatefulSet, or ReplicaSet) connected to an HPA.
func findTargetScaleWorkload(hpaID string, ctx *GenContext) *k8s.FrontendNode {
	for _, edge := range ctx.sourceEdgeMap[hpaID] {
		target := ctx.nodeMap[edge.Target]
		if target != nil && (target.Type == "Deployment" || target.Type == "StatefulSet" || target.Type == "ReplicaSet") {
			return target
		}
	}
	return nil
}

// buildHPAMetrics builds CPU and memory metric specifications for an HPA resource.
func buildHPAMetrics(data k8s.K8sNodeData) []k8s.HPAMetric {
	var metrics []k8s.HPAMetric

	if val, ok := data.YamlSettings["targetCPU"]; !ok || val {
		targetCPU := 50
		if data.TargetCPU != nil {
			targetCPU = *data.TargetCPU
		}
		metrics = append(metrics, k8s.HPAMetric{
			Type: "Resource",
			Resource: &k8s.ResourceMetricSource{
				Name: "cpu",
				Target: k8s.MetricTarget{
					Type:               "Utilization",
					AverageUtilization: targetCPU,
				},
			},
		})
	}

	if val, ok := data.YamlSettings["targetMemory"]; (!ok || val) && data.TargetMemory != nil {
		metrics = append(metrics, k8s.HPAMetric{
			Type: "Resource",
			Resource: &k8s.ResourceMetricSource{
				Name: "memory",
				Target: k8s.MetricTarget{
					Type:               "Utilization",
					AverageUtilization: *data.TargetMemory,
				},
			},
		})
	}
	return metrics
}

// generateHPA constructs a Kubernetes HorizontalPodAutoscaler resource object.
func generateHPA(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	targetWorkload := findTargetScaleWorkload(data.ID, ctx)
	workloadKind := "Deployment"
	workloadName := "tbd-deployment"
	if targetWorkload != nil {
		workloadKind = targetWorkload.Type
		workloadName = sanitizeName(targetWorkload.Data.Label)
		if workloadName == "" {
			workloadName = targetWorkload.ID
		}
	}

	minReplicas := 1
	if data.MinReplicas != nil {
		minReplicas = *data.MinReplicas
	}
	maxReplicas := 10
	if data.MaxReplicas != nil {
		maxReplicas = *data.MaxReplicas
	}

	if val, ok := data.YamlSettings["replicas"]; ok && !val {
		minReplicas = 1
		maxReplicas = 10
	}

	return k8s.HPA{
		ApiVersion: "autoscaling/v2",
		Kind:       "HorizontalPodAutoscaler",
		Metadata: k8s.ObjectMeta{Name: name, Namespace: namespace},
		Spec: k8s.HPASpec{
			ScaleTargetRef: k8s.CrossVersionObjectReference{
				ApiVersion: appsApiVersion,
				Kind:       workloadKind,
				Name:       workloadName,
			},
			MinReplicas: minReplicas,
			MaxReplicas: maxReplicas,
			Metrics:     buildHPAMetrics(data),
		},
	}
}

// generateAttachedHPA constructs an HPA manifest from an attached HpaItem on a workload node.
func generateAttachedHPA(item k8s.HpaItem, node k8s.FrontendNode, ctx *GenContext) interface{} {
	hpaName := sanitizeName(item.Name)
	if hpaName == "" {
		hpaName = fmt.Sprintf("%s-hpa", sanitizeName(node.Data.Label))
	}
	namespace := getNamespace(node, ctx)

	workloadKind := node.Type
	if workloadKind == "Pod" {
		workloadKind = "Deployment"
	}
	workloadName := sanitizeName(node.Data.Label)
	if workloadName == "" {
		workloadName = node.ID
	}

	minReplicas := item.MinReplicas
	if minReplicas <= 0 {
		minReplicas = 1
	}
	maxReplicas := item.MaxReplicas
	if maxReplicas <= 0 {
		maxReplicas = 10
	}
	targetCPU := item.TargetCPU
	if targetCPU <= 0 {
		targetCPU = 80
	}

	metrics := []k8s.HPAMetric{
		{
			Type: "Resource",
			Resource: &k8s.ResourceMetricSource{
				Name: "cpu",
				Target: k8s.MetricTarget{
					Type:               "Utilization",
					AverageUtilization: targetCPU,
				},
			},
		},
	}

	if item.TargetMemory != nil && *item.TargetMemory > 0 {
		metrics = append(metrics, k8s.HPAMetric{
			Type: "Resource",
			Resource: &k8s.ResourceMetricSource{
				Name: "memory",
				Target: k8s.MetricTarget{
					Type:               "Utilization",
					AverageUtilization: *item.TargetMemory,
				},
			},
		})
	}

	return k8s.HPA{
		ApiVersion: "autoscaling/v2",
		Kind:       "HorizontalPodAutoscaler",
		Metadata:   k8s.ObjectMeta{Name: hpaName, Namespace: namespace},
		Spec: k8s.HPASpec{
			ScaleTargetRef: k8s.CrossVersionObjectReference{
				ApiVersion: appsApiVersion,
				Kind:       workloadKind,
				Name:       workloadName,
			},
			MinReplicas: minReplicas,
			MaxReplicas: maxReplicas,
			Metrics:     metrics,
		},
	}
}
