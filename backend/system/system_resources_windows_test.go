//go:build windows

package system

import (
	"testing"
	"time"
)

func TestFileTimeToUint64(t *testing.T) {
	ft := fileTime{
		dwLowDateTime:  0x12345678,
		dwHighDateTime: 0x00000001,
	}
	expected := uint64(0x0000000112345678)
	res := fileTimeToUint64(ft)
	if res != expected {
		t.Errorf("fileTimeToUint64(%v) = %d, expected %d", ft, res, expected)
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
