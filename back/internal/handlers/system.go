package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/models"
	"github.com/ivan/aimanager/internal/services/ollama"
	"gorm.io/gorm"
)

type SystemHandler struct {
	db     *gorm.DB
	ollama *ollama.Client
}

func NewSystemHandler(db *gorm.DB, oll *ollama.Client) *SystemHandler {
	return &SystemHandler{db: db, ollama: oll}
}

func (h *SystemHandler) Status(c *gin.Context) {
	var (
		usersActive       int64
		modelsInstalled   int64
		chatsTotal        int64
		recentMsgs        int64
	)
	h.db.Model(&models.User{}).Where("status = ?", models.StatusActive).Count(&usersActive)
	h.db.Model(&models.AIModel{}).Where("is_installed = ?", true).Count(&modelsInstalled)
	h.db.Model(&models.Chat{}).Count(&chatsTotal)
	h.db.Model(&models.ChatMessage{}).Where("created_at > ?", time.Now().Add(-24*time.Hour)).Count(&recentMsgs)

	c.JSON(http.StatusOK, gin.H{
		"ollama_connected":   h.ollama.Ping(c.Request.Context()),
		"models_installed":   modelsInstalled,
		"users_active":       usersActive,
		"chats_total":        chatsTotal,
		"recent_messages_24h": recentMsgs,
	})
}
