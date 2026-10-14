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

func TestNewClient(t *testing.T) {
	client := NewClient()
	if client == nil || client.httpClient == nil || client.baseURL == "" {
		t.Fatalf("expected initialized client with baseURL")
	}
}

func TestSetBaseURL(t *testing.T) {
	client := NewClient()
	client.SetBaseURL("http://localhost:8080/")
	if client.baseURL != "http://localhost:8080" {
		t.Fatalf("expected trimmed baseURL, got %s", client.baseURL)
	}
}

func TestFetchPopular(t *testing.T) {
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

	if res := client.FetchPopular(); res != `{"results":[{"name":"nginx"}]}` {
		t.Fatalf("unexpected result: %s", res)
	}

	client.SetBaseURL("http://127.0.0.1:0")
	if client.FetchPopular() != "" {
		t.Fatalf("expected empty string on network failure")
	}

	errClient := &Client{httpClient: &http.Client{Transport: errorTransport{}}, baseURL: "http://localhost"}
	if errClient.FetchPopular() != "" {
		t.Fatalf("expected empty string on read error")
	}
}

func TestFetchTags(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"tags":["latest"]}`))
	}))
	defer server.Close()

	client := NewClient()
	client.SetBaseURL(server.URL)

	if client.FetchTags("redis") != `{"tags":["latest"]}` {
		t.Fatalf("unexpected result for redis")
	}

	if client.FetchTags("bitnami/redis") != `{"tags":["latest"]}` {
		t.Fatalf("unexpected result for bitnami/redis")
	}

	client.SetBaseURL("http://127.0.0.1:0")
	if client.FetchTags("redis") != "" {
		t.Fatalf("expected empty string on network failure")
	}

	errClient := &Client{httpClient: &http.Client{Transport: errorTransport{}}, baseURL: "http://localhost"}
	if errClient.FetchTags("redis") != "" {
		t.Fatalf("expected empty string on read error")
	}
}

func TestSearch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"results":[{"repo_name":"nginx"}]}`))
	}))
	defer server.Close()

	client := NewClient()
	client.SetBaseURL(server.URL)

	if client.Search("nginx") != `{"results":[{"repo_name":"nginx"}]}` {
		t.Fatalf("unexpected search result")
	}

	client.SetBaseURL("http://127.0.0.1:0")
	if client.Search("nginx") != "" {
		t.Fatalf("expected empty string on network failure")
	}

	errClient := &Client{httpClient: &http.Client{Transport: errorTransport{}}, baseURL: "http://localhost"}
	if errClient.Search("nginx") != "" {
		t.Fatalf("expected empty string on read error")
	}
}
