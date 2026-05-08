package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	AppEnv          string
	FrontendURL     string
	AllowedOrigins  []string

	UseMariaDB bool

	MariaDBHost     string
	MariaDBPort     string
	MariaDBUser     string
	MariaDBPassword string
	MariaDBDatabase string

	SQLitePath string

	JWTSecret      string
	JWTExpiry      time.Duration

	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	OllamaBaseURL        string
	OllamaMaxConcurrency int

	LoginRateLimitPerMinute  int
	StreamRateLimitPerMinute int
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("config: no .env file found, falling back to environment variables")
	}

	cfg := &Config{
		Port:               getEnv("PORT", "8080"),
		AppEnv:             getEnv("APP_ENV", "development"),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:5173"),
		UseMariaDB:         getEnvBool("USE_MARIADB", false),
		MariaDBHost:        getEnv("MARIADB_HOST", "localhost"),
		MariaDBPort:        getEnv("MARIADB_PORT", "3306"),
		MariaDBUser:        getEnv("MARIADB_USER", ""),
		MariaDBPassword:    getEnv("MARIADB_PASSWORD", ""),
		MariaDBDatabase:    getEnv("MARIADB_DATABASE", ""),
		SQLitePath:         getEnv("SQLITE_PATH", "./data/app.db"),
		JWTSecret:          getEnv("JWT_SECRET", ""),
		JWTExpiry:          time.Duration(getEnvInt("JWT_EXPIRY_HOURS", 24)) * time.Hour,
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/auth/google/callback"),
		OllamaBaseURL:            getEnv("OLLAMA_BASE_URL", "http://localhost:11434"),
		OllamaMaxConcurrency:     getEnvInt("OLLAMA_MAX_CONCURRENCY", 2),
		LoginRateLimitPerMinute:  getEnvInt("LOGIN_RATE_LIMIT_PER_MINUTE", 10),
		StreamRateLimitPerMinute: getEnvInt("STREAM_RATE_LIMIT_PER_MINUTE", 30),
	}

	origins := getEnv("ALLOWED_ORIGINS", cfg.FrontendURL)
	for _, o := range strings.Split(origins, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			cfg.AllowedOrigins = append(cfg.AllowedOrigins, o)
		}
	}

	if cfg.JWTSecret == "" {
		log.Println("WARNING: JWT_SECRET is empty — set it in .env before running in production")
	}

	return cfg
}

func (c *Config) MariaDBDSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		c.MariaDBUser, c.MariaDBPassword, c.MariaDBHost, c.MariaDBPort, c.MariaDBDatabase)
}

func (c *Config) IsGoogleOAuthConfigured() bool {
	return c.GoogleClientID != "" && c.GoogleClientSecret != ""
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func getEnvInt(key string, fallback int) int {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil {
		return fallback
	}
	return n
}
