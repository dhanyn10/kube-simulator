package service

import (
	"os"
	"testing"
)

func TestInternetProfileService_CRUD(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "kube-profile-test-*")
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

	svc := NewInternetProfileService()

	// 1. Initial list is empty
	profiles := svc.GetProfiles()
	if len(profiles) != 0 {
		t.Errorf("Expected 0 profiles initially, got %d", len(profiles))
	}

	// 2. Save invalid
	if svc.SaveProfile("", "{}") {
		t.Error("Expected false for empty profile name")
	}
	if svc.SaveProfile("Test", "") {
		t.Error("Expected false for empty profile JSON")
	}

	// 3. Save valid
	validJSON := `{"name":"E-Commerce Peak","hourly":{"0":100,"1":120},"daily":{"1":1000}}`
	if !svc.SaveProfile("E-Commerce Peak", validJSON) {
		t.Fatal("Failed to save valid profile")
	}

	// 4. Read back
	profiles = svc.GetProfiles()
	if len(profiles) != 1 {
		t.Fatalf("Expected 1 profile, got %d", len(profiles))
	}
	if profiles[0].Name != "E-Commerce Peak" {
		t.Errorf("Expected profile name 'E-Commerce Peak', got %q", profiles[0].Name)
	}

	// 5. Delete invalid
	if svc.DeleteProfile("") {
		t.Error("Expected false for empty name in DeleteProfile")
	}

	// 6. Delete valid
	if !svc.DeleteProfile("E-Commerce Peak") {
		t.Fatal("Failed to delete profile")
	}

	profiles = svc.GetProfiles()
	if len(profiles) != 0 {
		t.Errorf("Expected 0 profiles after delete, got %d", len(profiles))
	}
}

func TestInternetProfileService_HomeDirFailure(t *testing.T) {
	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	os.Unsetenv("HOME")
	os.Unsetenv("USERPROFILE")
	defer func() {
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
	}()

	svc := NewInternetProfileService()
	if len(svc.GetProfiles()) != 0 {
		t.Error("Expected empty profiles on home dir error")
	}
	if svc.SaveProfile("Name", "{}") {
		t.Error("Expected false on home dir error")
	}
	if svc.DeleteProfile("Name") {
		t.Error("Expected false on home dir error")
	}
}
