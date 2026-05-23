package main

import (
	"embed"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime" // Import wailsRuntime
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Handle file association (Open With)
	if len(os.Args) > 1 {
		arg := os.Args[1]
		if strings.HasSuffix(strings.ToLower(arg), ".infra") {
			if _, err := os.Stat(arg); err == nil {
				absPath, err := filepath.Abs(arg)
				if err == nil {
					app.SetInitialFile(absPath)
				}
			}
		}
	}

	// Create a new menu
	AppMenu := menu.NewMenu()

	// Create a Help menu
	HelpMenu := AppMenu.AddSubmenu("Help")
	HelpMenu.AddSeparator()
	HelpMenu.AddText("About", keys.CmdOrCtrl("A"), func(_ *menu.CallbackData) {
		// Emit an event when "About" is clicked
		if app.ctx != nil {
			wailsRuntime.EventsEmit(app.ctx, "openAboutDialog") // Corrected: wailsRuntime.EventsEmit
		}
	})

	// Create application with options
	err := wails.Run(&options.App{
		Title:       "build-wails",
		Width:       1024,
		Height:      768,
		Frameless:   true,
		StartHidden: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
		Menu: AppMenu,
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
