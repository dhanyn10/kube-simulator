package yaml_gen

import (
	"build-wails/backend/pkg/k8s"
	"testing"
)

func TestResourceGenerators_HPAMetrics(t *testing.T) {
	t.Run("Disabled Metrics", func(t *testing.T) {
		data := k8s.K8sNodeData{
			YamlSettings: map[string]bool{
				"targetCPU":    false,
				"targetMemory": false,
			},
		}
		metrics := buildHPAMetrics(data)
		if len(metrics) != 0 {
			t.Errorf("Expected 0 metrics, got %d", len(metrics))
		}
	})

	t.Run("Disabled Replicas", func(t *testing.T) {
		// hpaID is dummy here, just testing logic
		data := k8s.K8sNodeData{
			YamlSettings: map[string]bool{
				"replicas": false,
			},
		}
		res := generateHPA(data, "my-hpa", "default", &GenContext{})
		hpa := res.(k8s.HPA)
		if hpa.Spec.MinReplicas != 1 || hpa.Spec.MaxReplicas != 10 {
			t.Errorf("Expected default replicas 1/10, got %d/%d", hpa.Spec.MinReplicas, hpa.Spec.MaxReplicas)
		}
	})
}

func assertStatefulSetSpec(t *testing.T, res interface{}, expectedReplicas int, expectedSvcName string) {
	t.Helper()
	ss, ok := res.(k8s.StatefulSet)
	if !ok || ss.Kind != "StatefulSet" || ss.Spec.Replicas != expectedReplicas {
		t.Fatalf("Expected StatefulSet with %d replicas, got %v", expectedReplicas, res)
	}
	if expectedSvcName != "" && ss.Spec.ServiceName != expectedSvcName {
		t.Errorf("Expected ServiceName %s, got %s", expectedSvcName, ss.Spec.ServiceName)
	}
}

func assertStatefulSetVCT(t *testing.T, ss k8s.StatefulSet, expectedName, expectedStorageClass string) {
	t.Helper()
	if len(ss.Spec.VolumeClaimTemplates) != 1 {
		t.Fatalf("Expected 1 volumeClaimTemplate, got %d", len(ss.Spec.VolumeClaimTemplates))
	}
	vct := ss.Spec.VolumeClaimTemplates[0]
	if vct.Metadata.Name != expectedName || vct.Spec.StorageClassName != expectedStorageClass {
		t.Errorf("Unexpected VCT: %v", vct)
	}
}

func assertHeadlessService(t *testing.T, res interface{}) {
	t.Helper()
	svc, ok := res.(k8s.Service)
	if !ok {
		t.Fatalf("Expected Service, got %v", res)
	}
	if svc.Spec.Type != "ClusterIP" || svc.Spec.ClusterIP != "None" {
		t.Errorf("Expected ClusterIP: None for Headless service, got Type=%s, ClusterIP=%s", svc.Spec.Type, svc.Spec.ClusterIP)
	}
}

func TestResourceGenerators_StatefulSet(t *testing.T) {
	t.Run("Generate StatefulSet", func(t *testing.T) {
		rep := 3
		data := k8s.K8sNodeData{Replicas: &rep, WorkloadType: "StatefulSet", Image: "redis:alpine"}
		res := generatePodOrDeployment(data, "redis-ss", "default", &GenContext{})
		assertStatefulSetSpec(t, res, 3, "")
	})

	t.Run("generateDeployment with WorkloadType StatefulSet", func(t *testing.T) {
		rep := 2
		data := k8s.K8sNodeData{Replicas: &rep, WorkloadType: "StatefulSet", Image: "postgres:15"}
		res := generateDeployment(data, "pg-db", "prod", &GenContext{})
		assertStatefulSetSpec(t, res, 2, "pg-db")
	})

	t.Run("generatePodOrDeployment with WorkloadType Deployment", func(t *testing.T) {
		rep := 1
		data := k8s.K8sNodeData{Replicas: &rep, WorkloadType: "Deployment", Image: "nginx:latest"}
		res := generatePodOrDeployment(data, "app-dep", "default", &GenContext{})
		dep, ok := res.(k8s.Deployment)
		if !ok || dep.Kind != "Deployment" || dep.Spec.Replicas != 1 {
			t.Fatalf("Expected Deployment with replicas: 1, got %v", res)
		}
	})

	t.Run("generatePodOrDeployment with WorkloadType ReplicaSet", func(t *testing.T) {
		rep := 1
		data := k8s.K8sNodeData{Replicas: &rep, WorkloadType: "ReplicaSet", Image: "nginx:latest"}
		res := generatePodOrDeployment(data, "app-rs", "default", &GenContext{})
		rs, ok := res.(k8s.ReplicaSet)
		if !ok || rs.Kind != "ReplicaSet" || rs.Spec.Replicas != 1 {
			t.Fatalf("Expected ReplicaSet with replicas: 1, got %v", res)
		}
	})

	t.Run("Generate StatefulSet with volumeClaimTemplates and Headless Service", func(t *testing.T) {
		rep := 3
		ssData := k8s.K8sNodeData{ID: "ss1", Replicas: &rep, WorkloadType: "StatefulSet", Label: "redis-ss"}
		pvcNode := &k8s.FrontendNode{
			ID:   "pvc1",
			Type: "PVC",
			Data: k8s.K8sNodeData{Label: "data-vol", AccessMode: "ReadWriteOnce", StorageCapacity: "10Gi", StorageClass: "fast-ssd"},
		}
		svcNode := &k8s.FrontendNode{
			ID:   "svc1",
			Type: "Service",
			Data: k8s.K8sNodeData{Label: "redis-headless", ServiceType: "Headless"},
		}

		ctx := &GenContext{
			nodeMap: map[string]*k8s.FrontendNode{
				"ss1":  {ID: "ss1", Type: "StatefulSet", Data: ssData},
				"pvc1": pvcNode,
				"svc1": svcNode,
			},
			sourceEdgeMap: map[string][]k8s.FrontendEdge{
				"ss1": {{Source: "ss1", Target: "pvc1"}},
			},
			targetEdgeMap: map[string][]k8s.FrontendEdge{
				"ss1": {{Source: "svc1", Target: "ss1"}},
			},
		}

		resSS := generateStatefulSet(ssData, "redis-ss", "default", ctx)
		assertStatefulSetSpec(t, resSS, 3, "redis-headless")
		ss := resSS.(k8s.StatefulSet)
		assertStatefulSetVCT(t, ss, "data-vol", "fast-ssd")

		resSvc := generateService(svcNode.Data, "redis-headless", "default", ctx)
		assertHeadlessService(t, resSvc)
	})
}

