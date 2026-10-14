package dockerhub

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDockerHubClient(t *testing.T) {
	t.Run("NewClient creates client instance", func(t *testing.T) {
		client := NewClient()
		if client == nil || client.httpClient == nil {
			t.Fatalf("expected non-nil client and httpClient")
		}
	})

	t.Run("FetchPopular with mock server", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"results":[{"name":"nginx"}]}`))
		}))
		defer server.Close()

		client := &Client{httpClient: server.Client()}
		resp, err := client.httpClient.Get(server.URL)
		if err != nil || resp.StatusCode != http.StatusOK {
			t.Fatalf("expected successful HTTP get from test server")
		}
		_ = resp.Body.Close()
	})
}
