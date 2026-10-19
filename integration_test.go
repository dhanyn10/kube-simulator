package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

// setupIntegrationEnvironment configures an isolated filesystem environment
// for end-to-end integration testing of App with real SQLite and BadgerDB instances.
func setupIntegrationEnvironment(t *testing.T) (*App, string, func()) {
	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")

	tmpDir, err := os.MkdirTemp("", "kube-sim-integration-*")
	if err != nil {
		t.Fatalf("Failed to create temporary integration directory: %v", err)
	}

	os.Setenv("HOME", tmpDir)
	os.Setenv("USERPROFILE", tmpDir)

	app := NewApp()
	ctx := context.WithValue(context.Background(), isTestKey, true)
	app.startup(ctx)

	cleanup := func() {
		app.shutdown(context.Background())
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
		_ = os.RemoveAll(tmpDir)
	}

	return app, tmpDir, cleanup
}

func TestIntegration_ProjectLifecycleAndPersistence(t *testing.T) {
	app, tmpDir, cleanup := setupIntegrationEnvironment(t)
	defer cleanup()

	sampleCanvas := `{"nodes":[{"id":"node-1","type":"Pod"}],"edges":[]}`
	updatedCanvas := `{"nodes":[{"id":"node-1","type":"Pod"},{"id":"node-2","type":"Service"}],"edges":[{"id":"e1-2","source":"node-2","target":"node-1"}]}`

	// Step 1: Save new project
	projID := app.SaveProject("Production Architecture", sampleCanvas)
	if projID <= 0 {
		t.Fatalf("Expected positive project ID, got %d", projID)
	}

	// Step 2: Verify physical project file was created
	expectedPhysicalFile := filepath.Join(tmpDir, ".kube-simulator", "projects", fmt.Sprintf("project_%d.infra", projID))
	fileBytes, err := os.ReadFile(expectedPhysicalFile)
	if err != nil {
		t.Fatalf("Physical project file was not written to disk: %v", err)
	}
	if string(fileBytes) != sampleCanvas {
		t.Errorf("Physical file content mismatch: expected %s, got %s", sampleCanvas, string(fileBytes))
	}

	// Step 3: Load project from SQLite
	loaded := app.LoadProject(projID)
	if loaded == nil || loaded.Name != "Production Architecture" || loaded.Content != sampleCanvas {
		t.Fatalf("Loaded project does not match saved data: %+v", loaded)
	}

	// Step 4: Update project
	time.Sleep(10 * time.Millisecond)
	if !app.UpdateProject(projID, updatedCanvas) {
		t.Fatal("Failed to update project")
	}

	updatedLoaded := app.LoadProject(projID)
	if updatedLoaded == nil || updatedLoaded.Content != updatedCanvas {
		t.Fatalf("Updated project content mismatch: %+v", updatedLoaded)
	}

	// Step 5: Verify physical project file was updated
	updatedFileBytes, err := os.ReadFile(expectedPhysicalFile)
	if err != nil || string(updatedFileBytes) != updatedCanvas {
		t.Fatalf("Physical file did not reflect update: %v, content=%s", err, string(updatedFileBytes))
	}

	// Step 6: Verify Project List
	projects := app.GetProjects()
	if len(projects) != 1 || projects[0].ID != projID {
		t.Fatalf("Expected exactly 1 project in list, got %+v", projects)
	}

	// Step 7: Export to .infra bundle file
	exportPath := filepath.Join(tmpDir, "exported-arch.infra")
	exportCtx := context.WithValue(context.WithValue(context.Background(), isTestKey, true), testFilePathKey, exportPath)
	appCtx = exportCtx
	defer func() { appCtx = nil }()

	if !app.ExportProjectFile("Production Architecture", updatedCanvas, "kind: Pod\n---") {
		t.Fatal("ExportProjectFile failed")
	}

	// Step 8: Read and validate exported bundle
	bundleBytes, err := os.ReadFile(exportPath)
	if err != nil {
		t.Fatalf("Failed to read exported bundle: %v", err)
	}
	var bundleData map[string]string
	if err := json.Unmarshal(bundleBytes, &bundleData); err != nil {
		t.Fatalf("Exported bundle is not valid JSON: %v", err)
	}
	if bundleData["name"] != "Production Architecture" || bundleData["canvas"] != updatedCanvas {
		t.Errorf("Exported bundle content mismatch: %+v", bundleData)
	}

	// Step 9: Import bundle
	importedStr := app.ImportProjectFile()
	if importedStr != string(bundleBytes) {
		t.Errorf("ImportProjectFile output does not match exported file")
	}

	// Step 10: Delete project
	if !app.DeleteProject(projID) {
		t.Fatal("DeleteProject returned false")
	}
	if app.LoadProject(projID) != nil {
		t.Error("Expected project to be nil after deletion")
	}
	if len(app.GetProjects()) != 0 {
		t.Errorf("Expected 0 projects after deletion, got %d", len(app.GetProjects()))
	}
}

