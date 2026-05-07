package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/middleware"
	"github.com/ivan/aimanager/internal/models"
	"github.com/ivan/aimanager/internal/services/ollama"
	"github.com/ivan/aimanager/internal/utils"
	"gorm.io/gorm"
)

type ChatHandler struct {
	db     *gorm.DB
	ollama *ollama.Client
}

func NewChatHandler(db *gorm.DB, oll *ollama.Client) *ChatHandler {
	return &ChatHandler{db: db, ollama: oll}
}

func (h *ChatHandler) List(c *gin.Context) {
	user := middleware.CurrentUser(c)
	var chats []models.Chat
	if err := h.db.Where("user_id = ?", user.ID).Order("updated_at DESC").Find(&chats).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"chats": chats})
}

type createChatReq struct {
	Title     string `json:"title"`
	ModelName string `json:"model_name" binding:"required"`
}

func (h *ChatHandler) Create(c *gin.Context) {
	user := middleware.CurrentUser(c)
	var req createChatReq
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "New chat"
	}
	chat := models.Chat{UserID: user.ID, Title: title, ModelName: req.ModelName}
	if err := h.db.Create(&chat).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "create_failed", err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{"chat": chat})
}

func (h *ChatHandler) Get(c *gin.Context) {
	chat, ok := h.findOwnedChat(c)
	if !ok {
		return
	}
	var msgs []models.ChatMessage
	h.db.Where("chat_id = ?", chat.ID).Order("created_at ASC").Find(&msgs)
	chat.Messages = msgs
	c.JSON(http.StatusOK, gin.H{"chat": chat})
}

func (h *ChatHandler) Delete(c *gin.Context) {
	chat, ok := h.findOwnedChat(c)
	if !ok {
		return
	}
	h.db.Where("chat_id = ?", chat.ID).Delete(&models.ChatMessage{})
	h.db.Delete(chat)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type sendMessageReq struct {
	Content string `json:"content" binding:"required"`
}

// Stream SSE: writes each token as it arrives from Ollama, persists user
// message immediately and assistant message at the end.
func (h *ChatHandler) Stream(c *gin.Context) {
	chat, ok := h.findOwnedChat(c)
	if !ok {
		return
	}
	var req sendMessageReq
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	// Verify model is enabled.
	var model models.AIModel
	if err := h.db.Where("ollama_name = ? AND is_installed = ? AND is_enabled = ?", chat.ModelName, true, true).First(&model).Error; err != nil {
		utils.Error(c, http.StatusBadRequest, "model_unavailable", "The selected model is not available")
		return
	}

	// Persist user message.
	userMsg := models.ChatMessage{
		ChatID:  chat.ID,
		Role:    models.MessageRoleUser,
		Content: req.Content,
	}
	if err := h.db.Create(&userMsg).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	// Auto-title if this is the first user message.
	if strings.EqualFold(chat.Title, "New chat") {
		t := req.Content
		if len(t) > 60 {
			t = t[:60]
		}
		h.db.Model(chat).Update("title", t)
	}

	// Build the conversation history.
	var history []models.ChatMessage
	h.db.Where("chat_id = ?", chat.ID).Order("created_at ASC").Find(&history)
	ollamaMsgs := make([]ollama.ChatMessage, 0, len(history))
	for _, m := range history {
		ollamaMsgs = append(ollamaMsgs, ollama.ChatMessage{Role: m.Role, Content: m.Content})
	}

	// SSE headers.
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	flusher, _ := c.Writer.(http.Flusher)

	var sb strings.Builder
	err := h.ollama.ChatStream(c.Request.Context(),
		ollama.ChatRequest{Model: chat.ModelName, Messages: ollamaMsgs},
		func(chunk ollama.ChatChunk) bool {
			if chunk.Message.Content != "" {
				sb.WriteString(chunk.Message.Content)
				b, _ := json.Marshal(gin.H{"content": chunk.Message.Content})
				c.Writer.Write([]byte("event: token\ndata: "))
				c.Writer.Write(b)
				c.Writer.Write([]byte("\n\n"))
				if flusher != nil {
					flusher.Flush()
				}
			}
			return true
		})
	if err != nil {
		b, _ := json.Marshal(gin.H{"error": err.Error()})
		c.Writer.Write([]byte("event: error\ndata: "))
		c.Writer.Write(b)
		c.Writer.Write([]byte("\n\n"))
		if flusher != nil {
			flusher.Flush()
		}
		return
	}

	assistantMsg := models.ChatMessage{
		ChatID:    chat.ID,
		Role:      models.MessageRoleAssistant,
		Content:   sb.String(),
		ModelName: chat.ModelName,
	}
	h.db.Create(&assistantMsg)
	h.db.Model(chat).Update("updated_at", gorm.Expr("CURRENT_TIMESTAMP"))

	b, _ := json.Marshal(gin.H{"chat_id": chat.ID, "message_id": assistantMsg.ID})
	c.Writer.Write([]byte("event: done\ndata: "))
	c.Writer.Write(b)
	c.Writer.Write([]byte("\n\n"))
	if flusher != nil {
		flusher.Flush()
	}
}

func (h *ChatHandler) findOwnedChat(c *gin.Context) (*models.Chat, bool) {
	user := middleware.CurrentUser(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_id", "Invalid chat id")
		return nil, false
	}
	var chat models.Chat
	if err := h.db.First(&chat, id).Error; err != nil {
		utils.Error(c, http.StatusNotFound, "not_found", "Chat not found")
		return nil, false
	}
	if chat.UserID != user.ID && !user.IsAdmin() {
		utils.Error(c, http.StatusForbidden, "forbidden", "Not your chat")
		return nil, false
	}
	return &chat, true
}
