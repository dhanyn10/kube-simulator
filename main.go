package main

import (
	"context"
	"embed"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

var appCtx context.Context

func handleFileAssociation(app *App) {
	if len(os.Args) > 1 {
		arg := os.Args[1]
		if strings.HasSuffix(strings.ToLower(arg), ".infra") {
			if _, err := os.Stat(arg); err == nil {
				if absPath, err := filepath.Abs(arg); err == nil {
					app.SetInitialFile(absPath)
				}
			}
		}
	}
}

func setupApplicationMenu(app *application.App) *application.Menu {
	appMenu := app.NewMenu()
	helpMenu := appMenu.AddSubmenu("Help")
	helpMenu.AddSeparator()
	helpMenu.Add("About").SetAccelerator("CmdOrCtrl+A").OnClick(func(_ *application.Context) {
		if app.Event != nil {
			app.Event.Emit("openAboutDialog")
		}
	})
	return appMenu
}

// main is the primary entry point for the Wails application.
// It initializes the application state, parses command-line file parameters,
// configures system menus, and executes the Wails application runtime loop.
func main() {
	appInstance := NewApp()
	handleFileAssociation(appInstance)

	var mainWindow *application.WebviewWindow

	wailsApp := application.New(application.Options{
		Name: "Kube Simulator",
		Services: []application.Service{
			application.NewService(appInstance),
		},
		Assets: application.AssetOptions{
			Handler: application.BundledAssetFileServer(assets),
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "com.dhanyn.kubesimulator",
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
				if len(data.Args) > 1 {
					arg := data.Args[1]
					if strings.HasSuffix(strings.ToLower(arg), ".infra") {
						if _, err := os.Stat(arg); err == nil {
							if absPath, err := filepath.Abs(arg); err == nil {
								appInstance.LoadFileContent(absPath)
							}
						}
					}
				}
				if mainWindow != nil {
					mainWindow.Restore()
					mainWindow.Focus()
				}
			},
		},
		OnShutdown: func() {
			appInstance.shutdown(context.Background())
		},
	})

	appMenu := setupApplicationMenu(wailsApp)
	wailsApp.Menu.SetApplicationMenu(appMenu)

	mainWindow = wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Kube Simulator",
		Width:            1024,
		Height:           768,
		Frameless:        true,
		URL:              "/",
		BackgroundColour: application.NewRGBA(27, 38, 54, 255),
		Windows: application.WindowsWindow{
			DisableFramelessWindowDecorations: false,
		},
	})

	appInstance.startup(context.Background())

	if err := wailsApp.Run(); err != nil {
		println("Error:", err.Error())
	}
}
