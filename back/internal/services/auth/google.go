package authsvc

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/ivan/aimanager/internal/config"
	"github.com/ivan/aimanager/internal/models"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
)

const googleStateMaxAge = 5 * time.Minute

type GoogleService struct {
	db     *gorm.DB
	cfg    *config.Config
	oauth  *oauth2.Config
}

type GoogleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func NewGoogle(db *gorm.DB, cfg *config.Config) *GoogleService {
	g := &GoogleService{db: db, cfg: cfg}
	if cfg.IsGoogleOAuthConfigured() {
		g.oauth = &oauth2.Config{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleClientSecret,
			RedirectURL:  cfg.GoogleRedirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		}
	}
	return g
}

func (g *GoogleService) IsConfigured() bool { return g.oauth != nil }

// AuthURL returns a Google OAuth URL with a signed, short-lived state.
func (g *GoogleService) AuthURL() (string, error) {
	if !g.IsConfigured() {
		return "", errors.New("google oauth not configured")
	}
	state, err := g.signState()
	if err != nil {
		return "", err
	}
	return g.oauth.AuthCodeURL(state, oauth2.AccessTypeOnline), nil
}

// HandleCallback exchanges code → tokens → userinfo, then upserts the user.
func (g *GoogleService) HandleCallback(ctx context.Context, code, state string) (*models.User, error) {
	if !g.IsConfigured() {
		return nil, errors.New("google oauth not configured")
	}
	if err := g.verifyState(state); err != nil {
		return nil, err
	}

	tok, err := g.oauth.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("exchange: %w", err)
	}

	info, err := g.fetchUserInfo(ctx, tok)
	if err != nil {
		return nil, err
	}
	if info.Email == "" {
		return nil, errors.New("google did not return an email")
	}

	user, err := g.upsertUser(info)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (g *GoogleService) fetchUserInfo(ctx context.Context, tok *oauth2.Token) (*GoogleUserInfo, error) {
	client := g.oauth.Client(ctx, tok)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://openidconnect.googleapis.com/v1/userinfo", nil)
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("userinfo: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("userinfo status %d: %s", resp.StatusCode, string(body))
	}
	var info GoogleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("decode userinfo: %w", err)
	}
	return &info, nil
}

func (g *GoogleService) upsertUser(info *GoogleUserInfo) (*models.User, error) {
	email := strings.ToLower(strings.TrimSpace(info.Email))

	var user models.User
	// 1. By google_id
	if err := g.db.Where("google_id = ?", info.Sub).First(&user).Error; err == nil {
		now := time.Now()
		g.db.Model(&user).Updates(map[string]any{
			"name":          coalesce(user.Name, info.Name),
			"avatar_url":    coalesce(user.AvatarURL, info.Picture),
			"last_login_at": &now,
		})
		user.LastLoginAt = &now
		return &user, nil
	}
	// 2. By email — link the existing local account.
	if err := g.db.Where("email = ?", email).First(&user).Error; err == nil {
		now := time.Now()
		g.db.Model(&user).Updates(map[string]any{
			"google_id":     info.Sub,
			"avatar_url":    coalesce(user.AvatarURL, info.Picture),
			"name":          coalesce(user.Name, info.Name),
			"last_login_at": &now,
		})
		user.GoogleID = info.Sub
		user.LastLoginAt = &now
		return &user, nil
	}
	// 3. Brand-new user → pending.
	newUser := models.User{
		Name:      info.Name,
		Email:     email,
		Provider:  models.ProviderGoogle,
		GoogleID:  info.Sub,
		Role:      models.RoleUser,
		Status:    models.StatusPending,
		AvatarURL: info.Picture,
	}
	if err := g.db.Create(&newUser).Error; err != nil {
		return nil, err
	}
	return &newUser, nil
}

// signState produces "<base64(payload)>.<hex(hmac)>".
func (g *GoogleService) signState() (string, error) {
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	payload := fmt.Sprintf("%d.%s", time.Now().Unix(), base64.RawURLEncoding.EncodeToString(nonce))
	mac := hmac.New(sha256.New, []byte(g.cfg.JWTSecret))
	mac.Write([]byte(payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return payload + "." + sig, nil
}

func (g *GoogleService) verifyState(state string) error {
	parts := strings.SplitN(state, ".", 3)
	if len(parts) != 3 {
		return errors.New("invalid state format")
	}
	payload := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, []byte(g.cfg.JWTSecret))
	mac.Write([]byte(payload))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return errors.New("invalid state signature")
	}
	var ts int64
	if _, err := fmt.Sscanf(parts[0], "%d", &ts); err != nil {
		return errors.New("invalid state timestamp")
	}
	if time.Since(time.Unix(ts, 0)) > googleStateMaxAge {
		return errors.New("state expired")
	}
	return nil
}

func coalesce(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
