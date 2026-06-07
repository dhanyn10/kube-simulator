package system

import (
	"testing"
)

func TestGetSystemResources(t *testing.T) {
	res := GetSystemResources()
	if res == nil {
		t.Fatal("expected non-nil system resources")
	}

	if _, ok := res["cpuCores"]; !ok {
		t.Error("expected cpuCores in system resources")
	}

	if _, ok := res["totalMemoryGB"]; !ok {
		t.Error("expected totalMemoryGB in system resources")
	}
}
