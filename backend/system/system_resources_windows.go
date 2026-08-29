//go:build windows

package system

import (
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"unsafe"
)

type memoryStatusEx struct {
	cbSize                  uint32
	dwMemoryLoad            uint32
	ullTotalPhys            uint64
	ullAvailPhys            uint64
	ullTotalPageFile        uint64
	ullAvailPageFile        uint64
	ullTotalVirtual         uint64
	ullAvailVirtual         uint64
	ullAvailExtendedVirtual uint64
}

type fileTime struct {
	dwLowDateTime  uint32
	dwHighDateTime uint32
}

var (
	modkernel32              = syscall.NewLazyDLL("kernel32.dll")
	procGlobalMemoryStatusEx = modkernel32.NewProc("GlobalMemoryStatusEx")
	procGetSystemTimes       = modkernel32.NewProc("GetSystemTimes")
)

func parseValueFromOutput(out []byte) uint64 {
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.EqualFold(trimmed, "TotalPhysicalMemory") || strings.EqualFold(trimmed, "FreePhysicalMemory") || strings.EqualFold(trimmed, "LoadPercentage") {
			continue
		}
		fields := strings.Fields(trimmed)
		for _, f := range fields {
			if val, err := strconv.ParseUint(f, 10, 64); err == nil {
				return val
			}
		}
	}
	return 0
}

func fileTimeToUint64(ft fileTime) uint64 {
	return uint64(ft.dwHighDateTime)<<32 | uint64(ft.dwLowDateTime)
}

func getWinMemoryStats() (totalGB uint64, freeGB float64) {
	var msx memoryStatusEx
	msx.cbSize = uint32(unsafe.Sizeof(msx))
	ret, _, _ := procGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&msx)))
	if ret != 0 {
		totalGB = (msx.ullTotalPhys + (1024 * 1024 * 1024) - 1) / (1024 * 1024 * 1024)
		freeGB = float64(msx.ullAvailPhys) / (1024 * 1024 * 1024)
		return totalGB, freeGB
	}
	return 16, 8.0
}

func getWinCpuUsage() int {
	var idleTime, kernelTime, userTime fileTime
	ret, _, _ := procGetSystemTimes.Call(
		uintptr(unsafe.Pointer(&idleTime)),
		uintptr(unsafe.Pointer(&kernelTime)),
		uintptr(unsafe.Pointer(&userTime)),
	)
	if ret != 0 {
		idle := fileTimeToUint64(idleTime)
		kernel := fileTimeToUint64(kernelTime)
		user := fileTimeToUint64(userTime)
		total := kernel + user
		if total > 0 {
			busy := total - idle
			return int((busy * 100) / total)
		}
	}
	return 0
}

// GetSystemResources returns the local CPU cores and total/available memory in GB using native Win32 API
func GetSystemResources() map[string]interface{} {
	cores := runtime.NumCPU()
	totalMemoryGB, freeMemoryGB := getWinMemoryStats()
	cpuUsage := getWinCpuUsage()

	return map[string]interface{}{
		"cpuCores":      cores,
		"cpuUsage":      cpuUsage,
		"totalMemoryGB": totalMemoryGB,
		"freeMemoryGB":  freeMemoryGB,
	}
}
