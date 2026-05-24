package yaml_gen

import (
	"build-wails/backend/k8s"
)

const appsApiVersion = "apps/v1"

func createPodSpec(data k8s.K8sNodeData, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge) k8s.PodSpec {
	targetIDs := []string{data.ID}
	volumes, volumeMounts := getVolumeConfig(targetIDs, nodes, edges)
	env := getEnvFromConnections(targetIDs, nodes, edges)
	resources := getResourceConfig(data)

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

	return k8s.PodSpec{
		Containers: []k8s.Container{container},
		Volumes:    volumes,
	}
}

func generatePodOrDeployment(data k8s.K8sNodeData, name string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge, namespace string) interface{} {
	podSpec := createPodSpec(data, nodes, edges)
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

func generateConfigMap(data k8s.K8sNodeData, name string, namespace string) interface{} {
	configData := extractConfigData(data)
	cm := k8s.ConfigMap{
		ApiVersion: "v1",
		Kind:       "ConfigMap",
		Metadata:   k8s.ObjectMeta{Name: name, Namespace: namespace},
	}
	if len(configData) > 0 {
		cm.Data = configData
	}
	return cm
}

func generateSecret(data k8s.K8sNodeData, name string, namespace string) interface{} {
	secretData := extractConfigData(data)
	s := k8s.Secret{
		ApiVersion: "v1",
		Kind:       "Secret",
		Metadata:   k8s.ObjectMeta{Name: name, Namespace: namespace},
		Type:       "Opaque",
	}
	if len(secretData) > 0 {
		s.StringData = secretData
	}
	return s
}

func generatePVC(data k8s.K8sNodeData, name string, namespace string) interface{} {
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

func getPodDataAndIDs(data k8s.K8sNodeData, nodes []k8s.FrontendNode) (k8s.K8sNodeData, []string) {
	targetIDs := []string{data.ID}
	for _, n := range nodes {
		if n.ParentID == data.ID && n.Type == "Pod" {
			return n.Data, append(targetIDs, n.ID)
		}
	}
	return data, targetIDs
}

func buildPodTemplateSpec(data k8s.K8sNodeData, name string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge) k8s.PodTemplate {
	podData, targetIDs := getPodDataAndIDs(data, nodes)

	volumes, volumeMounts := getVolumeConfig(targetIDs, nodes, edges)
	env := getEnvFromConnections(targetIDs, nodes, edges)
	resources := getResourceConfig(podData)

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

	return k8s.PodTemplate{
		Metadata: k8s.ObjectMeta{
			Labels: map[string]string{"app": name},
		},
		Spec: k8s.PodSpec{
			Containers: []k8s.Container{container},
			Volumes:    volumes,
		},
	}
}

func generateDeployment(data k8s.K8sNodeData, name string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge, namespace string) interface{} {
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
			Template: buildPodTemplateSpec(data, name, nodes, edges),
		},
	}
}

func generateReplicaSet(data k8s.K8sNodeData, name string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge, namespace string) interface{} {
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
			Template: buildPodTemplateSpec(data, name, nodes, edges),
		},
	}
}

func findTargetWorkload(serviceID string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge) *k8s.FrontendNode {
	for _, e := range edges {
		if e.Source == serviceID {
			target := findNodeByID(e.Target, nodes)
			if target != nil && (target.Type == "Deployment" || target.Type == "Pod") {
				return target
			}
		}
	}
	return nil
}

func generateService(data k8s.K8sNodeData, name string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge, namespace string) interface{} {
	targetWorkload := findTargetWorkload(data.ID, nodes, edges)

	selectorLabel := "app-label"
	if data.Selector != "" {
		selectorLabel = data.Selector
	}
	if targetWorkload != nil {
		selectorLabel = sanitizeName(targetWorkload.Data.Label)
	}

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

	svc := k8s.Service{
		ApiVersion: "v1",
		Kind:       "Service",
		Metadata: k8s.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: k8s.ServiceSpec{
			Ports: []k8s.ServicePort{
				{Protocol: "TCP", Port: port, TargetPort: targetPort},
			},
		},
	}

	if val, ok := data.YamlSettings["selector"]; !ok || val {
		svc.Spec.Selector = map[string]string{"app": selectorLabel}
	}

	return svc
}

func findTargetService(ingressID string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge) *k8s.FrontendNode {
	for _, e := range edges {
		if e.Source == ingressID {
			target := findNodeByID(e.Target, nodes)
			if target != nil && target.Type == "Service" {
				return target
			}
		}
	}
	return nil
}

func generateIngress(data k8s.K8sNodeData, name string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge, namespace string) interface{} {
	targetService := findTargetService(data.ID, nodes, edges)

	serviceName := "tbd-service"
	servicePort := 80
	if targetService != nil {
		serviceName = sanitizeName(targetService.Data.Label)
		servicePort = targetService.Data.Port
		if servicePort == 0 {
			servicePort = 80
		}
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

func findTargetDeployment(hpaID string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge) *k8s.FrontendNode {
	for _, e := range edges {
		if e.Source == hpaID {
			target := findNodeByID(e.Target, nodes)
			if target != nil && target.Type == "Deployment" {
				return target
			}
		}
	}
	return nil
}

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

func generateHPA(data k8s.K8sNodeData, name string, nodes []k8s.FrontendNode, edges []k8s.FrontendEdge, namespace string) interface{} {
	targetDeployment := findTargetDeployment(data.ID, nodes, edges)
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