func TestIntegration_UndoRedoBranchingHistory(t *testing.T) {
	app, _, cleanup := setupIntegrationEnvironment(t)
	defer cleanup()

	state0 := `{"actionName": "Initialize Canvas", "timestamp": 1000, "data": "empty"}`
	state1 := `{"actionName": "Add Namespace", "timestamp": 2000, "data": "ns-prod"}`
	state2 := `{"actionName": "Add Deployment", "timestamp": 3000, "data": "deploy-api"}`
	state3 := `{"actionName": "Add Service", "timestamp": 4000, "data": "svc-api"}`

	// 1. Push incremental actions
	app.PushHistory(state0)
	app.PushHistory(state1)
	app.PushHistory(state2)
	app.PushHistory(state3)

	if app.GetCurrentHistoryIndex() != 3 {
		t.Errorf("Expected history index 3, got %d", app.GetCurrentHistoryIndex())
	}

	logs := app.GetHistoryLogs()
	if len(logs) != 4 {
		t.Fatalf("Expected 4 history logs, got %d", len(logs))
	}
	if logs[3].ActionName != "Add Service" {
		t.Errorf("Expected last log to be 'Add Service', got '%s'", logs[3].ActionName)
	}

	// 2. Perform step-by-step undo
	undone3 := app.Undo()
	if undone3 != state2 {
		t.Errorf("Undo 1 expected state2, got '%s'", undone3)
	}
	undone2 := app.Undo()
	if undone2 != state1 {
		t.Errorf("Undo 2 expected state1, got '%s'", undone2)
	}

	// 3. Jump to history index 0
	jumped := app.JumpToHistory(0)
	if jumped != state0 {
		t.Errorf("JumpToHistory(0) expected state0, got '%s'", jumped)
	}
	if app.GetCurrentHistoryIndex() != 0 {
		t.Errorf("Expected current history index 0 after jump, got %d", app.GetCurrentHistoryIndex())
	}

	// 4. Redo back to state 1
	redone1 := app.Redo()
	if redone1 != state1 {
		t.Errorf("Redo expected state1, got '%s'", redone1)
	}

	// 5. Branching history: push state2b while at index 1
	state2b := `{"actionName": "Add StatefulSet", "timestamp": 5000, "data": "statefulset-db"}`
	app.PushHistory(state2b)

	branchLogs := app.GetHistoryLogs()
	if len(branchLogs) != 3 {
		t.Fatalf("Expected 3 logs after branching history, got %d", len(branchLogs))
	}
	if branchLogs[2].ActionName != "Add StatefulSet" {
		t.Errorf("Expected branch head to be 'Add StatefulSet', got '%s'", branchLogs[2].ActionName)
	}
}

