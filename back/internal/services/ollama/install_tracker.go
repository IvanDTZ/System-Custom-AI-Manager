package ollama

import (
	"sync"
	"time"
)

// InstallTracker keeps a registry of `ollama pull` operations currently in
// flight on this server. It exists so that:
//
//  1. Two admins cannot start the same pull twice (we serve a 409).
//  2. Any admin can poll for what's being installed right now, even if they
//     didn't start it.
//
// The tracker is purely in-memory — restarting the backend forgets it. That's
// fine: a pull is bound to the process anyway.
type InstallTracker struct {
	mu      sync.RWMutex
	entries map[string]*InstallEntry
}

type InstallEntry struct {
	Name      string    `json:"name"`
	Status    string    `json:"status"`     // "installing" | "done" | "error"
	Latest    string    `json:"latest"`     // last progress line ("pulling …", "verifying", etc.)
	Total     int64     `json:"total"`      // bytes (0 if unknown)
	Completed int64     `json:"completed"`  // bytes downloaded so far
	Error     string    `json:"error,omitempty"`
	StartedAt time.Time `json:"started_at"`
	UpdatedAt time.Time `json:"updated_at"`
	StartedBy uint      `json:"started_by"` // user id who triggered it
}

func NewInstallTracker() *InstallTracker {
	return &InstallTracker{entries: make(map[string]*InstallEntry)}
}

// Start registers a new in-flight pull. Returns false if one with the same
// name is already running — caller should refuse the duplicate.
func (t *InstallTracker) Start(name string, userID uint) (*InstallEntry, bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if existing, ok := t.entries[name]; ok && existing.Status == "installing" {
		return existing, false
	}
	now := time.Now()
	e := &InstallEntry{
		Name:      name,
		Status:    "installing",
		StartedAt: now,
		UpdatedAt: now,
		StartedBy: userID,
	}
	t.entries[name] = e
	return e, true
}

// Update bumps the latest progress event for an in-flight pull. Silently no-op
// if the entry is gone (e.g. someone called Done already).
func (t *InstallTracker) Update(name, latest string, total, completed int64) {
	t.mu.Lock()
	defer t.mu.Unlock()
	e, ok := t.entries[name]
	if !ok {
		return
	}
	if latest != "" {
		e.Latest = latest
	}
	if total > 0 {
		e.Total = total
	}
	if completed > 0 {
		e.Completed = completed
	}
	e.UpdatedAt = time.Now()
}

// Done marks a pull as finished. Keeps the entry around briefly so polling
// clients see the success state once before it disappears.
func (t *InstallTracker) Done(name string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if e, ok := t.entries[name]; ok {
		e.Status = "done"
		e.UpdatedAt = time.Now()
	}
}

// Error marks a pull as failed. Same rationale as Done.
func (t *InstallTracker) Error(name, errMsg string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if e, ok := t.entries[name]; ok {
		e.Status = "error"
		e.Error = errMsg
		e.UpdatedAt = time.Now()
	}
}

// Cancel removes the entry. Used when a pull is aborted by the same admin who
// started it.
func (t *InstallTracker) Cancel(name string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.entries, name)
}

// List returns a snapshot of every active or recently finished pull. Old
// finished entries (>30 s) are purged on read so the response stays small.
func (t *InstallTracker) List() []InstallEntry {
	t.mu.Lock()
	defer t.mu.Unlock()
	cutoff := time.Now().Add(-30 * time.Second)
	out := make([]InstallEntry, 0, len(t.entries))
	for name, e := range t.entries {
		if e.Status != "installing" && e.UpdatedAt.Before(cutoff) {
			delete(t.entries, name)
			continue
		}
		out = append(out, *e)
	}
	return out
}

// IsActive returns true if the named model is currently being pulled.
func (t *InstallTracker) IsActive(name string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	e, ok := t.entries[name]
	return ok && e.Status == "installing"
}
