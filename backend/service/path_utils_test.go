package service

import (
	"path/filepath"
	"testing"
)

func TestExpandHomePath(t *testing.T) {
	home := "/home/testuser"

	tests := []struct {
		input    string
		expected string
	}{
		{"~", home},
		{"~/projects/app.infra", filepath.Join(home, "projects", "app.infra")},
		{"/var/log/app.log", "/var/log/app.log"},
		{"relative/path.infra", "relative/path.infra"},
	}

	for _, tc := range tests {
		actual := ExpandHomePath(tc.input, home)
		if actual != tc.expected {
			t.Errorf("ExpandHomePath(%q) = %q; expected %q", tc.input, actual, tc.expected)
		}
	}
}

func TestSanitizeProfileFilename(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Normal Name", "normal_name"},
		{"Mixed-Case_123", "mixed-case_123"},
		{"!@#$%^&*()", "profile"},
		{"", "profile"},
		{"Web Traffic (Peak)", "web_traffic_peak"},
	}

	for _, tc := range tests {
		actual := SanitizeProfileFilename(tc.input)
		if actual != tc.expected {
			t.Errorf("SanitizeProfileFilename(%q) = %q; expected %q", tc.input, actual, tc.expected)
		}
	}
}
