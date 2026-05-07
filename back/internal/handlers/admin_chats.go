package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/models"
	"github.com/ivan/aimanager/internal/utils"
	"gorm.io/gorm"
)

type AdminChatsHandler struct {
	db *gorm.DB
}

func NewAdminChatsHandler(db *gorm.DB) *AdminChatsHandler {
	return &AdminChatsHandler{db: db}
}

func (h *AdminChatsHandler) ListAll(c *gin.Context) {
	var chats []models.Chat
	if err := h.db.Preload("User").Order("updated_at DESC").Limit(500).Find(&chats).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"chats": chats})
}

func (h *AdminChatsHandler) ListByUser(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_id", "Invalid id")
		return
	}
	var chats []models.Chat
	if err := h.db.Where("user_id = ?", id).Order("updated_at DESC").Find(&chats).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"chats": chats})
}

func (h *AdminChatsHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_id", "Invalid id")
		return
	}
	var chat models.Chat
	if err := h.db.Preload("User").First(&chat, id).Error; err != nil {
		utils.Error(c, http.StatusNotFound, "not_found", "Chat not found")
		return
	}
	var msgs []models.ChatMessage
	h.db.Where("chat_id = ?", chat.ID).Order("created_at ASC").Find(&msgs)
	chat.Messages = msgs
	c.JSON(http.StatusOK, gin.H{"chat": chat})
}