// buildCompleteK8sArchitecturePayload builds a realistic multi-resource
// canvas topology containing Namespace, Ingress, Service, Deployment,
// ConfigMap, Secret, PVC, and HPA.
func buildCompleteK8sArchitecturePayload() (string, string) {
	replicas := 3
	minReplicas := 2
	maxReplicas := 8
	targetCPU := 75

	nodes := []map[string]interface{}{
		{
			"id":   "ns-1",
			"type": "Namespace",
			"data": map[string]interface{}{
				"id":    "ns-1",
				"label": "Production E-Commerce",
				"type":  "Namespace",
			},
		},
		{
			"id":       "cm-1",
			"type":     "ConfigMap",
			"parentId": "ns-1",
			"data": map[string]interface{}{
				"id":    "cm-1",
				"label": "API Config",
				"type":  "ConfigMap",
				"configData": []map[string]string{
					{"key": "APP_ENV", "value": "production"},
					{"key": "LOG_LEVEL", "value": "info"},
				},
			},
		},
		{
			"id":       "sec-1",
			"type":     "Secret",
			"parentId": "ns-1",
			"data": map[string]interface{}{
				"id":    "sec-1",
				"label": "DB Credentials",
				"type":  "Secret",
				"configData": []map[string]string{
					{"key": "DB_PASSWORD", "value": "supersecretpassword"},
				},
			},
		},
		{
			"id":       "pvc-1",
			"type":     "PVC",
			"parentId": "ns-1",
			"data": map[string]interface{}{
				"id":              "pvc-1",
				"label":           "App Storage",
				"type":            "PVC",
				"storageCapacity": "20Gi",
				"accessMode":      "ReadWriteOnce",
			},
		},
		{
			"id":       "dep-1",
			"type":     "Deployment",
			"parentId": "ns-1",
			"data": map[string]interface{}{
				"id":            "dep-1",
				"label":         "API Deployment",
				"type":          "Deployment",
				"replicas":      replicas,
				"image":         "myregistry.io/api:v2.0",
				"port":          8080,
				"cpuRequest":    "250m",
				"cpuLimit":      "500m",
				"memoryRequest": "256Mi",
				"memoryLimit":   "512Mi",
			},
		},
		{
			"id":       "svc-1",
			"type":     "Service",
			"parentId": "ns-1",
			"data": map[string]interface{}{
				"id":          "svc-1",
				"label":       "API Service",
				"type":        "Service",
				"serviceType": "ClusterIP",
				"port":        80,
				"targetPort":  8080,
			},
		},
		{
			"id":       "ing-1",
			"type":     "Ingress",
			"parentId": "ns-1",
			"data": map[string]interface{}{
				"id":                 "ing-1",
				"label":              "Public Ingress",
				"type":               "Ingress",
				"ingressHost":        "api.example.com",
				"ingressPath":        "/v1",
				"backendServiceName": "api-service",
				"servicePort":        80,
			},
		},
		{
			"id":       "hpa-1",
			"type":     "HPA",
			"parentId": "ns-1",
			"data": map[string]interface{}{
				"id":          "hpa-1",
				"label":       "API Autoscaler",
				"type":        "HPA",
				"minReplicas": minReplicas,
				"maxReplicas": maxReplicas,
				"targetCPU":   targetCPU,
			},
		},
	}

	edges := []map[string]interface{}{
		{"id": "e-ing-svc", "source": "ing-1", "target": "svc-1"},
		{"id": "e-svc-dep", "source": "svc-1", "target": "dep-1"},
		{"id": "e-dep-cm", "source": "dep-1", "target": "cm-1"},
		{"id": "e-dep-sec", "source": "dep-1", "target": "sec-1"},
		{"id": "e-dep-pvc", "source": "dep-1", "target": "pvc-1"},
		{"id": "e-hpa-dep", "source": "hpa-1", "target": "dep-1"},
	}

	nodesBytes, _ := json.Marshal(nodes)
	edgesBytes, _ := json.Marshal(edges)
	return string(nodesBytes), string(edgesBytes)
}

func TestIntegration_FullArchitectureYamlPipeline(t *testing.T) {
	app, _, cleanup := setupIntegrationEnvironment(t)
	defer cleanup()

	nodesJson, edgesJson := buildCompleteK8sArchitecturePayload()

	// Execute GenerateYaml through App IPC method
	yamlResult := app.GenerateYaml(nodesJson, edgesJson)
	if yamlResult == "" {
		t.Fatal("GenerateYaml returned empty string")
	}

	var manifests []map[string]interface{}
	if err := json.Unmarshal([]byte(yamlResult), &manifests); err != nil {
		t.Fatalf("GenerateYaml did not return valid JSON array: %v, raw=%s", err, yamlResult)
	}

	// We expect 8 manifests: Namespace, ConfigMap, Secret, PVC, Deployment, Service, Ingress, HPA
	if len(manifests) != 8 {
		t.Fatalf("Expected 8 manifests generated, got %d", len(manifests))
	}

	manifestByKind := make(map[string]map[string]interface{})
	for _, m := range manifests {
		kind, ok := m["kind"].(string)
		if ok {
			manifestByKind[kind] = m
		}
	}

	verifyGeneratedManifests(t, manifestByKind)
}

