//go:build windows

package system

import (
	"runtime"
	"sync"
	"syscall"
	"time"
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

	cpuMutex       sync.Mutex
	prevIdleTime   uint64
	prevKernelTime uint64
	prevUserTime   uint64
)

func fileTimeToUint64(ft fileTime) uint64 {
	return uint64(ft.dwHighDateTime)<<32 | uint64(ft.dwLowDateTime)
}

func getWinMemoryStats() (totalGB uint64, freeGB float64) {
	var msx memoryStatusEx
	msx.cbSize = uint32(unsafe.Sizeof(msx))
	ret, _, _ := procGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&msx)))
	if ret != 0 {
		totalGB = (msx.ullTotalPhys + (1024 * 1024 * 1024) - 1) / (1024 * 1024 * 1024)
		rawFree := float64(msx.ullAvailPhys) / (1024 * 1024 * 1024)
		freeGB = float64(int(rawFree*100+0.5)) / 100.0
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
	if ret == 0 {
		return 0
	}

	currentIdle := fileTimeToUint64(idleTime)
	currentKernel := fileTimeToUint64(kernelTime)
	currentUser := fileTimeToUint64(userTime)

	cpuMutex.Lock()
	defer cpuMutex.Unlock()

	if prevKernelTime == 0 && prevUserTime == 0 {
		prevIdleTime = currentIdle
		prevKernelTime = currentKernel
		prevUserTime = currentUser

		cpuMutex.Unlock()
		time.Sleep(50 * time.Millisecond)
		cpuMutex.Lock()

		ret, _, _ = procGetSystemTimes.Call(
			uintptr(unsafe.Pointer(&idleTime)),
			uintptr(unsafe.Pointer(&kernelTime)),
			uintptr(unsafe.Pointer(&userTime)),
		)
		if ret != 0 {
			currentIdle = fileTimeToUint64(idleTime)
			currentKernel = fileTimeToUint64(kernelTime)
			currentUser = fileTimeToUint64(userTime)
		}
	}

	deltaIdle := currentIdle - prevIdleTime
	deltaKernel := currentKernel - prevKernelTime
	deltaUser := currentUser - prevUserTime

	prevIdleTime = currentIdle
	prevKernelTime = currentKernel
	prevUserTime = currentUser

	deltaTotal := deltaKernel + deltaUser
	if deltaTotal == 0 || deltaTotal < deltaIdle {
		return 0
	}

	deltaBusy := deltaTotal - deltaIdle
	usage := int((deltaBusy * 100) / deltaTotal)
	if usage < 0 {
		return 0
	}
	if usage > 100 {
		return 100
	}

	return usage
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
