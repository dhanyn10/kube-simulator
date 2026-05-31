package system

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	RepoOwner = "dhanyn10"
	RepoName  = "kube-simulator"
)

type GitHubRelease struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
}

type UpdateInfo struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	UpdateAvailable bool   `json:"updateAvailable"`
	ReleaseURL     string `json:"releaseUrl"`
}

func CheckForUpdates(currentVersion string) (*UpdateInfo, error) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", RepoOwner, RepoName)
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch latest release: status %d", resp.StatusCode)
	}

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, err
	}

	latestVersion := strings.TrimPrefix(release.TagName, "v")
	currentVersion = strings.TrimPrefix(currentVersion, "v")

	updateAvailable := isNewer(latestVersion, currentVersion)

	return &UpdateInfo{
		CurrentVersion: currentVersion,
		LatestVersion:  latestVersion,
		UpdateAvailable: updateAvailable,
		ReleaseURL:     release.HTMLURL,
	}, nil
}

func isNewer(latest, current string) bool {
	lp := strings.Split(latest, ".")
	cp := strings.Split(current, ".")

	// Compare parts numerically
	for i := 0; i < len(lp) && i < len(cp); i++ {
		lv, _ := strconv.Atoi(lp[i])
		cv, _ := strconv.Atoi(cp[i])
		if lv > cv {
			return true
		}
		if lv < cv {
			return false
		}
	}

	// If all parts are equal so far, the one with more parts is newer (e.g. 1.2.3 > 1.2)
	return len(lp) > len(cp)
}
