package models

import "time"

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

type ChatMessage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ChatID    uint      `gorm:"index;not null" json:"chat_id"`
	Role      string    `gorm:"size:20;not null" json:"role"`
	Content   string    `gorm:"type:text" json:"content"`
	ModelName string    `gorm:"size:120" json:"model_name,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}
