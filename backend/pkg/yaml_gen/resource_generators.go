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

// generateStatefulSet constructs a Kubernetes StatefulSet resource object.
func generateStatefulSet(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	replicas := 1
	if data.Replicas != nil {
		replicas = *data.Replicas
	}

	_, targetIDs := getPodDataAndIDs(data, ctx)

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
		vctVolumeMounts = append(vctVolumeMounts, k8s.VolumeMount{
			Name:      volName,
			MountPath: fmt.Sprintf("/data-%d", index),
		})

		vct := k8s.PVC{
			ApiVersion: "v1",
			Kind:       "PersistentVolumeClaim",
			Metadata: k8s.ObjectMeta{
				Name: volName,
			},
			Spec: k8s.PVCSpec{
				AccessModes: []string{accessMode},
				Resources: k8s.ResourceRequirements{
					Requests: map[string]string{
						"storage": storageCapacity,
					},
				},
				StorageClassName: storageClass,
			},
		}
		volumeClaimTemplates = append(volumeClaimTemplates, vct)
	}

	svcName := name
	for _, edge := range ctx.targetEdgeMap[data.ID] {
		sourceNode := ctx.nodeMap[edge.Source]
		if sourceNode != nil && sourceNode.Type == "Service" {
			svcName = sanitizeName(sourceNode.Data.Label)
			break
		}
	}
	if svcName == "" {
		svcName = name
	}

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

// generatePodOrDeployment generates a Deployment object if replicas > 1 or a standalone Pod if replicas <= 1.
func generatePodOrDeployment(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	if data.WorkloadType == "StatefulSet" {
		return generateStatefulSet(data, name, namespace, ctx)
	}

	podSpec := createPodSpec(data, ctx)
	replicas := 1
	if data.Replicas != nil {
		replicas = *data.Replicas
	}

	if replicas > 1 {
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
				Template: k8s.PodTemplate{
					Metadata: k8s.ObjectMeta{
						Labels: map[string]string{"app": name},
					},
					Spec: podSpec,
				},
			},
		}
	}

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
	if podData.RestartPolicy != "" {
		restartPolicy = podData.RestartPolicy
	}
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

// findTargetWorkload identifies the target Deployment or Pod node connected to a Service.
func findTargetWorkload(serviceID string, ctx *GenContext) *k8s.FrontendNode {
	for _, edge := range ctx.sourceEdgeMap[serviceID] {
		target := ctx.nodeMap[edge.Target]
		if target != nil && (target.Type == "Deployment" || target.Type == "Pod") {
			return target
		}
	}
	return nil
}

// determineServiceSelector derives selector label from target workload or node settings.
func determineServiceSelector(data k8s.K8sNodeData, targetWorkload *k8s.FrontendNode) string {
	if data.Selector != "" {
		return sanitizeName(data.Selector)
	}
	if targetWorkload != nil {
		return sanitizeName(targetWorkload.Data.Label)
	}
	return "app-label"
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
	if (serviceType == "NodePort" || serviceType == "LoadBalancer") && data.NodePort != 0 {
		return data.NodePort
	}
	return 0
}

// generateService constructs a Kubernetes Service resource object.
func generateService(data k8s.K8sNodeData, name, namespace string, ctx *GenContext) interface{} {
	targetWorkload := findTargetWorkload(data.ID, ctx)
	selectorLabel := determineServiceSelector(data, targetWorkload)
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

	if val, ok := data.YamlSettings["serviceType"]; !ok || val {
		if serviceType == "Headless" {
			svc.Spec.Type = "ClusterIP"
			svc.Spec.ClusterIP = "None"
		} else {
			svc.Spec.Type = serviceType
		}
	}

	if val, ok := data.YamlSettings["selector"]; !ok || val {
		svc.Spec.Selector = map[string]string{"app": selectorLabel}
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

// findTargetDeployment identifies the target Deployment node connected to an HPA.
func findTargetDeployment(hpaID string, ctx *GenContext) *k8s.FrontendNode {
	for _, edge := range ctx.sourceEdgeMap[hpaID] {
		target := ctx.nodeMap[edge.Target]
		if target != nil && target.Type == "Deployment" {
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
	targetDeployment := findTargetDeployment(data.ID, ctx)
	deploymentName := "tbd-deployment"
	if targetDeployment != nil {
		deploymentName = sanitizeName(targetDeployment.Data.Label)
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
				Kind:       "Deployment",
				Name:       deploymentName,
			},
			MinReplicas: minReplicas,
			MaxReplicas: maxReplicas,
			Metrics:     buildHPAMetrics(data),
		},
	}
}
