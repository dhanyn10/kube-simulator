package dockerhub

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"build-wails/backend/logger"
)

// Client handles communication with the Docker Hub API.
type Client struct {
	httpClient *http.Client
}

// NewClient initializes and returns a new DockerHub Client with a default timeout.
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// FetchPopular retrieves popular library repositories from Docker Hub.
func (c *Client) FetchPopular() string {
	resp, err := c.httpClient.Get("https://hub.docker.com/v2/repositories/library/?page_size=20")
	if err != nil {
		logger.Error("Failed to fetch popular Docker Hub repositories: %v", err)
		return ""
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.Error("Failed to read popular Docker Hub response body: %v", err)
		return ""
	}
	return string(body)
}

// FetchTags retrieves available tags for a given Docker image name.
func (c *Client) FetchTags(imageName string) string {
	path := imageName
	if !strings.Contains(imageName, "/") {
		path = "library/" + imageName
	}

	targetURL := fmt.Sprintf("https://hub.docker.com/v2/repositories/%s/tags/?page_size=20", path)
	resp, err := c.httpClient.Get(targetURL)
	if err != nil {
		logger.Error("Failed to fetch Docker Hub tags for %s: %v", imageName, err)
		return ""
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.Error("Failed to read Docker Hub tags response body: %v", err)
		return ""
	}
	return string(body)
}

// Search searches for repositories on Docker Hub matching the query string.
func (c *Client) Search(query string) string {
	targetURL := fmt.Sprintf("https://hub.docker.com/v2/search/repositories/?query=%s&page_size=20", url.QueryEscape(query))
	resp, err := c.httpClient.Get(targetURL)
	if err != nil {
		logger.Error("Failed to search Docker Hub: %v", err)
		return ""
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.Error("Failed to read search Docker Hub response body: %v", err)
		return ""
	}
	return string(body)
}
