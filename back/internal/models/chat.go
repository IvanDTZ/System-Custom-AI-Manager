package models

import (
	"encoding/json"
	"time"
)

const (
	MessageRoleUser      = "user"
	MessageRoleAssistant = "assistant"
	MessageRoleSystem    = "system"
)

type Chat struct {
	ID        uint          `gorm:"primaryKey" json:"id"`
	UserID    uint          `gorm:"index;not null" json:"user_id"`
	User      *User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Title     string        `gorm:"size:255" json:"title"`
	ModelName string        `gorm:"size:120" json:"model_name"`
	Messages  []ChatMessage `gorm:"foreignKey:ChatID;constraint:OnDelete:CASCADE" json:"messages,omitempty"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

// ChatMessage is one entry in a chat. Images are stored as a JSON array of
// base64-encoded data URLs (without the "data:image/...;base64," prefix), so
// MariaDB MEDIUMTEXT and SQLite TEXT both fit comfortably for normal-size files.
type ChatMessage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ChatID    uint      `gorm:"index;not null" json:"chat_id"`
	Role      string    `gorm:"size:20;not null" json:"role"`
	Content   string    `gorm:"type:text" json:"content"`
	Images    string    `gorm:"type:mediumtext" json:"-"`
	ModelName string    `gorm:"size:120" json:"model_name,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// GetImages parses the JSON-encoded image list. Returns nil for messages
// without images.
func (m *ChatMessage) GetImages() []string {
	if m.Images == "" {
		return nil
	}
	var out []string
	if err := json.Unmarshal([]byte(m.Images), &out); err != nil {
		return nil
	}
	return out
}

// SetImages stores the list as JSON. Empty list clears the column.
func (m *ChatMessage) SetImages(images []string) {
	if len(images) == 0 {
		m.Images = ""
		return
	}
	b, err := json.Marshal(images)
	if err != nil {
		m.Images = ""
		return
	}
	m.Images = string(b)
}

// MarshalJSON exposes images as a top-level array so the frontend can render
// them, while the on-disk column stays packed as JSON.
func (m ChatMessage) MarshalJSON() ([]byte, error) {
	type alias ChatMessage
	return json.Marshal(struct {
		alias
		Images []string `json:"images,omitempty"`
	}{
		alias:  alias(m),
		Images: m.GetImages(),
	})
}
