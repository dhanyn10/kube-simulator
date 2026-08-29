package yaml_gen

import (
	"build-wails/backend/k8s"
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

func TestResourceGenerators_DisabledFields(t *testing.T) {
	t.Run("PVC Disabled Fields", func(t *testing.T) {
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
	})

	t.Run("Deployment Disabled Replicas", func(t *testing.T) {
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
	})

	t.Run("ReplicaSet Disabled Replicas", func(t *testing.T) {
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
	})

	t.Run("Service No Target Workload", func(t *testing.T) {
		data := k8s.K8sNodeData{Port: 80}
		ctx := &GenContext{}
		res := generateService(data, "svc-no-target", "default", ctx)
		svc := res.(k8s.Service)
		if svc.Spec.Selector["app"] != "app-label" {
			t.Errorf("Expected fallback app selector 'app-label', got %s", svc.Spec.Selector["app"])
		}
	})

	t.Run("Ingress No Target Service", func(t *testing.T) {
		data := k8s.K8sNodeData{IngressHost: "test.local"}
		ctx := &GenContext{}
		res := generateIngress(data, "ing-no-target", "default", ctx)
		ing := res.(k8s.Ingress)
		if ing.Spec.Rules[0].HTTP.Paths[0].Backend.Service.Name != "tbd-service" {
			t.Errorf("Expected fallback service name 'tbd-service', got %s", ing.Spec.Rules[0].HTTP.Paths[0].Backend.Service.Name)
		}
	})

	t.Run("HPA No Target Deployment", func(t *testing.T) {
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
		if hpa.Spec.ScaleTargetRef.Name != "tbd-deployment" {
			t.Errorf("Expected fallback scaleTargetRef 'tbd-deployment', got %s", hpa.Spec.ScaleTargetRef.Name)
		}
	})
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

func TestFindTargetDeployment(t *testing.T) {
	ctx := setupTestContext()

	t.Run("Success", func(t *testing.T) {
		target := findTargetDeployment("hpa1", ctx)
		if target == nil || target.ID != "dep1" {
			t.Errorf("Expected target dep1, got %v", target)
		}
	})

	t.Run("No target", func(t *testing.T) {
		target := findTargetDeployment("non-existent", ctx)
		if target != nil {
			t.Errorf("Expected nil target, got %v", target)
		}
	})
}
