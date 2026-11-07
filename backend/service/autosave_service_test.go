package service

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAutosaveService_GetAndClearProfiles(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "kube-autosave-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	os.Setenv("HOME", tmpDir)
	os.Setenv("USERPROFILE", tmpDir)
	defer func() {
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
	}()

	autosavesDir := filepath.Join(tmpDir, KubeSimulatorDir, "autosaves")
	if err := os.MkdirAll(autosavesDir, 0755); err != nil {
		t.Fatal(err)
	}

	svc := NewAutosaveService()

	// 1. Initially empty
	profiles := svc.GetAutosaveProfiles()
	if len(profiles) != 0 {
		t.Errorf("Expected 0 profiles initially, got %d", len(profiles))
	}

	// 2. Create sample files
	file1 := filepath.Join(autosavesDir, "autosave-1.infra")
	file2 := filepath.Join(autosavesDir, "autosave-2.infra")
	_ = os.WriteFile(file1, []byte(`{"timestamp": 1000}`), 0644)
	_ = os.WriteFile(file2, []byte(`{"timestamp": 2000}`), 0644)
	// non-infra file should be ignored
	_ = os.WriteFile(filepath.Join(autosavesDir, "ignored.txt"), []byte("data"), 0644)

	profiles = svc.GetAutosaveProfiles()
	if len(profiles) != 2 {
		t.Fatalf("Expected 2 profiles, got %d", len(profiles))
	}

	// Verify descending order by timestamp
	if profiles[0].Key != "autosave-2" || profiles[0].Timestamp != 2000 {
		t.Errorf("Expected first profile to be autosave-2 with ts 2000, got %+v", profiles[0])
	}
	if profiles[1].Key != "autosave-1" || profiles[1].Timestamp != 1000 {
		t.Errorf("Expected second profile to be autosave-1 with ts 1000, got %+v", profiles[1])
	}

	// 3. Clear autosaves
	clearedSettings := make(map[string]string)
	ok := svc.ClearAllAutosaves(func(k, v string) error {
		clearedSettings[k] = v
		return nil
	})
	if !ok {
		t.Error("Expected ClearAllAutosaves to succeed")
	}

	if clearedSettings["auto_saved_profile_latest"] != "" || clearedSettings["auto_saved_profile_content"] != "" {
		t.Error("Expected autosave settings to be cleared")
	}

	remaining := svc.GetAutosaveProfiles()
	if len(remaining) != 0 {
		t.Errorf("Expected 0 profiles after clear, got %d", len(remaining))
	}
}

func TestAutosaveService_CorruptedAndEdgeCaseFiles(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "kube-autosave-edge-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	os.Setenv("HOME", tmpDir)
	os.Setenv("USERPROFILE", tmpDir)
	defer func() {
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
	}()

	autosavesDir := filepath.Join(tmpDir, KubeSimulatorDir, "autosaves")
	_ = os.MkdirAll(autosavesDir, 0755)

	// 1. File with invalid JSON
	_ = os.WriteFile(filepath.Join(autosavesDir, "invalid.infra"), []byte("{not-json"), 0644)
	// 2. File with timestamp <= 0
	_ = os.WriteFile(filepath.Join(autosavesDir, "zero-ts.infra"), []byte(`{"timestamp": -1}`), 0644)

	svc := NewAutosaveService()
	profiles := svc.GetAutosaveProfiles()
	if len(profiles) != 2 {
		t.Fatalf("Expected 2 profiles fallback to file ModTime, got %d", len(profiles))
	}
}

func TestAutosaveService_UserHomeError(t *testing.T) {
	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	os.Unsetenv("HOME")
	os.Unsetenv("USERPROFILE")
	defer func() {
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
	}()

	svc := NewAutosaveService()
	profiles := svc.GetAutosaveProfiles()
	if len(profiles) != 0 {
		t.Errorf("Expected 0 profiles when home error, got %d", len(profiles))
	}

	ok := svc.ClearAllAutosaves(nil)
	if ok {
		t.Error("Expected false when home error")
	}
}
