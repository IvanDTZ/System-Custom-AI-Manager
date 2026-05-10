package ollama

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	baseURL string
	http    *http.Client
}

// sharedTransport is reused across all *Client instances so HTTP/1.1
// keep-alives are pooled across concurrent requests. The defaults of
// http.DefaultTransport are too conservative when many users stream at once.
var sharedTransport = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	DialContext: (&net.Dialer{
		Timeout:   5 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
	ForceAttemptHTTP2:     true,
	MaxIdleConns:          64,
	MaxIdleConnsPerHost:   32,
	IdleConnTimeout:       90 * time.Second,
	TLSHandshakeTimeout:   5 * time.Second,
	ExpectContinueTimeout: 1 * time.Second,
	// Disable response buffering for streamed bodies.
	DisableCompression: true,
}

func New(baseURL string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http: &http.Client{
			Transport: sharedTransport,
			Timeout:   0, // no timeout: streaming + pulls can be long
		},
	}
}

// --- /api/tags ---------------------------------------------------------------

type TagsResponse struct {
	Models []TagModel `json:"models"`
}

type TagModel struct {
	Name       string         `json:"name"`
	Model      string         `json:"model"`
	Size       int64          `json:"size"`
	Digest     string         `json:"digest"`
	Details    ModelDetails   `json:"details"`
	ModifiedAt time.Time      `json:"modified_at"`
}

type ModelDetails struct {
	Family            string   `json:"family"`
	Families          []string `json:"families"`
	ParameterSize     string   `json:"parameter_size"`
	QuantizationLevel string   `json:"quantization_level"`
}

func (c *Client) ListModels(ctx context.Context) ([]TagModel, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/tags", nil)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ollama tags %d: %s", resp.StatusCode, string(body))
	}
	var out TagsResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return out.Models, nil
}

// Ping returns true if Ollama is reachable.
func (c *Client) Ping(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/tags", nil)
	resp, err := c.http.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// --- /api/pull (stream) -----------------------------------------------------

type PullProgress struct {
	Status    string `json:"status"`
	Digest    string `json:"digest,omitempty"`
	Total     int64  `json:"total,omitempty"`
	Completed int64  `json:"completed,omitempty"`
}

// Pull installs a model and streams progress events. The callback runs once
// per NDJSON line; return false from the callback to abort.
func (c *Client) Pull(ctx context.Context, name string, onEvent func(PullProgress) bool) error {
	body, _ := json.Marshal(map[string]any{"name": name, "stream": true})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/pull", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ollama pull %d: %s", resp.StatusCode, string(b))
	}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		var ev PullProgress
		if err := json.Unmarshal(scanner.Bytes(), &ev); err != nil {
			continue
		}
		if onEvent != nil && !onEvent(ev) {
			return nil
		}
	}
	return scanner.Err()
}

// --- /api/delete ------------------------------------------------------------

func (c *Client) Delete(ctx context.Context, name string) error {
	body, _ := json.Marshal(map[string]any{"name": name})
	req, _ := http.NewRequestWithContext(ctx, http.MethodDelete, c.baseURL+"/api/delete", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ollama delete %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

// --- /api/chat (stream) -----------------------------------------------------

type ChatMessage struct {
	Role    string   `json:"role"`
	Content string   `json:"content"`
	// Images are base64-encoded payloads (no data URL prefix). Only sent when
	// non-empty; vision-capable models (llava, llama3.2-vision, etc.) consume them.
	Images []string `json:"images,omitempty"`
}

type ChatRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
	Stream   bool          `json:"stream"`
}

type ChatChunk struct {
	Model     string      `json:"model"`
	CreatedAt time.Time   `json:"created_at"`
	Message   ChatMessage `json:"message"`
	Done      bool        `json:"done"`
}

// ChatStream POSTs to /api/chat with stream=true and invokes onChunk per NDJSON
// line. Returning false from the callback aborts the read.
func (c *Client) ChatStream(ctx context.Context, req ChatRequest, onChunk func(ChatChunk) bool) error {
	req.Stream = true
	body, _ := json.Marshal(req)
	httpReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/chat", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ollama chat %d: %s", resp.StatusCode, string(b))
	}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		var chunk ChatChunk
		if err := json.Unmarshal(scanner.Bytes(), &chunk); err != nil {
			continue
		}
		if onChunk != nil && !onChunk(chunk) {
			return nil
		}
		if chunk.Done {
			return nil
		}
	}
	return scanner.Err()
}