func testPVCDisabledFields(t *testing.T) {
	data := k8s.K8sNodeData{
		StorageCapacity: "5Gi",
		YamlSettings: map[string]bool{
			"capacity":    false,
			"accessModes": false,
		},
	}
	res := generatePVC(data, "pvc-test", "default")
	pvc := res.(k8s.PVC)
	if pvc.Spec.Resources.Requests["storage"] != "5Gi" {
		t.Errorf("Expected storage 5Gi, got %s", pvc.Spec.Resources.Requests["storage"])
	}
}

func TestIsStatefulSetPvc(t *testing.T) {
	if isStatefulSetPvc("pvc1", nil) {
		t.Errorf("Expected false for nil ctx")
	}

	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"pvc1": {ID: "pvc1", Type: "PVC"},
			"ss1":  {ID: "ss1", Type: "StatefulSet", Data: k8s.K8sNodeData{Label: "ss"}},
			"ss2":  {ID: "ss2", Type: "Pod", Data: k8s.K8sNodeData{Label: "ss2", WorkloadType: "StatefulSet"}},
			"dep1": {ID: "dep1", Type: "Deployment", Data: k8s.K8sNodeData{Label: "dep"}},
		},
		sourceEdgeMap: make(map[string][]k8s.FrontendEdge),
		targetEdgeMap: make(map[string][]k8s.FrontendEdge),
	}

	// Unconnected
	if isStatefulSetPvc("pvc1", ctx) {
		t.Errorf("Expected false for unconnected PVC")
	}

	// Connected from Deployment
	ctx.targetEdgeMap["pvc1"] = []k8s.FrontendEdge{{Source: "dep1", Target: "pvc1"}}
	if isStatefulSetPvc("pvc1", ctx) {
		t.Errorf("Expected false for Deployment connected PVC")
	}

	// Connected from StatefulSet
	ctx.targetEdgeMap["pvc1"] = []k8s.FrontendEdge{{Source: "ss1", Target: "pvc1"}}
	if !isStatefulSetPvc("pvc1", ctx) {
		t.Errorf("Expected true for StatefulSet connected PVC")
	}

	// Outgoing edge to StatefulSet (reverse edge)
	ctx.targetEdgeMap["pvc1"] = nil
	ctx.sourceEdgeMap["pvc1"] = []k8s.FrontendEdge{{Source: "pvc1", Target: "ss2"}}
	if !isStatefulSetPvc("pvc1", ctx) {
		t.Errorf("Expected true for reverse edge to StatefulSet workloadType")
	}
}

func testDeploymentDisabledReplicas(t *testing.T) {
	rep := 5
	data := k8s.K8sNodeData{
		Replicas: &rep,
		YamlSettings: map[string]bool{
			"replicas": false,
		},
	}
	res := generateDeployment(data, "dep-test", "default", &GenContext{})
	dep := res.(k8s.Deployment)
	if dep.Spec.Replicas != 5 {
		t.Errorf("Expected replicas 5, got %d", dep.Spec.Replicas)
	}
}

func testReplicaSetDisabledReplicas(t *testing.T) {
	rep := 5
	data := k8s.K8sNodeData{
		Replicas: &rep,
		YamlSettings: map[string]bool{
			"replicas": false,
		},
	}
	res := generateReplicaSet(data, "rs-test", "default", &GenContext{})
	rs := res.(k8s.ReplicaSet)
	if rs.Spec.Replicas != 5 {
		t.Errorf("Expected replicas 5, got %d", rs.Spec.Replicas)
	}
}

func testServiceNoTargetWorkload(t *testing.T) {
	data := k8s.K8sNodeData{Port: 80}
	ctx := &GenContext{}
	res := generateService(data, "svc-no-target", "default", ctx)
	svc := res.(k8s.Service)
	if svc.Spec.Selector["app"] != "app-label" {
		t.Errorf("Expected fallback app selector 'app-label', got %s", svc.Spec.Selector["app"])
	}
}

