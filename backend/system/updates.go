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

var (
	// BaseURL for API calls, can be overridden in tests
	apiBaseURL = "https://api.github.com"
)

// GitHubRelease represents a release object returned by the GitHub REST API.
type GitHubRelease struct {
	TagName    string `json:"tag_name"`
	HTMLURL    string `json:"html_url"`
	Prerelease bool   `json:"prerelease"`
	Draft      bool   `json:"draft"`
}

// UpdateInfo contains update check results comparing current version against GitHub releases.
type UpdateInfo struct {
	CurrentVersion  string `json:"currentVersion"`
	LatestVersion   string `json:"latestVersion"`
	UpdateAvailable bool   `json:"updateAvailable"`
	ReleaseURL      string `json:"releaseUrl"`
	IsPrerelease    bool   `json:"isPrerelease"`
}

// fetchReleases queries GitHub API for repository release history.
func fetchReleases() ([]GitHubRelease, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	url := fmt.Sprintf("%s/repos/%s/%s/releases", apiBaseURL, RepoOwner, RepoName)

	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}

	var releases []GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, err
	}
	return releases, nil
}

// findLatestRelease locates the first non-draft release in the provided release list.
func findLatestRelease(releases []GitHubRelease) (GitHubRelease, bool) {
	for _, release := range releases {
		if !release.Draft {
			return release, true
		}
	}
	return GitHubRelease{}, false
}

// CheckForUpdates fetches repository releases from GitHub and determines if a newer version is available.
func CheckForUpdates(currentVersion string) (*UpdateInfo, error) {
	releases, err := fetchReleases()
	if err != nil {
		return &UpdateInfo{CurrentVersion: currentVersion}, fmt.Errorf("failed to fetch releases: %w", err)
	}

	latest, found := findLatestRelease(releases)
	if !found {
		return &UpdateInfo{CurrentVersion: currentVersion}, nil
	}

	latestVersion := strings.TrimPrefix(latest.TagName, "v")
	cleanCurrent := strings.TrimPrefix(currentVersion, "v")
	updateAvailable := currentVersion == "" || isNewer(latestVersion, cleanCurrent)

	return &UpdateInfo{
		CurrentVersion:  currentVersion,
		LatestVersion:   latestVersion,
		UpdateAvailable: updateAvailable,
		ReleaseURL:      latest.HTMLURL,
		IsPrerelease:    latest.Prerelease,
	}, nil
}

// compareNumericVersions compares two slice arrays of numeric version segment strings.
func compareNumericVersions(latestVersionParts, currentVersionParts []string) (int, bool) {
	for partIndex := 0; partIndex < len(latestVersionParts) || partIndex < len(currentVersionParts); partIndex++ {
		latestVal, currentVal := 0, 0
		if partIndex < len(latestVersionParts) {
			latestVal, _ = strconv.Atoi(latestVersionParts[partIndex])
		}
		if partIndex < len(currentVersionParts) {
			currentVal, _ = strconv.Atoi(currentVersionParts[partIndex])
		}

		if latestVal > currentVal {
			return 1, true
		}
		if latestVal < currentVal {
			return -1, true
		}
	}
	return 0, false
}

// isNewer evaluates semver-like version strings to determine whether latest is newer than current.
func isNewer(latest, current string) bool {
	if current == "" {
		return latest != ""
	}

	latestParts := strings.Split(latest, "-")
	currentParts := strings.Split(current, "-")

	if compResult, hasDifference := compareNumericVersions(strings.Split(latestParts[0], "."), strings.Split(currentParts[0], ".")); hasDifference {
		return compResult > 0
	}

	// If numeric segments are equal, a release without a suffix is newer than one with a suffix
	if len(latestParts) != len(currentParts) {
		return len(latestParts) < len(currentParts)
	}

	// If both have suffixes, compare them lexicographically
	if len(latestParts) > 1 && len(currentParts) > 1 {
		return latestParts[1] > currentParts[1]
	}

	return false
}
