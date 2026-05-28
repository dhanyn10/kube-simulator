package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"runtime"
	"time"

	"build-wails/backend/db"
	"build-wails/backend/system"
	"build-wails/backend/yaml_gen"

	"github.com/dgraph-io/badger/v4"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	history         *db.HistoryManager
	projects        *db.ProjectManager
	initialFilePath string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		history:  db.NewHistoryManager(),
		projects: db.NewProjectManager(),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	appCtx = ctx

	if err := a.history.Init(); err != nil {
		log.Fatalf("Failed to initialize history manager: %v", err)
	}

	if err := a.projects.Init(); err != nil {
		log.Fatalf("Failed to initialize project manager: %v", err)
	}

	// Adjust window size to 90% of screen height on startup
	screens, err := wailsRuntime.ScreenGetAll(ctx)
	if err == nil {
		if targetScreen, ok := a.GetTargetScreen(screens); ok {
			screenW := targetScreen.Size.Width
			screenH := targetScreen.Size.Height
			if screenW == 0 {
				screenW = targetScreen.Width
				screenH = targetScreen.Height
			}
			newHeight := a.CalculateAppHeight(screenH)
			currWidth, _ := wailsRuntime.WindowGetSize(ctx)

			// Center horizontally; pin Y=0 so the menu bar is never clipped above the screen
			x := (screenW - currWidth) / 2
			if x < 0 {
				x = 0
			}

			wailsRuntime.WindowSetSize(ctx, currWidth, newHeight)
			wailsRuntime.WindowSetPosition(ctx, x, 0)
		}
	}
	wailsRuntime.WindowShow(ctx)

	// If a file was passed via CLI, read it and emit to frontend after a short delay
	if a.initialFilePath != "" {
		go func() {
			time.Sleep(1 * time.Second) // Wait for frontend to be ready
			fileData, err := os.ReadFile(a.initialFilePath)
			if err == nil {
				wailsRuntime.EventsEmit(ctx, "open-infra-file", string(fileData))
			}
		}()
	}
}

// GetTargetScreen selects the target screen: either the primary screen or the first fallback screen.
func (a *App) GetTargetScreen(screens []wailsRuntime.Screen) (wailsRuntime.Screen, bool) {
	if len(screens) == 0 {
		return wailsRuntime.Screen{}, false
	}
	for _, s := range screens {
		if s.IsPrimary {
			return s, true
		}
	}
	return screens[0], true
}

// GetTargetScreenHeight selects the target screen's height: either the primary screen or the first fallback screen.
func (a *App) GetTargetScreenHeight(screens []wailsRuntime.Screen) (int, bool) {
	s, ok := a.GetTargetScreen(screens)
	return s.Height, ok
}

// CalculateAppHeight returns 90% of the given screen height.
func (a *App) CalculateAppHeight(screenHeight int) int {
	return int(float64(screenHeight) * 0.9)
}

func (a *App) shutdown(ctx context.Context) {
	a.history.Close()
	a.projects.Close()
}

// History actions

func (a *App) PushHistory(state string) {
	a.history.Push(state)
}

func (a *App) Undo() string {
	return a.history.Undo()
}

func (a *App) Redo() string {
	return a.history.Redo()
}

func (a *App) JumpToHistory(index int) string {
	return a.history.JumpTo(index)
}

func (a *App) GetHistoryLogs() []db.HistoryLog {
	badgerDB := a.history.GetDB()
	if badgerDB == nil {
		return []db.HistoryLog{}
	}

	logs := make([]db.HistoryLog, 0)
	maxIndex := a.history.GetMaxIndex()

	_ = badgerDB.View(func(txn *badger.Txn) error {
		for i := 0; i <= maxIndex; i++ {
			key := []byte(fmt.Sprintf("hist:%d", i))
			item, err := txn.Get(key)
			if err != nil {
				continue
			}
			_ = item.Value(func(val []byte) error {
				var data struct {
					ActionName string `json:"actionName"`
					Timestamp  int64  `json:"timestamp"`
				}
				if err := json.Unmarshal(val, &data); err == nil {
					logs = append(logs, db.HistoryLog{
						Index:      i,
						ActionName: data.ActionName,
						Timestamp:  data.Timestamp,
					})
				} else {
					logs = append(logs, db.HistoryLog{
						Index:      i,
						ActionName: fmt.Sprintf("Activity #%d", i),
						Timestamp:  0,
					})
				}
				return nil
			})
		}
		return nil
	})
	return logs
}