func testIngressNoTargetService(t *testing.T) {
	data := k8s.K8sNodeData{IngressHost: "test.local"}
	ctx := &GenContext{}
	res := generateIngress(data, "ing-no-target", "default", ctx)
	ing := res.(k8s.Ingress)
	if ing.Spec.Rules[0].HTTP.Paths[0].Backend.Service.Name != "tbd-service" {
		t.Errorf("Expected fallback service name 'tbd-service', got %s", ing.Spec.Rules[0].HTTP.Paths[0].Backend.Service.Name)
	}
}

func testHPANoTargetDeployment(t *testing.T) {
	minR := 2
	maxR := 4
	data := k8s.K8sNodeData{
		MinReplicas: &minR,
		MaxReplicas: &maxR,
		YamlSettings: map[string]bool{
			"replicas": false,
		},
	}
	ctx := &GenContext{}
	res := generateHPA(data, "hpa-no-target", "default", ctx)
	hpa := res.(k8s.HPA)
	if hpa.Spec.MinReplicas != 1 || hpa.Spec.MaxReplicas != 10 {
		t.Errorf("Expected 1 and 10 when replicas is disabled, got %d and %d", hpa.Spec.MinReplicas, hpa.Spec.MaxReplicas)
	}
	if hpa.Spec.ScaleTargetRef.Kind != "Deployment" || hpa.Spec.ScaleTargetRef.Name != "tbd-deployment" {
		t.Errorf("Expected fallback scaleTargetRef 'Deployment'/'tbd-deployment', got %s/%s", hpa.Spec.ScaleTargetRef.Kind, hpa.Spec.ScaleTargetRef.Name)
	}
}

func testHPATargetingStatefulSet(t *testing.T) {
	data := k8s.K8sNodeData{ID: "hpa-ss"}
	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"ss1": {ID: "ss1", Type: "StatefulSet", Data: k8s.K8sNodeData{Label: "my-stateful-app"}},
		},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{
			"hpa-ss": {{Source: "hpa-ss", Target: "ss1"}},
		},
	}
	res := generateHPA(data, "hpa-ss", "default", ctx)
	hpa := res.(k8s.HPA)
	if hpa.Spec.ScaleTargetRef.Kind != "StatefulSet" || hpa.Spec.ScaleTargetRef.Name != "my-stateful-app" {
		t.Errorf("Expected scaleTargetRef StatefulSet/my-stateful-app, got %s/%s", hpa.Spec.ScaleTargetRef.Kind, hpa.Spec.ScaleTargetRef.Name)
	}
}

func testHPATargetingReplicaSetWithEmptyLabelFallback(t *testing.T) {
	data := k8s.K8sNodeData{ID: "hpa-rs"}
	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"rs-node-id": {ID: "rs-node-id", Type: "ReplicaSet", Data: k8s.K8sNodeData{Label: ""}},
		},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{
			"hpa-rs": {{Source: "hpa-rs", Target: "rs-node-id"}},
		},
	}
	res := generateHPA(data, "hpa-rs", "default", ctx)
	hpa := res.(k8s.HPA)
	if hpa.Spec.ScaleTargetRef.Kind != "ReplicaSet" || hpa.Spec.ScaleTargetRef.Name != "rs-node-id" {
		t.Errorf("Expected scaleTargetRef ReplicaSet/rs-node-id, got %s/%s", hpa.Spec.ScaleTargetRef.Kind, hpa.Spec.ScaleTargetRef.Name)
	}
}

func TestResourceGenerators_DisabledFields(t *testing.T) {
	t.Run("PVC Disabled Fields", testPVCDisabledFields)
	t.Run("Deployment Disabled Replicas", testDeploymentDisabledReplicas)
	t.Run("ReplicaSet Disabled Replicas", testReplicaSetDisabledReplicas)
	t.Run("Service No Target Workload", testServiceNoTargetWorkload)
	t.Run("Ingress No Target Service", testIngressNoTargetService)
	t.Run("HPA No Target Deployment", testHPANoTargetDeployment)
	t.Run("HPA Targeting StatefulSet", testHPATargetingStatefulSet)
	t.Run("HPA Targeting ReplicaSet With Empty Label Fallback", testHPATargetingReplicaSetWithEmptyLabelFallback)
}

func TestResourceGenerators_Ingress(t *testing.T) {
	t.Run("Disabled Settings", func(t *testing.T) {
		data := k8s.K8sNodeData{
			YamlSettings: map[string]bool{
				"path": false,
			},
		}
		res := generateIngress(data, "my-ing", "default", &GenContext{})
		ing := res.(k8s.Ingress)
		if ing.Spec.Rules[0].HTTP.Paths[0].Path != "/" {
			t.Errorf("Expected path '/', got %s", ing.Spec.Rules[0].HTTP.Paths[0].Path)
		}
	})
}

func TestResourceGenerators_Service(t *testing.T) {
	t.Run("Disabled TargetPort", func(t *testing.T) {
		data := k8s.K8sNodeData{
			Port: 80,
			YamlSettings: map[string]bool{
				"targetPort": false,
			},
		}
		res := generateService(data, "my-svc", "default", &GenContext{})
		svc := res.(k8s.Service)
		if svc.Spec.Ports[0].TargetPort != 0 {
			t.Errorf("Expected targetPort 0, got %v", svc.Spec.Ports[0].TargetPort)
		}
	})
}

