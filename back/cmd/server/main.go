package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/config"
	"github.com/ivan/aimanager/internal/database"
	"github.com/ivan/aimanager/internal/routes"
	"github.com/ivan/aimanager/internal/services/ollama"
)

func main() {
	cfg := config.Load()

	db, err := database.Open(cfg)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	oll := ollama.New(cfg.OllamaBaseURL)
	sem := ollama.NewSemaphore(cfg.OllamaMaxConcurrency)
	installs := ollama.NewInstallTracker()

	if cfg.IsGoogleOAuthConfigured() {
		log.Printf("google oauth: configured (redirect=%s)", cfg.GoogleRedirectURL)
	} else {
		log.Printf("google oauth: NOT configured — fill GOOGLE_CLIENT_ID/SECRET/REDIRECT_URL in .env")
	}
	log.Printf("ollama: %s (max concurrency=%d)", cfg.OllamaBaseURL, cfg.OllamaMaxConcurrency)

	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())
	if cfg.AppEnv != "production" {
		r.Use(gin.Logger())
	}

	routes.Register(r, routes.Deps{Cfg: cfg, DB: db, Ollama: oll, Sem: sem, Installs: installs})

	addr := ":" + cfg.Port
	log.Printf("server listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server: %v", err)
	}
}
