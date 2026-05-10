package routes

import (
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/config"
	"github.com/ivan/aimanager/internal/handlers"
	"github.com/ivan/aimanager/internal/middleware"
	"github.com/ivan/aimanager/internal/models"
	authsvc "github.com/ivan/aimanager/internal/services/auth"
	"github.com/ivan/aimanager/internal/services/ollama"
	"gorm.io/gorm"
)

type Deps struct {
	Cfg    *config.Config
	DB     *gorm.DB
	Ollama *ollama.Client
	Sem    *ollama.Semaphore
}

// originMatcher returns a function that decides whether a CORS Origin is
// allowed. Each entry in cfg.AllowedOrigins is either an exact match
// ("https://example.com") or a suffix wildcard ("https://*.ngrok-free.dev",
// matches any subdomain). Empty list → allow nothing.
func originMatcher(allowed []string) func(string) bool {
	exact := make(map[string]bool, len(allowed))
	suffixes := make([]string, 0)
	for _, raw := range allowed {
		o := strings.TrimSpace(raw)
		if o == "" {
			continue
		}
		if i := strings.Index(o, "*."); i >= 0 {
			// "https://*.ngrok-free.dev" → suffix "://" + ".ngrok-free.dev"
			scheme := o[:i]
			rest := o[i+1:] // ".ngrok-free.dev"
			suffixes = append(suffixes, scheme+rest)
		} else {
			exact[o] = true
		}
	}
	return func(origin string) bool {
		if origin == "" {
			return false
		}
		if exact[origin] {
			return true
		}
		for _, suf := range suffixes {
			// match scheme prefix and host suffix: e.g. "https://" + "x.ngrok-free.dev"
			schemeEnd := strings.Index(suf, "://")
			if schemeEnd < 0 {
				continue
			}
			scheme := suf[:schemeEnd+3]
			hostSuffix := suf[schemeEnd+3:]
			if strings.HasPrefix(origin, scheme) && strings.HasSuffix(origin, hostSuffix) {
				return true
			}
		}
		return false
	}
}

func Register(r *gin.Engine, d Deps) {
	r.Use(cors.New(cors.Config{
		AllowOriginFunc:  originMatcher(d.Cfg.AllowedOrigins),
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	auth := authsvc.New(d.DB, d.Cfg)
	google := authsvc.NewGoogle(d.DB, d.Cfg)

	authH := handlers.NewAuthHandler(d.Cfg, auth, google)
	usersH := handlers.NewAdminUsersHandler(d.DB)
	modelsH := handlers.NewModelsHandler(d.DB, d.Ollama)
	catsH := handlers.NewCategoriesHandler(d.DB)
	chatH := handlers.NewChatHandler(d.DB, d.Ollama, d.Sem)
	adminChatH := handlers.NewAdminChatsHandler(d.DB)
	sysH := handlers.NewSystemHandler(d.DB, d.Ollama)

	loginLimit := middleware.PerIPRateLimiter(d.Cfg.LoginRateLimitPerMinute, max(d.Cfg.LoginRateLimitPerMinute, 5))
	streamLimit := middleware.PerIPRateLimiter(d.Cfg.StreamRateLimitPerMinute, max(d.Cfg.StreamRateLimitPerMinute, 10))

	api := r.Group("/api")

	// Public
	api.POST("/auth/login", loginLimit, authH.Login)
	api.GET("/auth/google", authH.GoogleStart)
	api.GET("/auth/google/callback", authH.GoogleCallback)
	api.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	// Authenticated
	authed := api.Group("")
	authed.Use(middleware.Auth(d.Cfg, d.DB))
	{
		authed.GET("/auth/me", authH.Me)
		authed.POST("/auth/logout", authH.Logout)

		authed.GET("/models", modelsH.PublicList)

		authed.GET("/chats", chatH.List)
		authed.POST("/chats", chatH.Create)
		authed.GET("/chats/:id", chatH.Get)
		authed.DELETE("/chats/:id", chatH.Delete)
		authed.POST("/chats/:id/stream", streamLimit, chatH.Stream)
	}

	// Admin
	admin := api.Group("/admin")
	admin.Use(middleware.Auth(d.Cfg, d.DB), middleware.RequireRole(models.RoleAdmin, models.RoleSuperAdmin))
	{
		admin.GET("/users", usersH.List)
		admin.POST("/users", usersH.Create)
		admin.PATCH("/users/:id", usersH.Update)
		admin.POST("/users/:id/approve", usersH.Approve)
		admin.POST("/users/:id/disable", usersH.Disable)
		admin.POST("/users/:id/enable", usersH.Enable)
		admin.POST("/users/:id/reset-password", usersH.ResetPassword)

		admin.GET("/models", modelsH.AdminList)
		admin.POST("/models/sync", modelsH.Sync)
		admin.POST("/models/install", modelsH.Install)
		admin.POST("/models/:id/forget", modelsH.Forget)
		admin.DELETE("/models/:name", modelsH.Uninstall)
		admin.PATCH("/models/:id", modelsH.Update)

		admin.GET("/categories", catsH.List)
		admin.POST("/categories", catsH.Create)
		admin.PATCH("/categories/:id", catsH.Update)

		admin.GET("/chats", adminChatH.ListAll)
		admin.GET("/users/:id/chats", adminChatH.ListByUser)
		admin.GET("/chats/:id", adminChatH.Get)

		admin.GET("/system/status", sysH.Status)
	}
}