func TestResourceGenerators_Pod(t *testing.T) {
	t.Run("Disabled Image", func(t *testing.T) {
		data := k8s.K8sNodeData{
			Image: "custom-image",
			YamlSettings: map[string]bool{
				"image": false,
			},
		}
		res := generatePodOrDeployment(data, "my-pod", "default", &GenContext{})
		pod := res.(k8s.Pod)
		if pod.Spec.Containers[0].Image != "nginx:latest" {
			t.Errorf("Expected image nginx:latest, got %s", pod.Spec.Containers[0].Image)
		}
	})

	t.Run("Restart Policy and Resource Limits", func(t *testing.T) {
		data := k8s.K8sNodeData{
			Image:         "redis:alpine",
			RestartPolicy: "OnFailure",
			CpuLimit:      "500m",
			MemoryLimit:   "256Mi",
			ResourceLimits: []k8s.ResourceLimitItem{
				{ID: "rl1"},
			},
		}
		res := generatePodOrDeployment(data, "my-pod", "default", &GenContext{})
		pod := res.(k8s.Pod)
		if pod.Spec.RestartPolicy != "OnFailure" {
			t.Errorf("Expected RestartPolicy OnFailure, got %s", pod.Spec.RestartPolicy)
		}
		if pod.Spec.Containers[0].Resources == nil || pod.Spec.Containers[0].Resources.Limits["cpu"] != "500m" {
			t.Errorf("Expected CPU limit 500m, got %v", pod.Spec.Containers[0].Resources)
		}
	})
}

func TestResourceGenerators_ConfigMap(t *testing.T) {
	t.Run("Disabled Data", func(t *testing.T) {
		data := k8s.K8sNodeData{
			ConfigData: []k8s.ConfigDataItem{{Key: "k", Value: "v"}},
			YamlSettings: map[string]bool{
				"data": false,
			},
		}
		res := generateConfigMap(data, "my-cm", "default")
		cm := res.(k8s.ConfigMap)
		if len(cm.Data) != 0 {
			t.Errorf("Expected empty data, got %v", cm.Data)
		}
	})
}

func TestResourceGenerators_Secret(t *testing.T) {
	t.Run("Disabled Data", func(t *testing.T) {
		data := k8s.K8sNodeData{
			ConfigData: []k8s.ConfigDataItem{{Key: "k", Value: "v"}},
			YamlSettings: map[string]bool{
				"data": false,
			},
		}
		res := generateSecret(data, "my-s", "default")
		s := res.(k8s.Secret)
		if len(s.StringData) != 0 {
			t.Errorf("Expected empty data, got %v", s.StringData)
		}
	})
}

func setupTestContext() *GenContext {
	return &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"svc1": {ID: "svc1", Type: "Service"},
			"dep1": {ID: "dep1", Type: "Deployment", Data: k8s.K8sNodeData{Label: "my-dep"}},
			"pod1": {ID: "pod1", Type: "Pod", Data: k8s.K8sNodeData{Label: "my-pod"}},
			"ing1": {ID: "ing1", Type: "Ingress"},
			"hpa1": {ID: "hpa1", Type: "HPA"},
		},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{
			"svc1": {
				{Source: "svc1", Target: "dep1"},
			},
			"ing1": {
				{Source: "ing1", Target: "svc1"},
			},
			"hpa1": {
				{Source: "hpa1", Target: "dep1"},
			},
		},
	}
}

func TestFindTargetWorkload(t *testing.T) {
	ctx := setupTestContext()

	t.Run("Deployment target", func(t *testing.T) {
		target := findTargetWorkload("svc1", ctx)
		if target == nil || target.ID != "dep1" {
			t.Errorf("Expected target dep1, got %v", target)
		}
	})

	t.Run("Pod target", func(t *testing.T) {
		ctx.sourceEdgeMap["svc1"] = []k8s.FrontendEdge{{Source: "svc1", Target: "pod1"}}
		target := findTargetWorkload("svc1", ctx)
		if target == nil || target.ID != "pod1" {
			t.Errorf("Expected target pod1, got %v", target)
		}
	})

	t.Run("No target", func(t *testing.T) {
		target := findTargetWorkload("non-existent", ctx)
		if target != nil {
			t.Errorf("Expected nil target, got %v", target)
		}
	})
}

func TestFindTargetService(t *testing.T) {
	ctx := setupTestContext()

	t.Run("Success", func(t *testing.T) {
		target := findTargetService("ing1", ctx)
		if target == nil || target.ID != "svc1" {
			t.Errorf("Expected target svc1, got %v", target)
		}
	})

	t.Run("No target", func(t *testing.T) {
		target := findTargetService("non-existent", ctx)
		if target != nil {
			t.Errorf("Expected nil target, got %v", target)
		}
	})
}

