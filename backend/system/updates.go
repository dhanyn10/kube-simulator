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
	for _, r := range releases {
		if !r.Draft {
			return r, true
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
func compareNumericVersions(lVer, cVer []string) (int, bool) {
	for i := 0; i < len(lVer) || i < len(cVer); i++ {
		lv, cv := 0, 0
		if i < len(lVer) {
			lv, _ = strconv.Atoi(lVer[i])
		}
		if i < len(cVer) {
			cv, _ = strconv.Atoi(cVer[i])
		}

		if lv > cv {
			return 1, true
		}
		if lv < cv {
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

	lParts := strings.Split(latest, "-")
	cParts := strings.Split(current, "-")

	if res, ok := compareNumericVersions(strings.Split(lParts[0], "."), strings.Split(cParts[0], ".")); ok {
		return res > 0
	}

	// If numeric segments are equal, a release without a suffix is newer than one with a suffix
	if len(lParts) != len(cParts) {
		return len(lParts) < len(cParts)
	}

	// If both have suffixes, compare them lexicographically
	if len(lParts) > 1 && len(cParts) > 1 {
		return lParts[1] > cParts[1]
	}

	return false
}
