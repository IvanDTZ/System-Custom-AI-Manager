package authsvc

import (
	"errors"
	"strings"
	"time"

	"github.com/ivan/aimanager/internal/config"
	"github.com/ivan/aimanager/internal/models"
	"github.com/ivan/aimanager/internal/utils"
	"gorm.io/gorm"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrAccountPending     = errors.New("account pending approval")
	ErrAccountDisabled    = errors.New("account disabled")
)

type Service struct {
	db  *gorm.DB
	cfg *config.Config
}

func New(db *gorm.DB, cfg *config.Config) *Service {
	return &Service{db: db, cfg: cfg}
}

// Login authenticates a local user by email or username.
func (s *Service) Login(identifier, password string) (*models.User, string, error) {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" || password == "" {
		return nil, "", ErrInvalidCredentials
	}

	var user models.User
	q := s.db.Where("email = ? OR username = ?", identifier, identifier)
	if err := q.First(&user).Error; err != nil {
		return nil, "", ErrInvalidCredentials
	}
	if user.PasswordHash == "" || !utils.CheckPassword(user.PasswordHash, password) {
		return nil, "", ErrInvalidCredentials
	}
	switch user.Status {
	case models.StatusPending:
		return nil, "", ErrAccountPending
	case models.StatusDisabled:
		return nil, "", ErrAccountDisabled
	}

	token, err := utils.IssueJWT(s.cfg.JWTSecret, user.ID, user.Role, s.cfg.JWTExpiry)
	if err != nil {
		return nil, "", err
	}
	now := time.Now()
	s.db.Model(&user).Update("last_login_at", &now)
	user.LastLoginAt = &now
	return &user, token, nil
}

func (s *Service) IssueToken(user *models.User) (string, error) {
	return utils.IssueJWT(s.cfg.JWTSecret, user.ID, user.Role, s.cfg.JWTExpiry)
}