func TestFindTargetScaleWorkload(t *testing.T) {
	ctx := setupTestContext()
	ctx.nodeMap["ss1"] = &k8s.FrontendNode{ID: "ss1", Type: "StatefulSet", Data: k8s.K8sNodeData{Label: "my-ss"}}
	ctx.nodeMap["rs1"] = &k8s.FrontendNode{ID: "rs1", Type: "ReplicaSet", Data: k8s.K8sNodeData{Label: "my-rs"}}
	ctx.nodeMap["hpa-ss"] = &k8s.FrontendNode{ID: "hpa-ss", Type: "HPA"}
	ctx.nodeMap["hpa-rs"] = &k8s.FrontendNode{ID: "hpa-rs", Type: "HPA"}
	ctx.sourceEdgeMap["hpa-ss"] = []k8s.FrontendEdge{{Source: "hpa-ss", Target: "ss1"}}
	ctx.sourceEdgeMap["hpa-rs"] = []k8s.FrontendEdge{{Source: "hpa-rs", Target: "rs1"}}

	t.Run("Deployment target", func(t *testing.T) {
		target := findTargetScaleWorkload("hpa1", ctx)
		if target == nil || target.ID != "dep1" {
			t.Errorf("Expected target dep1, got %v", target)
		}
	})

	t.Run("StatefulSet target", func(t *testing.T) {
		target := findTargetScaleWorkload("hpa-ss", ctx)
		if target == nil || target.ID != "ss1" || target.Type != "StatefulSet" {
			t.Errorf("Expected target ss1 StatefulSet, got %v", target)
		}
	})

	t.Run("ReplicaSet target", func(t *testing.T) {
		target := findTargetScaleWorkload("hpa-rs", ctx)
		if target == nil || target.ID != "rs1" || target.Type != "ReplicaSet" {
			t.Errorf("Expected target rs1 ReplicaSet, got %v", target)
		}
	})

	t.Run("No target", func(t *testing.T) {
		target := findTargetScaleWorkload("non-existent", ctx)
		if target != nil {
			t.Errorf("Expected nil target, got %v", target)
		}
	})
}

func TestIsServiceTargetingIngress(t *testing.T) {
	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"ing1": {ID: "ing1", Type: "Ingress", Data: k8s.K8sNodeData{Label: "ingress-label"}},
			"pod1": {ID: "pod1", Type: "Pod", Data: k8s.K8sNodeData{Label: "app-pod"}},
		},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{
			"svc-edge-ing": {{ID: "e1", Source: "svc-edge-ing", Target: "ing1"}},
			"svc-edge-pod": {{ID: "e2", Source: "svc-edge-pod", Target: "pod1"}},
		},
	}

	t.Run("Non-LoadBalancer service returns false", func(t *testing.T) {
		data := k8s.K8sNodeData{ServiceType: "ClusterIP", IngressTargets: []string{"ing1"}}
		if isServiceTargetingIngress(data, ctx) {
			t.Error("Expected false for non-LoadBalancer service")
		}
	})

	t.Run("LoadBalancer with IngressTargets returns true", func(t *testing.T) {
		data := k8s.K8sNodeData{ServiceType: "LoadBalancer", IngressTargets: []string{"ing1"}}
		if !isServiceTargetingIngress(data, ctx) {
			t.Error("Expected true when IngressTargets is non-empty")
		}
	})

	t.Run("LoadBalancer with Selector matching Ingress Label returns true", func(t *testing.T) {
		data := k8s.K8sNodeData{ServiceType: "LoadBalancer", Selector: "ingress-label"}
		if !isServiceTargetingIngress(data, ctx) {
			t.Error("Expected true when Selector matches Ingress Label")
		}
	})

	t.Run("LoadBalancer with Selector matching Ingress ID returns true", func(t *testing.T) {
		data := k8s.K8sNodeData{ServiceType: "LoadBalancer", Selector: "ing1"}
		if !isServiceTargetingIngress(data, ctx) {
			t.Error("Expected true when Selector matches Ingress ID")
		}
	})

	t.Run("LoadBalancer connected via edge to Ingress returns true", func(t *testing.T) {
		data := k8s.K8sNodeData{ID: "svc-edge-ing", ServiceType: "LoadBalancer"}
		if !isServiceTargetingIngress(data, ctx) {
			t.Error("Expected true when connected via sourceEdgeMap to Ingress")
		}
	})

	t.Run("LoadBalancer connected to non-Ingress returns false", func(t *testing.T) {
		data := k8s.K8sNodeData{ID: "svc-edge-pod", ServiceType: "LoadBalancer"}
		if isServiceTargetingIngress(data, ctx) {
			t.Error("Expected false when connected to Pod")
		}
	})
}

func TestDetermineServiceSelector(t *testing.T) {
	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"ing1": {ID: "ing1", Type: "Ingress", Data: k8s.K8sNodeData{Label: "ing-lbl"}},
		},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{
			"lb-ing": {{ID: "e1", Source: "lb-ing", Target: "ing1"}},
		},
	}

	t.Run("Targeting Ingress returns nginx ingress selector", func(t *testing.T) {
		data := k8s.K8sNodeData{ID: "lb-ing", ServiceType: "LoadBalancer"}
		sel := determineServiceSelector(data, nil, ctx)
		if sel["app.kubernetes.io/name"] != "ingress-nginx" {
			t.Errorf("Expected ingress-nginx selector, got %v", sel)
		}
	})

	t.Run("Explicit Selector returns app label", func(t *testing.T) {
		data := k8s.K8sNodeData{ServiceType: "ClusterIP", Selector: "custom-app"}
		sel := determineServiceSelector(data, nil, ctx)
		if sel["app"] != "custom-app" {
			t.Errorf("Expected app: custom-app, got %v", sel)
		}
	})

	t.Run("Target workload returns workload label", func(t *testing.T) {
		data := k8s.K8sNodeData{ServiceType: "ClusterIP"}
		workload := &k8s.FrontendNode{Data: k8s.K8sNodeData{Label: "workload-app"}}
		sel := determineServiceSelector(data, workload, ctx)
		if sel["app"] != "workload-app" {
			t.Errorf("Expected app: workload-app, got %v", sel)
		}
	})

	t.Run("Fallback when no target and no selector", func(t *testing.T) {
		data := k8s.K8sNodeData{ServiceType: "ClusterIP"}
		sel := determineServiceSelector(data, nil, ctx)
		if sel["app"] != "app-label" {
			t.Errorf("Expected fallback app: app-label, got %v", sel)
		}
	})
}

