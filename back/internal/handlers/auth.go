package handlers

import (
	"errors"
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/config"
	"github.com/ivan/aimanager/internal/middleware"
	authsvc "github.com/ivan/aimanager/internal/services/auth"
	"github.com/ivan/aimanager/internal/utils"
)

type AuthHandler struct {
	cfg    *config.Config
	auth   *authsvc.Service
	google *authsvc.GoogleService
}

func NewAuthHandler(cfg *config.Config, auth *authsvc.Service, google *authsvc.GoogleService) *AuthHandler {
	return &AuthHandler{cfg: cfg, auth: auth, google: google}
}

type loginReq struct {
	Identifier string `json:"identifier" binding:"required"`
	Password   string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_request", "Invalid payload")
		return
	}
	user, token, err := h.auth.Login(req.Identifier, req.Password)
	if err != nil {
		switch {
		case errors.Is(err, authsvc.ErrAccountPending):
			utils.Error(c, http.StatusForbidden, "account_pending", "Your account is pending approval")
		case errors.Is(err, authsvc.ErrAccountDisabled):
			utils.Error(c, http.StatusForbidden, "account_disabled", "Your account is disabled")
		default:
			utils.Error(c, http.StatusUnauthorized, "invalid_credentials", "Invalid email or password")
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func (h *AuthHandler) Me(c *gin.Context) {
	u := middleware.CurrentUser(c)
	c.JSON(http.StatusOK, gin.H{"user": u})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	// Stateless: client deletes the token.
	c.Status(http.StatusNoContent)
}

func (h *AuthHandler) GoogleStart(c *gin.Context) {
	if !h.google.IsConfigured() {
		utils.Error(c, http.StatusServiceUnavailable, "google_not_configured", "Google OAuth is not configured")
		return
	}
	u, err := h.google.AuthURL()
	if err != nil {
		utils.Error(c, http.StatusInternalServerError, "google_url", err.Error())
		return
	}
	c.Redirect(http.StatusFound, u)
}

func (h *AuthHandler) GoogleCallback(c *gin.Context) {
	if !h.google.IsConfigured() {
		utils.Error(c, http.StatusServiceUnavailable, "google_not_configured", "Google OAuth is not configured")
		return
	}
	code := c.Query("code")
	state := c.Query("state")
	if code == "" || state == "" {
		h.redirectWithStatus("error", "missing_params", c)
		return
	}
	user, err := h.google.HandleCallback(c.Request.Context(), code, state)
	if err != nil {
		h.redirectWithStatus("error", err.Error(), c)
		return
	}
	if user.Status != "active" {
		h.redirectWithStatus(user.Status, "", c)
		return
	}
	token, err := h.auth.IssueToken(user)
	if err != nil {
		h.redirectWithStatus("error", err.Error(), c)
		return
	}
	q := url.Values{}
	q.Set("token", token)
	c.Redirect(http.StatusFound, h.cfg.FrontendURL+"/auth/callback?"+q.Encode())
}

func (h *AuthHandler) redirectWithStatus(status, msg string, c *gin.Context) {
	q := url.Values{}
	q.Set("status", status)
	if msg != "" {
		q.Set("message", msg)
	}
	c.Redirect(http.StatusFound, h.cfg.FrontendURL+"/auth/pending?"+q.Encode())
}
