package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/config"
	"github.com/ivan/aimanager/internal/models"
	"github.com/ivan/aimanager/internal/utils"
	"gorm.io/gorm"
)

const ContextUserKey = "currentUser"

// Auth verifies the JWT, loads the user from DB and stores it in the context.
// Rejects pending/disabled users.
func Auth(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := extractToken(c)
		if raw == "" {
			utils.Error(c, http.StatusUnauthorized, "missing_token", "Authentication required")
			return
		}
		claims, err := utils.ParseJWT(cfg.JWTSecret, raw)
		if err != nil {
			utils.Error(c, http.StatusUnauthorized, "invalid_token", "Invalid or expired token")
			return
		}

		var user models.User
		if err := db.First(&user, claims.UserID).Error; err != nil {
			utils.Error(c, http.StatusUnauthorized, "user_not_found", "User no longer exists")
			return
		}
		switch user.Status {
		case models.StatusPending:
			utils.Error(c, http.StatusForbidden, "account_pending", "Your account is pending approval")
			return
		case models.StatusDisabled:
			utils.Error(c, http.StatusForbidden, "account_disabled", "Your account is disabled")
			return
		}
		c.Set(ContextUserKey, &user)
		c.Next()
	}
}

func extractToken(c *gin.Context) string {
	h := c.GetHeader("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}
	// Fallback for SSE consumers that can't easily set headers (e.g. EventSource):
	if t := c.Query("token"); t != "" {
		return t
	}
	return ""
}

// CurrentUser fetches the user attached by the Auth middleware.
func CurrentUser(c *gin.Context) *models.User {
	v, ok := c.Get(ContextUserKey)
	if !ok {
		return nil
	}
	u, ok := v.(*models.User)
	if !ok {
		return nil
	}
	return u
}
