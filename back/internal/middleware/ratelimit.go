package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/utils"
)

// PerIPRateLimiter applies a token bucket per client IP. perMinute = 0 disables it.
//
// Implementation: token bucket per IP with capacity = burst, refill rate = perMinute / 60s.
// Stale buckets are pruned every minute.
func PerIPRateLimiter(perMinute, burst int) gin.HandlerFunc {
	if perMinute <= 0 {
		return func(c *gin.Context) { c.Next() }
	}
	if burst <= 0 {
		burst = perMinute
	}
	rate := float64(perMinute) / 60.0 // tokens per second

	type bucket struct {
		tokens float64
		last   time.Time
	}

	var (
		mu      sync.Mutex
		buckets = make(map[string]*bucket)
	)

	// background pruner
	go func() {
		t := time.NewTicker(60 * time.Second)
		defer t.Stop()
		for now := range t.C {
			mu.Lock()
			for ip, b := range buckets {
				if now.Sub(b.last) > 5*time.Minute {
					delete(buckets, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		mu.Lock()
		b, ok := buckets[ip]
		if !ok {
			b = &bucket{tokens: float64(burst), last: now}
			buckets[ip] = b
		}
		// refill
		elapsed := now.Sub(b.last).Seconds()
		b.tokens += elapsed * rate
		if b.tokens > float64(burst) {
			b.tokens = float64(burst)
		}
		b.last = now

		if b.tokens < 1 {
			retry := int((1 - b.tokens) / rate)
			mu.Unlock()
			c.Header("Retry-After", itoa(retry+1))
			utils.Error(c, http.StatusTooManyRequests, "rate_limited", "Too many requests, slow down")
			return
		}
		b.tokens--
		mu.Unlock()
		c.Next()
	}
}

func itoa(n int) string {
	if n <= 0 {
		return "1"
	}
	var b [20]byte
	pos := len(b)
	for n > 0 {
		pos--
		b[pos] = byte('0' + n%10)
		n /= 10
	}
	return string(b[pos:])
}
