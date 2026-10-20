package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"build-wails/backend/pkg/k8s"
	"build-wails/backend/pkg/yaml_gen"
)

// TestContract_FrontendPayloadDeserialization verifies that JSON payloads produced
// by React Flow frontend nodes and edges deserialize cleanly into Go k8s structs.
func TestContract_FrontendPayloadDeserialization(t *testing.T) {
	sampleNodesJSON := `[
		{
			"id": "node-ns-1",
			"type": "Namespace",
			"data": { "id": "node-ns-1", "label": "production", "type": "Namespace" }
		},
		{
			"id": "node-dep-1",
			"type": "Deployment",
			"parentId": "node-ns-1",
			"data": {
				"id": "node-dep-1",
				"label": "web-api",
				"type": "Deployment",
				"image": "nginx:1.25-alpine",
				"replicas": 3,
				"cpuRequest": "100m",
				"cpuLimit": "250m",
				"memoryRequest": "128Mi",
				"memoryLimit": "512Mi",
				"configData": [
					{ "key": "APP_ENV", "value": "prod" },
					{ "key": "PORT", "value": "8080" }
				]
			}
		},
		{
			"id": "node-svc-1",
			"type": "Service",
			"parentId": "node-ns-1",
			"data": {
				"id": "node-svc-1",
				"label": "web-service",
				"type": "Service",
				"serviceType": "NodePort",
				"port": 80,
				"targetPort": 8080,
				"nodePort": 30080,
				"selector": "app=web-api",
				"yamlSettings": { "serviceType": true, "nodePort": true }
			}
		},
		{
			"id": "node-pvc-1",
			"type": "PVC",
			"parentId": "node-ns-1",
			"data": {
				"id": "node-pvc-1",
				"label": "db-storage",
				"type": "PVC",
				"accessMode": "ReadWriteOnce",
				"storageCapacity": "20Gi",
				"storageClass": "fast-ssd"
			}
		},
		{
			"id": "node-hpa-1",
			"type": "HPA",
			"parentId": "node-ns-1",
			"data": {
				"id": "node-hpa-1",
				"label": "web-scaler",
				"type": "HPA",
				"minReplicas": 2,
				"maxReplicas": 10,
				"targetCPU": 80,
				"targetMemory": 75
			}
		}
	]`

	sampleEdgesJSON := `[
		{ "id": "e-svc-dep", "source": "node-svc-1", "target": "node-dep-1" },
		{ "id": "e-hpa-dep", "source": "node-hpa-1", "target": "node-dep-1" }
	]`

	t.Run("Unmarshal into FrontendNode and FrontendEdge", func(t *testing.T) {
		var nodes []k8s.FrontendNode
		if err := json.Unmarshal([]byte(sampleNodesJSON), &nodes); err != nil {
			t.Fatalf("Failed to unmarshal sample nodes JSON: %v", err)
		}

		if len(nodes) != 5 {
			t.Fatalf("Expected 5 nodes, got %d", len(nodes))
		}

		var edges []k8s.FrontendEdge
		if err := json.Unmarshal([]byte(sampleEdgesJSON), &edges); err != nil {
			t.Fatalf("Failed to unmarshal sample edges JSON: %v", err)
		}

		if len(edges) != 2 {
			t.Fatalf("Expected 2 edges, got %d", len(edges))
		}

		// Verify specific field mapping parity
		dep := nodes[1]
		if dep.ParentID != "node-ns-1" {
			t.Errorf("Expected parentId 'node-ns-1', got '%s'", dep.ParentID)
		}
		if dep.Data.Image != "nginx:1.25-alpine" {
			t.Errorf("Expected image 'nginx:1.25-alpine', got '%s'", dep.Data.Image)
		}
		if dep.Data.Replicas == nil || *dep.Data.Replicas != 3 {
			t.Errorf("Expected replicas 3, got %v", dep.Data.Replicas)
		}
		if len(dep.Data.ConfigData) != 2 {
			t.Errorf("Expected 2 configData items, got %d", len(dep.Data.ConfigData))
		}

		svc := nodes[2]
		if svc.Data.ServiceType != "NodePort" {
			t.Errorf("Expected serviceType 'NodePort', got '%s'", svc.Data.ServiceType)
		}
		if svc.Data.Port != 80 || svc.Data.TargetPort != 8080 || svc.Data.NodePort != 30080 {
			t.Errorf("Port mismatch: port=%d targetPort=%d nodePort=%d", svc.Data.Port, svc.Data.TargetPort, svc.Data.NodePort)
		}

		pvc := nodes[3]
		if pvc.Data.StorageCapacity != "20Gi" || pvc.Data.StorageClass != "fast-ssd" {
			t.Errorf("PVC mapping mismatch: capacity=%s class=%s", pvc.Data.StorageCapacity, pvc.Data.StorageClass)
		}

		hpa := nodes[4]
		if hpa.Data.MinReplicas == nil || *hpa.Data.MinReplicas != 2 || hpa.Data.TargetCPU == nil || *hpa.Data.TargetCPU != 80 {
			t.Errorf("HPA mapping mismatch: min=%v cpu=%v", hpa.Data.MinReplicas, hpa.Data.TargetCPU)
		}
	})

	t.Run("Generate Valid Kubernetes YAML from Frontend Contract", func(t *testing.T) {
		yamlOutput := yaml_gen.Generate(sampleNodesJSON, sampleEdgesJSON)
		if strings.TrimSpace(yamlOutput) == "" {
			t.Fatal("Expected non-empty YAML from frontend payload contract")
		}

		// Verify that multi-document JSON manifests contain expected Kubernetes resource kinds
		var manifests []map[string]interface{}
		if err := json.Unmarshal([]byte(yamlOutput), &manifests); err != nil {
			t.Fatalf("Failed to parse Generate output as JSON manifests array: %v\nOutput: %s", err, yamlOutput)
		}

		detectedKinds := make(map[string]bool)
		for _, manifest := range manifests {
			kindVal, ok := manifest["kind"].(string)
			if !ok || kindVal == "" {
				t.Errorf("Manifest missing valid 'kind': %v", manifest)
				continue
			}
			if _, hasApiVersion := manifest["apiVersion"]; !hasApiVersion {
				t.Errorf("Manifest missing 'apiVersion': %v", manifest)
			}
			if _, hasMetadata := manifest["metadata"]; !hasMetadata {
				t.Errorf("Manifest missing 'metadata': %v", manifest)
			}
			detectedKinds[kindVal] = true
		}

		expectedKinds := []string{"Namespace", "Deployment", "Service", "PersistentVolumeClaim", "HorizontalPodAutoscaler"}
		for _, expectedKind := range expectedKinds {
			if !detectedKinds[expectedKind] {
				t.Errorf("Expected manifest to define kind '%s', but not found in: %s", expectedKind, yamlOutput)
			}
		}
	})

	t.Run("App.GenerateYaml IPC Contract and Manifest Format Invariants", func(t *testing.T) {
		app := NewApp()
		manifestJSON := app.GenerateYaml(sampleNodesJSON, sampleEdgesJSON)
		if strings.TrimSpace(manifestJSON) == "" {
			t.Fatal("GenerateYaml returned empty output")
		}

		var items []interface{}
		if err := json.Unmarshal([]byte(manifestJSON), &items); err != nil {
			t.Fatalf("GenerateYaml output is not a valid JSON array: %v", err)
		}
		if len(items) < 3 {
			t.Errorf("Expected at least 3 generated manifests, got %d", len(items))
		}
	})
}

