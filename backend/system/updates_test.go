package system

import (
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
