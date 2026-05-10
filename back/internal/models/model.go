package models

import "time"

type AIModel struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	OllamaName  string `gorm:"size:120;uniqueIndex;not null" json:"ollama_name"`
	DisplayName string `gorm:"size:120" json:"display_name"`
	Description string `gorm:"size:500" json:"description"`

	// Legacy single-category column. Kept for backwards compatibility but new
	// code should write through Categories (many-to-many) instead.
	CategoryID *uint          `json:"category_id,omitempty"`
	Category   *ModelCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`

	// Categories is the modern multi-category association. GORM creates the
	// pivot table `ai_model_categories` automatically.
	Categories []ModelCategory `gorm:"many2many:ai_model_categories;" json:"categories"`

	IsInstalled   bool      `gorm:"default:false" json:"is_installed"`
	IsEnabled     bool      `gorm:"default:false" json:"is_enabled"`
	Size          int64     `json:"size"`
	Family        string    `gorm:"size:80" json:"family"`
	ParameterSize string    `gorm:"size:40" json:"parameter_size"`
	Quantization  string    `gorm:"size:40" json:"quantization"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
