package system

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIsNewer(t *testing.T) {
	tests := []struct {
		latest   string
		current  string
		expected bool
	}{
		{"1.0.1", "1.0.0", true},
		{"1.1.0", "1.0.9", true},
		{"2.0.0", "1.9.9", true},
		{"1.0.0", "1.0.0", false},
		{"1.0.0", "1.0.1", false},
		{"1.0.0-alpha", "1.0.0", false}, // Suffix makes it older than no suffix
		{"1.0.0", "1.0.0-alpha", true},
		{"1.0.0-beta", "1.0.0-alpha", true},
		{"1.0.0-alpha", "1.0.0-beta", false},
		{"", "", false},
		{"1.0.0", "", true},
	}

	for _, tt := range tests {
		result := isNewer(tt.latest, tt.current)
		if result != tt.expected {
			t.Errorf("isNewer(%s, %s) = %v; want %v", tt.latest, tt.current, result, tt.expected)
		}
	}
}

func TestCompareNumericVersions(t *testing.T) {
	tests := []struct {
		lVer     []string
		cVer     []string
		expected int
		hasDiff  bool
	}{
		{[]string{"1", "0", "1"}, []string{"1", "0", "0"}, 1, true},
		{[]string{"1", "0", "0"}, []string{"1", "0", "1"}, -1, true},
		{[]string{"1", "0", "0"}, []string{"1", "0", "0"}, 0, false},
		{[]string{"1", "1"}, []string{"1", "0", "0"}, 1, true},
		{[]string{"1", "0", "0"}, []string{"1", "1"}, -1, true},
	}

	for _, tt := range tests {
		res, ok := compareNumericVersions(tt.lVer, tt.cVer)
		if res != tt.expected || ok != tt.hasDiff {
			t.Errorf("compareNumericVersions(%v, %v) = (%d, %v); want (%d, %v)", tt.lVer, tt.cVer, res, ok, tt.expected, tt.hasDiff)
		}
	}
}

func TestCheckForUpdates(t *testing.T) {
	// Mock GitHub API
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		releases := []GitHubRelease{
			{TagName: "v1.1.0", HTMLURL: "https://example.com/1.1.0", Prerelease: false, Draft: false},
			{TagName: "v1.2.0-beta", HTMLURL: "https://example.com/1.2.0-beta", Prerelease: true, Draft: false},
			{TagName: "v1.3.0", HTMLURL: "https://example.com/1.3.0", Prerelease: false, Draft: true},
		}
		json.NewEncoder(w).Encode(releases)
	}))
	defer server.Close()

	originalBaseURL := apiBaseURL
	apiBaseURL = server.URL
	defer func() { apiBaseURL = originalBaseURL }()

	// Test update available
	info, err := CheckForUpdates("1.0.0")
	if err != nil {
		t.Fatalf("CheckForUpdates failed: %v", err)
	}
	if !info.UpdateAvailable {
		t.Error("Expected update available")
	}
	if info.LatestVersion != "1.1.0" {
		t.Errorf("Expected latest version 1.1.0, got %s", info.LatestVersion)
	}

	// Test no update available
	info, err = CheckForUpdates("1.1.0")
	if err != nil {
		t.Fatalf("CheckForUpdates failed: %v", err)
	}
	if info.UpdateAvailable {
		t.Error("Expected no update available")
	}
}

func TestCheckForUpdates_Error(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	originalBaseURL := apiBaseURL
	apiBaseURL = server.URL
	defer func() { apiBaseURL = originalBaseURL }()

	_, err := CheckForUpdates("1.0.0")
	if err == nil {
		t.Error("Expected error from CheckForUpdates")
	}
}

func TestFindLatestRelease_Empty(t *testing.T) {
	_, found := findLatestRelease([]GitHubRelease{})
	if found {
		t.Error("Expected found=false for empty releases")
	}
}