func verifyGeneratedManifests(t *testing.T, manifests map[string]map[string]interface{}) {
	// 1. Verify Ingress
	ing, ok := manifests["Ingress"]
	if !ok {
		t.Fatal("Ingress manifest missing")
	}
	spec, _ := ing["spec"].(map[string]interface{})
	rules, _ := spec["rules"].([]interface{})
	if len(rules) == 0 {
		t.Fatal("Ingress has no rules defined")
	}
	rule0, _ := rules[0].(map[string]interface{})
	if rule0["host"] != "api.example.com" {
		t.Errorf("Ingress host mismatch, got %v", rule0["host"])
	}

	// 2. Verify Deployment
	dep, ok := manifests["Deployment"]
	if !ok {
		t.Fatal("Deployment manifest missing")
	}
	depSpec, _ := dep["spec"].(map[string]interface{})
	if replicas, ok := depSpec["replicas"].(float64); !ok || int(replicas) != 3 {
		t.Errorf("Deployment replicas mismatch: %v", depSpec["replicas"])
	}

	// 3. Verify HPA
	hpa, ok := manifests["HorizontalPodAutoscaler"]
	if !ok {
		t.Fatal("HorizontalPodAutoscaler manifest missing")
	}
	hpaSpec, _ := hpa["spec"].(map[string]interface{})
	targetRef, _ := hpaSpec["scaleTargetRef"].(map[string]interface{})
	if targetRef["kind"] != "Deployment" || targetRef["name"] != "api-deployment" {
		t.Errorf("HPA scaleTargetRef mismatch: %+v", targetRef)
	}

	// 4. Verify PVC
	pvc, ok := manifests["PersistentVolumeClaim"]
	if !ok {
		t.Fatal("PersistentVolumeClaim manifest missing")
	}
	pvcSpec, _ := pvc["spec"].(map[string]interface{})
	resources, _ := pvcSpec["resources"].(map[string]interface{})
	requests, _ := resources["requests"].(map[string]interface{})
	if requests["storage"] != "20Gi" {
		t.Errorf("PVC storage request mismatch: %v", requests["storage"])
	}
}

func TestIntegration_ConcurrentOperationsUnderLoad(t *testing.T) {
	app, _, cleanup := setupIntegrationEnvironment(t)
	defer cleanup()

	const workerCount = 10
	var wg sync.WaitGroup

	// Concurrently save settings, projects, and push history
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()

			// Save and read setting
			key := fmt.Sprintf("setting-%d", workerID)
			val := fmt.Sprintf("val-%d", workerID)
			if !app.SaveSetting(key, val) {
				t.Errorf("Worker %d failed to save setting", workerID)
			}
			if app.GetSetting(key) != val {
				t.Errorf("Worker %d setting mismatch", workerID)
			}

			// Save and load project
			projName := fmt.Sprintf("Concurrent Project %d", workerID)
			id := app.SaveProject(projName, fmt.Sprintf(`{"id": %d}`, workerID))
			if id <= 0 {
				t.Errorf("Worker %d failed to save project", workerID)
			}
			loaded := app.LoadProject(id)
			if loaded == nil || loaded.Name != projName {
				t.Errorf("Worker %d loaded project mismatch", workerID)
			}

			// Push history
			app.PushHistory(fmt.Sprintf(`{"actionName": "Action-%d", "timestamp": %d}`, workerID, time.Now().UnixNano()))
		}(i)
	}

	wg.Wait()

	projects := app.GetProjects()
	if len(projects) != workerCount {
		t.Errorf("Expected %d projects after concurrent writes, got %d", workerCount, len(projects))
	}

	historyLogs := app.GetHistoryLogs()
	if len(historyLogs) != workerCount {
		t.Errorf("Expected %d history logs after concurrent writes, got %d", workerCount, len(historyLogs))
	}
}