func TestDetermineNodePort(t *testing.T) {
	t.Run("NodePort service with port returns port", func(t *testing.T) {
		data := k8s.K8sNodeData{NodePort: 30080}
		if port := determineNodePort(data, "NodePort"); port != 30080 {
			t.Errorf("Expected 30080, got %d", port)
		}
	})

	t.Run("LoadBalancer service with port returns port", func(t *testing.T) {
		data := k8s.K8sNodeData{NodePort: 31080}
		if port := determineNodePort(data, "LoadBalancer"); port != 31080 {
			t.Errorf("Expected 31080, got %d", port)
		}
	})

	t.Run("ClusterIP service ignores nodePort", func(t *testing.T) {
		data := k8s.K8sNodeData{NodePort: 30080}
		if port := determineNodePort(data, "ClusterIP"); port != 0 {
			t.Errorf("Expected 0, got %d", port)
		}
	})

	t.Run("Disabled yamlSettings returns 0", func(t *testing.T) {
		data := k8s.K8sNodeData{
			NodePort:     30080,
			YamlSettings: map[string]bool{"nodePort": false},
		}
		if port := determineNodePort(data, "NodePort"); port != 0 {
			t.Errorf("Expected 0 when yamlSettings disabled, got %d", port)
		}
	})

	t.Run("Out of range nodePort (< 30000 or > 32767) returns 0", func(t *testing.T) {
		tooLowData := k8s.K8sNodeData{NodePort: 8080}
		if port := determineNodePort(tooLowData, "NodePort"); port != 0 {
			t.Errorf("Expected 0 for nodePort 8080, got %d", port)
		}

		tooHighData := k8s.K8sNodeData{NodePort: 40000}
		if port := determineNodePort(tooHighData, "NodePort"); port != 0 {
			t.Errorf("Expected 0 for nodePort 40000, got %d", port)
		}
	})
}

func TestGenerateIngress_Advanced(t *testing.T) {
	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"svc-backend": {
				ID:   "svc-backend",
				Type: "Service",
				Data: k8s.K8sNodeData{Label: "backend-svc", Port: 8080},
			},
		},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{
			"ing-advanced": {{ID: "e1", Source: "ing-advanced", Target: "svc-backend"}},
		},
	}

	t.Run("Explicit BackendServiceName and ServicePort", func(t *testing.T) {
		data := k8s.K8sNodeData{
			BackendServiceName: "custom-svc",
			ServicePort:        9090,
			IngressHost:        "api.example.com",
			IngressPath:        "/v1",
		}
		res := generateIngress(data, "ing-custom", "prod", ctx)
		ing := res.(k8s.Ingress)
		rule := ing.Spec.Rules[0]
		if rule.Host != "api.example.com" {
			t.Errorf("Expected host api.example.com, got %s", rule.Host)
		}
		path := rule.HTTP.Paths[0]
		if path.Path != "/v1" {
			t.Errorf("Expected path /v1, got %s", path.Path)
		}
		if path.Backend.Service.Name != "custom-svc" || path.Backend.Service.Port.Number != 9090 {
			t.Errorf("Expected backend custom-svc:9090, got %s:%d", path.Backend.Service.Name, path.Backend.Service.Port.Number)
		}
	})

	t.Run("Connected Service fallback for Name and Port", func(t *testing.T) {
		data := k8s.K8sNodeData{ID: "ing-advanced"}
		res := generateIngress(data, "ing-advanced", "default", ctx)
		ing := res.(k8s.Ingress)
		path := ing.Spec.Rules[0].HTTP.Paths[0]
		if path.Backend.Service.Name != "backend-svc" || path.Backend.Service.Port.Number != 8080 {
			t.Errorf("Expected backend backend-svc:8080 from connected service, got %s:%d", path.Backend.Service.Name, path.Backend.Service.Port.Number)
		}
	})
}

func TestGetGenerator_Unregistered(t *testing.T) {
	factory := NewResourceGeneratorFactory()
	gen, ok := factory.GetGenerator("NonExistentKind")
	if ok || gen != nil {
		t.Errorf("Expected nil, false for unregistered kind, got %v, %v", gen, ok)
	}
}

func testAutoEnforceClusterIPNoneEdge(t *testing.T) {
	rep := 2
	ssNode := &k8s.FrontendNode{
		ID:   "ss1",
		Type: "StatefulSet",
		Data: k8s.K8sNodeData{ID: "ss1", Label: "mysql-db", Replicas: &rep},
	}
	svcNode := &k8s.FrontendNode{
		ID:   "svc1",
		Type: "Service",
		Data: k8s.K8sNodeData{ID: "svc1", Label: "mysql-service", ServiceType: "ClusterIP"},
	}

	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"ss1":  ssNode,
			"svc1": svcNode,
		},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{
			"svc1": {{Source: "svc1", Target: "ss1"}},
		},
		targetEdgeMap: map[string][]k8s.FrontendEdge{
			"ss1": {{Source: "svc1", Target: "ss1"}},
		},
	}

	resSvc := generateService(svcNode.Data, "mysql-service", "default", ctx)
	svc, ok := resSvc.(k8s.Service)
	if !ok {
		t.Fatalf("Expected Service, got %v", resSvc)
	}
	if svc.Spec.Type != "ClusterIP" || svc.Spec.ClusterIP != "None" {
		t.Errorf("Expected auto-governed Headless Service (ClusterIP: None), got Type=%s, ClusterIP=%s", svc.Spec.Type, svc.Spec.ClusterIP)
	}

	resSS := generateStatefulSet(ssNode.Data, "mysql-db", "default", ctx)
	ss, okSS := resSS.(k8s.StatefulSet)
	if !okSS {
		t.Fatalf("Expected StatefulSet, got %v", resSS)
	}
	if ss.Spec.ServiceName != "mysql-service" {
		t.Errorf("Expected StatefulSet ServiceName to resolve to mysql-service, got %s", ss.Spec.ServiceName)
	}
}

