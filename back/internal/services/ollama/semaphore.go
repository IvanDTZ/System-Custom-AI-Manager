package ollama

import (
	"context"
	"errors"
	"sync/atomic"
)

// Semaphore is a counting semaphore with context-aware Acquire and live
// "pending" / "in-flight" stats so the API can tell users their queue position.
type Semaphore struct {
	slots    chan struct{}
	cap      int
	pending  atomic.Int64
	inFlight atomic.Int64
}

func NewSemaphore(capacity int) *Semaphore {
	if capacity < 1 {
		capacity = 1
	}
	return &Semaphore{
		slots: make(chan struct{}, capacity),
		cap:   capacity,
	}
}

// Acquire blocks until a slot is available or ctx is cancelled.
func (s *Semaphore) Acquire(ctx context.Context) error {
	if s == nil {
		return nil
	}
	s.pending.Add(1)
	defer s.pending.Add(-1)
	select {
	case s.slots <- struct{}{}:
		s.inFlight.Add(1)
		return nil
	case <-ctx.Done():
		return errors.Join(ctx.Err(), errors.New("waiting for slot"))
	}
}

func (s *Semaphore) Release() {
	if s == nil {
		return
	}
	s.inFlight.Add(-1)
	<-s.slots
}

// Stats returns (capacity, in-flight, pending).
func (s *Semaphore) Stats() (int, int64, int64) {
	if s == nil {
		return 0, 0, 0
	}
	return s.cap, s.inFlight.Load(), s.pending.Load()
}
