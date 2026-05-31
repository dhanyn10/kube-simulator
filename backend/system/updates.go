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
	TagName    string `json:"tag_name"`
	HTMLURL    string `json:"html_url"`
	Prerelease bool   `json:"prerelease"`
	Draft      bool   `json:"draft"`
}

type UpdateInfo struct {
	CurrentVersion  string `json:"currentVersion"`
	LatestVersion   string `json:"latestVersion"`
	UpdateAvailable bool   `json:"updateAvailable"`
	ReleaseURL      string `json:"releaseUrl"`
	IsPrerelease    bool   `json:"isPrerelease"`
}

func CheckForUpdates(currentVersion string) (*UpdateInfo, error) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Fetch all recent releases to distinguish between stable and pre-release
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases", RepoOwner, RepoName)
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch releases: status %d", resp.StatusCode)
	}

	var releases []GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, err
	}

	if len(releases) == 0 {
		return &UpdateInfo{
			CurrentVersion: currentVersion,
		}, nil
	}

	// GitHub returns releases sorted by created_at descending.
	// We want the absolute latest (could be pre-release) or just the latest stable.
	// For now, let's find the first non-draft release.
	var latest GitHubRelease
	found := false
	for _, r := range releases {
		if !r.Draft {
			latest = r
			found = true
			break
		}
	}

	if !found {
		return &UpdateInfo{
			CurrentVersion: currentVersion,
		}, nil
	}

	latestVersion := strings.TrimPrefix(latest.TagName, "v")
	cleanCurrent := strings.TrimPrefix(currentVersion, "v")

	// If current version is empty, we definitely should show an update is available
	updateAvailable := currentVersion == "" || isNewer(latestVersion, cleanCurrent)

	return &UpdateInfo{
		CurrentVersion:  currentVersion,
		LatestVersion:   latestVersion,
		UpdateAvailable: updateAvailable,
		ReleaseURL:      latest.HTMLURL,
		IsPrerelease:    latest.Prerelease,
	}, nil
}

func isNewer(latest, current string) bool {
	if current == "" {
		return latest != ""
	}

	// Simple semantic versioning comparison (ignoring build metadata for now)
	// Split by '-' to handle pre-release suffixes like 1.0.0-beta
	lParts := strings.Split(latest, "-")
	cParts := strings.Split(current, "-")

	lVer := strings.Split(lParts[0], ".")
	cVer := strings.Split(cParts[0], ".")

	// Compare numeric segments
	for i := 0; i < len(lVer) || i < len(cVer); i++ {
		lv := 0
		if i < len(lVer) {
			lv, _ = strconv.Atoi(lVer[i])
		}
		cv := 0
		if i < len(cVer) {
			cv, _ = strconv.Atoi(cVer[i])
		}

		if lv > cv {
			return true
		}
		if lv < cv {
			return false
		}
	}

	// If numeric segments are equal, a release without a suffix is newer than one with a suffix
	// e.g., 1.0.0 is newer than 1.0.0-beta
	if len(lParts) == 1 && len(cParts) > 1 {
		return true
	}
	if len(lParts) > 1 && len(cParts) == 1 {
		return false
	}

	// If both have suffixes, compare them lexicographically (simplification)
	if len(lParts) > 1 && len(cParts) > 1 {
		return lParts[1] > cParts[1]
	}

	return false
}
