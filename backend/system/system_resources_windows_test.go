//go:build windows

package system

import (
	"sync"
	"testing"
	"time"
)

func TestFileTimeToUint64(t *testing.T) {
	tests := []struct {
		name     string
		input    fileTime
		expected uint64
	}{
		{
			name: "Standard low and high bits",
			input: fileTime{
				dwLowDateTime:  0x12345678,
				dwHighDateTime: 0x00000001,
			},
			expected: 0x0000000112345678,
		},
		{
			name: "Zero values",
			input: fileTime{
				dwLowDateTime:  0,
				dwHighDateTime: 0,
			},
			expected: 0,
		},
		{
			name: "Max low and high bits",
			input: fileTime{
				dwLowDateTime:  0xFFFFFFFF,
				dwHighDateTime: 0xFFFFFFFF,
			},
			expected: 0xFFFFFFFFFFFFFFFF,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := fileTimeToUint64(tt.input)
			if res != tt.expected {
				t.Errorf("fileTimeToUint64(%v) = %d, expected %d", tt.input, res, tt.expected)
			}
		})
	}
}

func TestGetWinMemoryStats(t *testing.T) {
	total, free := getWinMemoryStats()
	if total == 0 {
		t.Errorf("expected total memory > 0, got %d", total)
	}
	if free < 0 {
		t.Errorf("expected free memory >= 0, got %f", free)
	}
	if free > float64(total) {
		t.Errorf("free memory (%f GB) cannot exceed total memory (%d GB)", free, total)
	}
}

func TestGetWinCpuUsage(t *testing.T) {
	// First call initializes baseline delta
	usage1 := getWinCpuUsage()
	if usage1 < 0 || usage1 > 100 {
		t.Errorf("expected CPU usage 0..100, got %d", usage1)
	}

	time.Sleep(50 * time.Millisecond)

	// Second call measures usage over interval
	usage2 := getWinCpuUsage()
	if usage2 < 0 || usage2 > 100 {
		t.Errorf("expected CPU usage 0..100, got %d", usage2)
	}
}

func TestGetWinCpuUsage_Concurrent(t *testing.T) {
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			usage := getWinCpuUsage()
			if usage < 0 || usage > 100 {
				t.Errorf("expected CPU usage 0..100, got %d", usage)
			}
		}()
	}
	wg.Wait()
}

func TestGetSystemResources_Windows(t *testing.T) {
	res := GetSystemResources()
	if res == nil {
		t.Fatal("expected non-nil system resources")
	}

	keys := []string{"cpuCores", "cpuUsage", "totalMemoryGB", "freeMemoryGB"}
	for _, key := range keys {
		if _, ok := res[key]; !ok {
			t.Errorf("expected %s in system resources", key)
		}
	}

	if cores, ok := res["cpuCores"].(int); !ok || cores <= 0 {
		t.Errorf("expected cpuCores > 0, got %v", res["cpuCores"])
	}

	if mem, ok := res["totalMemoryGB"].(uint64); !ok || mem == 0 {
		t.Errorf("expected totalMemoryGB > 0, got %v", res["totalMemoryGB"])
	}

	if usage, ok := res["cpuUsage"].(int); !ok || usage < 0 || usage > 100 {
		t.Errorf("expected cpuUsage between 0 and 100, got %v", res["cpuUsage"])
	}
}