// TestContract_ProjectFileRoundTrip verifies the .infra file persistence contract.
func TestContract_ProjectFileRoundTrip(t *testing.T) {
	app := NewApp()
	tmpDir, err := os.MkdirTemp("", "kube-contract-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "contract-project.infra")
	ctx := context.WithValue(context.Background(), isTestKey, true)
	ctx = context.WithValue(ctx, testFilePathKey, filePath)
	appCtx = ctx
	defer func() { appCtx = nil }()

	canvasContent := `{"nodes":[{"id":"node-1","type":"Pod"}],"edges":[]}`
	yamlContent := "apiVersion: v1\nkind: Pod\nmetadata:\n  name: pod-1\n"

	// 1. Export project file
	ok := app.ExportProjectFile("Production Arch", canvasContent, yamlContent)
	if !ok {
		t.Fatal("ExportProjectFile contract failed")
	}

	// 2. Read and verify JSON structure contract matching App.ExportProjectFile
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("Failed to read exported .infra file: %v", err)
	}

	var parsedProject struct {
		Name   string `json:"name"`
		Canvas string `json:"canvas"`
		YAML   string `json:"yaml"`
	}

	if err := json.Unmarshal(bytes, &parsedProject); err != nil {
		t.Fatalf("Exported .infra file is not valid JSON: %v", err)
	}

	if parsedProject.Name != "Production Arch" {
		t.Errorf("Expected project name 'Production Arch', got '%s'", parsedProject.Name)
	}
	if parsedProject.Canvas != canvasContent {
		t.Errorf("Canvas content mismatch: expected '%s', got '%s'", canvasContent, parsedProject.Canvas)
	}
	if parsedProject.YAML != yamlContent {
		t.Errorf("YAML content mismatch: expected '%s', got '%s'", yamlContent, parsedProject.YAML)
	}

	// 3. Import project file
	imported := app.ImportProjectFile()
	if !strings.Contains(imported, `"name": "Production Arch"`) {
		t.Errorf("ImportProjectFile failed to restore contract payload: %s", imported)
	}
}
