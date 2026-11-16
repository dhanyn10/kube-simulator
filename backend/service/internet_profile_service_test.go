package service

import (
	"os"
	"path/filepath"
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

	// 7. Test directory with sub-directory, invalid JSON file, and unnamed profile
	dir, _ := svc.GetProfilesDir()
	_ = os.MkdirAll(filepath.Join(dir, "subfolder.json"), 0755)
	_ = os.WriteFile(filepath.Join(dir, "corrupt.json"), []byte("corrupted json data"), 0644)
	_ = os.WriteFile(filepath.Join(dir, "empty_name.json"), []byte(`{"name":""}`), 0644)

	profiles = svc.GetProfiles()
	if len(profiles) != 0 {
		t.Errorf("Expected 0 valid profiles from corrupt/empty entries, got %d", len(profiles))
	}
}

func TestInternetProfileService_SaveDeleteFileErrors(t *testing.T) {
	tmpDir := t.TempDir()
	oldHome := os.Getenv("HOME")
	oldUserProfile := os.Getenv("USERPROFILE")
	os.Setenv("HOME", tmpDir)
	os.Setenv("USERPROFILE", tmpDir)
	defer func() {
		os.Setenv("HOME", oldHome)
		os.Setenv("USERPROFILE", oldUserProfile)
	}()

	svc := NewInternetProfileService()
	dir, err := svc.GetProfilesDir()
	if err != nil {
		t.Fatal(err)
	}

	// 1. MkdirAll error: Create a regular file where profiles dir should be
	testHomeConflict := filepath.Join(tmpDir, "conflict_home")
	_ = os.MkdirAll(testHomeConflict, 0755)
	kubeSimPath := filepath.Join(testHomeConflict, KubeSimulatorDir)
	_ = os.WriteFile(kubeSimPath, []byte("regular file conflict"), 0644)

	os.Setenv("USERPROFILE", testHomeConflict)
	os.Setenv("HOME", testHomeConflict)
	if svc.SaveProfile("Test", `{"name":"Test"}`) {
		t.Error("Expected SaveProfile to return false when profiles directory cannot be created")
	}

	// Reset home
	os.Setenv("USERPROFILE", tmpDir)
	os.Setenv("HOME", tmpDir)
	_ = os.MkdirAll(dir, 0755)

	// 2. WriteFile error: create a directory with the same name as the profile file
	profilePath := svc.GetProfilePath(dir, "DirProfile")
	_ = os.MkdirAll(profilePath, 0755)
	if svc.SaveProfile("DirProfile", `{"name":"DirProfile"}`) {
		t.Error("Expected SaveProfile to return false when target file is a directory")
	}

	// 3. Delete error: target path is a non-empty directory
	_ = os.WriteFile(filepath.Join(profilePath, "nested.txt"), []byte("nested"), 0644)
	if svc.DeleteProfile("DirProfile") {
		t.Error("Expected DeleteProfile to return false when removing non-empty directory")
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
