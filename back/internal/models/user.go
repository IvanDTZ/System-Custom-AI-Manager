package models

import (
	"encoding/json"
	"time"
)

const (
	RoleSuperAdmin = "SUPER_ADMIN"
	RoleAdmin      = "ADMIN"
	RoleUser       = "USER"

	StatusPending  = "pending"
	StatusActive   = "active"
	StatusDisabled = "disabled"

	ProviderLocal  = "local"
	ProviderGoogle = "google"
)

type User struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	Name         string     `gorm:"size:120" json:"name"`
	Username     string     `gorm:"size:80;uniqueIndex" json:"username"`
	Email        string     `gorm:"size:255;uniqueIndex;not null" json:"email"`
	PasswordHash string     `gorm:"size:255" json:"-"`
	Provider     string     `gorm:"size:20;default:local" json:"provider"`
	GoogleID     string     `gorm:"size:64;index" json:"google_id,omitempty"`
	Role         string     `gorm:"size:20;default:USER" json:"role"`
	Status       string     `gorm:"size:20;default:pending" json:"status"`
	AvatarURL    string     `gorm:"size:500" json:"avatar_url,omitempty"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// MarshalJSON belt-and-suspenders: never expose the password hash.
func (u User) MarshalJSON() ([]byte, error) {
	type alias User
	a := alias(u)
	a.PasswordHash = ""
	return json.Marshal(a)
}

func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin || u.Role == RoleSuperAdmin
}

func (u *User) IsActive() bool {
	return u.Status == StatusActive
}
