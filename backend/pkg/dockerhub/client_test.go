package dockerhub

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

type errorTransport struct{}

func (errorTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(errReader{}),
	}, nil
}

type errReader struct{}

func (errReader) Read(p []byte) (n int, err error) {
	return 0, fmt.Errorf("read error")
}

func TestDockerHubClient(t *testing.T) {
	t.Run("NewClient initializes default client", func(t *testing.T) {
		client := NewClient()
		if client == nil || client.httpClient == nil || client.baseURL == "" {
			t.Fatalf("expected initialized client with baseURL")
		}
	})

	t.Run("SetBaseURL updates base URL", func(t *testing.T) {
		client := NewClient()
		client.SetBaseURL("http://localhost:8080/")
		if client.baseURL != "http://localhost:8080" {
			t.Fatalf("expected trimmed baseURL, got %s", client.baseURL)
		}
	})

	t.Run("FetchPopular success and failure", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/v2/repositories/library/" {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"results":[{"name":"nginx"}]}`))
				return
			}
			w.WriteHeader(http.StatusNotFound)
		}))
		defer server.Close()

		client := NewClient()
		client.SetBaseURL(server.URL)

		res := client.FetchPopular()
		if res != `{"results":[{"name":"nginx"}]}` {
			t.Fatalf("unexpected result: %s", res)
		}

		// Test network failure
		client.SetBaseURL("http://127.0.0.1:0")
		if resFail := client.FetchPopular(); resFail != "" {
			t.Fatalf("expected empty string on network failure")
		}

		// Test read error
		errClient := &Client{httpClient: &http.Client{Transport: errorTransport{}}, baseURL: "http://localhost"}
		if resErr := errClient.FetchPopular(); resErr != "" {
			t.Fatalf("expected empty string on read error")
		}
	})

	t.Run("FetchTags with library prefix and custom namespace", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"tags":["latest"]}`))
		}))
		defer server.Close()

		client := NewClient()
		client.SetBaseURL(server.URL)

		resLib := client.FetchTags("redis")
		if resLib != `{"tags":["latest"]}` {
			t.Fatalf("unexpected result for redis: %s", resLib)
		}

		resCustom := client.FetchTags("bitnami/redis")
		if resCustom != `{"tags":["latest"]}` {
			t.Fatalf("unexpected result for bitnami/redis: %s", resCustom)
		}

		// Test network failure
		client.SetBaseURL("http://127.0.0.1:0")
		if resFail := client.FetchTags("redis"); resFail != "" {
			t.Fatalf("expected empty string on network failure")
		}

		// Test read error
		errClient := &Client{httpClient: &http.Client{Transport: errorTransport{}}, baseURL: "http://localhost"}
		if resErr := errClient.FetchTags("redis"); resErr != "" {
			t.Fatalf("expected empty string on read error")
		}
	})

	t.Run("Search query success and network failure", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"results":[{"repo_name":"nginx"}]}`))
		}))
		defer server.Close()

		client := NewClient()
		client.SetBaseURL(server.URL)

		res := client.Search("nginx")
		if res != `{"results":[{"repo_name":"nginx"}]}` {
			t.Fatalf("unexpected search result: %s", res)
		}

		// Test network failure
		client.SetBaseURL("http://127.0.0.1:0")
		if resFail := client.Search("nginx"); resFail != "" {
			t.Fatalf("expected empty string on network failure")
		}

		// Test read error
		errClient := &Client{httpClient: &http.Client{Transport: errorTransport{}}, baseURL: "http://localhost"}
		if resErr := errClient.Search("nginx"); resErr != "" {
			t.Fatalf("expected empty string on read error")
		}
	})
}