// Project actions

func (a *App) SaveProject(name, content string) int64 {
	id, err := a.projects.SaveProject(name, content)
	if err != nil {
		log.Printf("Error saving project: %v", err)
		return -1
	}
	if appCtx != nil {
		wailsRuntime.WindowSetTitle(appCtx, fmt.Sprintf("Kube Simulator - %s", name))
	}
	return id
}

func (a *App) SetInitialFile(path string) {
	a.initialFilePath = path
}

func (a *App) UpdateProject(id int64, content string) bool {
	err := a.projects.UpdateProject(id, content)
	if err != nil {
		log.Printf("Error updating project: %v", err)
		return false
	}
	return true
}

func (a *App) ExportProjectFile(name, canvasContent, yamlContent string) bool {
	if appCtx == nil {
		return false
	}
	filePath, err := wailsRuntime.SaveFileDialog(appCtx, wailsRuntime.SaveDialogOptions{
		DefaultFilename: fmt.Sprintf("%s.infra", name),
		Title:           "Export Infrastructure Project",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Kube Simulator Project (*.infra)", Pattern: "*.infra"},
		},
	})

	if err != nil || filePath == "" {
		return false
	}

	data := map[string]string{
		"name":   name,
		"canvas": canvasContent,
		"yaml":   yamlContent,
	}

	fileData, _ := json.MarshalIndent(data, "", "  ")
	err = os.WriteFile(filePath, fileData, 0644)
	if err != nil {
		log.Printf("Error writing file: %v", err)
		return false
	}

	return true
}

func (a *App) ImportProjectFile() string {
	if appCtx == nil {
		return ""
	}
	filePath, err := wailsRuntime.OpenFileDialog(appCtx, wailsRuntime.OpenDialogOptions{
		Title: "Import Infrastructure Project",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Kube Simulator Project (*.infra)", Pattern: "*.infra"},
		},
	})

	if err != nil || filePath == "" {
		return ""
	}

	fileData, err := os.ReadFile(filePath)
	if err != nil {
		log.Printf("Error reading file: %v", err)
		return ""
	}

	return string(fileData)
}

func (a *App) GetProjects() []db.Project {
	projects, err := a.projects.GetProjects()
	if err != nil {
		log.Printf("Error getting projects: %v", err)
		return []db.Project{}
	}
	return projects
}

func (a *App) LoadProject(id int64) *db.Project {
	proj, err := a.projects.LoadProject(id)
	if err != nil {
		log.Printf("Error loading project: %v", err)
		return nil
	}
	if appCtx != nil {
		wailsRuntime.WindowSetTitle(appCtx, fmt.Sprintf("Kube Simulator - %s", proj.Name))
	}
	return proj
}

func (a *App) DeleteProject(id int64) bool {
	err := a.projects.DeleteProject(id)
	if err != nil {
		log.Printf("Error deleting project: %v", err)
		return false
	}
	return true
}

func (a *App) SaveSetting(key, value string) bool {
	err := a.projects.SaveSetting(key, value)
	if err != nil {
		log.Printf("Error saving setting: %v", err)
		return false
	}
	return true
}

func (a *App) GetSetting(key string) string {
	val, err := a.projects.GetSetting(key)
	if err != nil {
		return ""
	}
	return val
}

// Window Control Actions

func (a *App) MinimizeWindow() {
	if appCtx != nil {
		wailsRuntime.WindowMinimise(appCtx)
	}
}

func (a *App) MaximizeWindow() {
	if appCtx != nil {
		if wailsRuntime.WindowIsMaximised(appCtx) {
			wailsRuntime.WindowUnmaximise(appCtx)
		} else {
			wailsRuntime.WindowMaximise(appCtx)
		}
	}
}

func (a *App) CloseWindow() {
	if appCtx != nil {
		wailsRuntime.Quit(appCtx)
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// GetSystemInfo returns basic system information
func (a *App) GetSystemInfo() map[string]string {
	return map[string]string{
		"os":        runtime.GOOS,
		"arch":      runtime.GOARCH,
		"goVersion": runtime.Version(),
	}
}

func (a *App) GetSystemResources() map[string]interface{} {
	return system.GetSystemResources()
}

func (a *App) GenerateYaml(nodesJson, edgesJson string) string {
	return yaml_gen.Generate(nodesJson, edgesJson)
}
