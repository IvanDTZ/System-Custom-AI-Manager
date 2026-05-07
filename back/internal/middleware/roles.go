package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/utils"
)

// RequireRole accepts the request only if the current user's role is in the list.
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(c *gin.Context) {
		u := CurrentUser(c)
		if u == nil {
			utils.Error(c, http.StatusUnauthorized, "missing_token", "Authentication required")
			return
		}
		if _, ok := allowed[u.Role]; !ok {
			utils.Error(c, http.StatusForbidden, "forbidden", "Insufficient permissions")
			return
		}
		c.Next()
	}
}
