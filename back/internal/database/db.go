package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/ivan/aimanager/internal/config"
	"github.com/ivan/aimanager/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(cfg *config.Config) (*gorm.DB, error) {
	gormLogger := logger.New(
		log.New(os.Stderr, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)
	gormCfg := &gorm.Config{
		Logger: gormLogger,
	}

	var db *gorm.DB
	var err error

	if cfg.UseMariaDB {
		log.Println("database: using MariaDB")
		db, err = gorm.Open(mysql.Open(cfg.MariaDBDSN()), gormCfg)
	} else {
		log.Println("database: using SQLite at", cfg.SQLitePath)
		if err := os.MkdirAll(filepath.Dir(cfg.SQLitePath), 0o755); err != nil {
			return nil, fmt.Errorf("create sqlite dir: %w", err)
		}
		db, err = gorm.Open(sqlite.Open(cfg.SQLitePath), gormCfg)
	}
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	if err := AutoMigrate(db); err != nil {
		return nil, fmt.Errorf("auto-migrate: %w", err)
	}
	if err := SeedDefaults(db); err != nil {
		return nil, fmt.Errorf("seed: %w", err)
	}
	return db, nil
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.ModelCategory{},
		&models.AIModel{},
		&models.Chat{},
		&models.ChatMessage{},
	)
}