func testAutoEnforceClusterIPNoneSelector(t *testing.T) {
	rep := 3
	ssNode := &k8s.FrontendNode{
		ID:   "ss-redis",
		Type: "StatefulSet",
		Data: k8s.K8sNodeData{ID: "ss-redis", Label: "redis-cluster", Replicas: &rep},
	}
	svcNode := &k8s.FrontendNode{
		ID:   "svc-redis",
		Type: "Service",
		Data: k8s.K8sNodeData{ID: "svc-redis", Label: "redis-hs", Selector: "redis-cluster"},
	}

	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"ss-redis":  ssNode,
			"svc-redis": svcNode,
		},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{},
		targetEdgeMap: map[string][]k8s.FrontendEdge{},
	}

	resSvc := generateService(svcNode.Data, "redis-hs", "default", ctx)
	svc := resSvc.(k8s.Service)
	if svc.Spec.ClusterIP != "None" {
		t.Errorf("Expected selector-targeted StatefulSet Service to have ClusterIP: None, got %s", svc.Spec.ClusterIP)
	}

	resSS := generateStatefulSet(ssNode.Data, "redis-cluster", "default", ctx)
	ss := resSS.(k8s.StatefulSet)
	if ss.Spec.ServiceName != "redis-hs" {
		t.Errorf("Expected StatefulSet ServiceName to resolve to redis-hs via selector, got %s", ss.Spec.ServiceName)
	}
}

func testStatefulSetPrefersHeadless(t *testing.T) {
	rep := 1
	ssNode := &k8s.FrontendNode{
		ID:   "ss-web",
		Type: "StatefulSet",
		Data: k8s.K8sNodeData{ID: "ss-web", Label: "web-ss", Replicas: &rep},
	}
	regularSvc := &k8s.FrontendNode{
		ID:   "svc-lb",
		Type: "Service",
		Data: k8s.K8sNodeData{ID: "svc-lb", Label: "web-lb", ServiceType: "LoadBalancer"},
	}
	headlessSvc := &k8s.FrontendNode{
		ID:   "svc-headless",
		Type: "Service",
		Data: k8s.K8sNodeData{ID: "svc-headless", Label: "web-headless", ServiceType: "Headless"},
	}

	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"ss-web":       ssNode,
			"svc-lb":       regularSvc,
			"svc-headless": headlessSvc,
		},
		targetEdgeMap: map[string][]k8s.FrontendEdge{
			"ss-web": {
				{Source: "svc-lb", Target: "ss-web"},
				{Source: "svc-headless", Target: "ss-web"},
			},
		},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{},
	}

	resSS := generateStatefulSet(ssNode.Data, "web-ss", "default", ctx)
	ss := resSS.(k8s.StatefulSet)
	if ss.Spec.ServiceName != "web-headless" {
		t.Errorf("Expected StatefulSet to prefer web-headless, got %s", ss.Spec.ServiceName)
	}
}

func testStatefulSetRespectsExplicitAndDisabledYaml(t *testing.T) {
	rep := 1
	ssData := k8s.K8sNodeData{
		ID:                 "ss-custom",
		Label:              "custom-ss",
		Replicas:           &rep,
		BackendServiceName: "explicit-gov-svc",
	}
	resSS := generateStatefulSet(ssData, "custom-ss", "default", &GenContext{
		nodeMap:       map[string]*k8s.FrontendNode{"ss-custom": {ID: "ss-custom", Data: ssData}},
		targetEdgeMap: map[string][]k8s.FrontendEdge{},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{},
	})
	ss := resSS.(k8s.StatefulSet)
	if ss.Spec.ServiceName != "explicit-gov-svc" {
		t.Errorf("Expected explicit-gov-svc, got %s", ss.Spec.ServiceName)
	}

	svcData := k8s.K8sNodeData{
		ServiceType: "Headless",
		YamlSettings: map[string]bool{
			"clusterIP": false,
		},
	}
	resSvc := generateService(svcData, "my-svc", "default", &GenContext{})
	svc := resSvc.(k8s.Service)
	if svc.Spec.ClusterIP != "" {
		t.Errorf("Expected empty ClusterIP when disabled in yamlSettings, got %s", svc.Spec.ClusterIP)
	}
}

func TestResourceGenerators_StatefulSetAndHeadlessServiceValidation(t *testing.T) {
	t.Run("Auto-enforce ClusterIP None when Service with default ClusterIP targets StatefulSet via edge", testAutoEnforceClusterIPNoneEdge)
	t.Run("Auto-enforce ClusterIP None when Service targets StatefulSet via selector", testAutoEnforceClusterIPNoneSelector)
	t.Run("StatefulSet serviceName prefers Headless service when multiple services exist", testStatefulSetPrefersHeadless)
	t.Run("StatefulSet serviceName respects explicit backendServiceName and disabled clusterIP yaml setting", testStatefulSetRespectsExplicitAndDisabledYaml)
}

func TestStatefulSetTargetingHelpers(t *testing.T) {
	ctx := &GenContext{
		nodeMap: map[string]*k8s.FrontendNode{
			"ss-1": {
				ID:   "ss-1",
				Type: "StatefulSet",
				Data: k8s.K8sNodeData{Label: "database"},
			},
			"pod-child": {
				ID:       "pod-child",
				Type:     "Pod",
				ParentID: "ss-1",
				Data:     k8s.K8sNodeData{Label: "database-0"},
			},
			"pod-other": {
				ID:       "pod-other",
				Type:     "Pod",
				ParentID: "dep-other",
				Data:     k8s.K8sNodeData{Label: "web-0"},
			},
			"dep-other": {
				ID:   "dep-other",
				Type: "Deployment",
				Data: k8s.K8sNodeData{Label: "web"},
			},
			"svc-1": {
				ID:   "svc-1",
				Type: "Service",
				Data: k8s.K8sNodeData{ID: "svc-1", Label: "db-svc"},
			},
		},
		targetEdgeMap: map[string][]k8s.FrontendEdge{
			"svc-1": {{Source: "ss-1", Target: "svc-1"}},
		},
		sourceEdgeMap: map[string][]k8s.FrontendEdge{
			"svc-1": {{Source: "svc-1", Target: "ss-1"}},
		},
	}

	// isStatefulSetWorkload
	if isStatefulSetWorkload(nil, ctx) {
		t.Error("Expected nil node to return false")
	}
	if !isStatefulSetWorkload(ctx.nodeMap["ss-1"], ctx) {
		t.Error("Expected StatefulSet node to return true")
	}
	if !isStatefulSetWorkload(ctx.nodeMap["pod-child"], ctx) {
		t.Error("Expected child pod of StatefulSet to return true")
	}
	if isStatefulSetWorkload(ctx.nodeMap["pod-other"], ctx) {
		t.Error("Expected child pod of Deployment to return false")
	}

	// isTargetingViaEdges
	if !isTargetingViaEdges("svc-1", ctx) {
		t.Error("Expected svc-1 to target StatefulSet via edges")
	}
	if isTargetingViaEdges("dep-other", ctx) {
		t.Error("Expected dep-other not to target StatefulSet via edges")
	}
	// Test sourceEdgeMap only branch
	ctx.targetEdgeMap["svc-source-only"] = nil
	ctx.sourceEdgeMap["svc-source-only"] = []k8s.FrontendEdge{{Source: "svc-source-only", Target: "ss-1"}}
	if !isTargetingViaEdges("svc-source-only", ctx) {
		t.Error("Expected svc-source-only to target StatefulSet via outgoing source edge")
	}

	// isTargetingViaSelector
	if isTargetingViaSelector("", ctx) {
		t.Error("Expected empty selector to return false")
	}
	if !isTargetingViaSelector("database", ctx) {
		t.Error("Expected matching label database to return true")
	}
	if !isTargetingViaSelector("ss-1", ctx) {
		t.Error("Expected matching ID ss-1 to return true")
	}
	if isTargetingViaSelector("non-existent-sel", ctx) {
		t.Error("Expected non-existent selector to return false")
	}

	// isTargetingStatefulSet
	svcData := k8s.K8sNodeData{ID: "svc-1"}
	if !isTargetingStatefulSet(svcData, ctx.nodeMap["ss-1"], ctx) {
		t.Error("Expected isTargetingStatefulSet with direct targetWorkload to return true")
	}
	if !isTargetingStatefulSet(svcData, nil, ctx) {
		t.Error("Expected isTargetingStatefulSet via edge to return true")
	}
}

func TestIsMatchingServiceSelector(t *testing.T) {
	ssNode := &k8s.FrontendNode{
		ID:   "ss-db",
		Data: k8s.K8sNodeData{Label: "postgres-db"},
	}

	// Empty selector -> false
	emptySvc := &k8s.FrontendNode{Data: k8s.K8sNodeData{Selector: ""}}
	if isMatchingServiceSelector(emptySvc, ssNode, "fallback") {
		t.Error("Expected empty selector to return false")
	}

	// Match by ID
	idSvc := &k8s.FrontendNode{Data: k8s.K8sNodeData{Selector: "ss-db"}}
	if !isMatchingServiceSelector(idSvc, ssNode, "fallback") {
		t.Error("Expected match by ssNode ID")
	}

	// Match by fallbackName
	fallbackSvc := &k8s.FrontendNode{Data: k8s.K8sNodeData{Selector: "my-stateful-app"}}
	if !isMatchingServiceSelector(fallbackSvc, ssNode, "my-stateful-app") {
		t.Error("Expected match by fallbackName")
	}

	// Match by Label
	labelSvc := &k8s.FrontendNode{Data: k8s.K8sNodeData{Selector: "postgres-db"}}
	if !isMatchingServiceSelector(labelSvc, ssNode, "other") {
		t.Error("Expected match by ssNode Label")
	}

	// No match
	noMatchSvc := &k8s.FrontendNode{Data: k8s.K8sNodeData{Selector: "redis"}}
	if isMatchingServiceSelector(noMatchSvc, ssNode, "fallback") {
		t.Error("Expected no match for unrelated selector")
	}
}
