package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

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
	sem    *ollama.Semaphore

	// One in-flight stream per user. New requests cancel the previous one.
	streamMu      sync.Mutex
	activeStreams map[uint]context.CancelFunc
}

func NewChatHandler(db *gorm.DB, oll *ollama.Client, sem *ollama.Semaphore) *ChatHandler {
	return &ChatHandler{
		db:            db,
		ollama:        oll,
		sem:           sem,
		activeStreams: make(map[uint]context.CancelFunc),
	}
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
	if !utils.BindJSON(c, &req) {
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
	// Images are base64-encoded payloads (no "data:..." prefix). Forwarded to
	// Ollama for vision-capable models. Hard cap at 8 attachments.
	Images []string `json:"images,omitempty" binding:"max=8,dive,max=12000000"`
}

// Stream: SSE that sends each token from Ollama, persists messages and
// heartbeats every 15 s so reverse proxies don't drop the connection.
//
// Concurrency model:
//   - A counting semaphore limits how many streams can hit Ollama at once
//     (OLLAMA_MAX_CONCURRENCY). Waiting clients receive a "queued" event
//     with their position so the UI can show a queue indicator.
//   - Each user can only have one active stream at a time; starting a new
//     one cancels the previous one server-side.
func (h *ChatHandler) Stream(c *gin.Context) {
	chat, ok := h.findOwnedChat(c)
	if !ok {
		return
	}
	user := middleware.CurrentUser(c)

	var req sendMessageReq
	if !utils.BindJSON(c, &req) {
		return
	}

	var model models.AIModel
	if err := h.db.Where("ollama_name = ? AND is_installed = ? AND is_enabled = ?", chat.ModelName, true, true).First(&model).Error; err != nil {
		utils.Error(c, http.StatusBadRequest, "model_unavailable", "The selected model is not available")
		return
	}

	userMsg := models.ChatMessage{
		ChatID:  chat.ID,
		Role:    models.MessageRoleUser,
		Content: req.Content,
	}
	userMsg.SetImages(req.Images)
	if err := h.db.Create(&userMsg).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	if strings.EqualFold(chat.Title, "New chat") {
		t := req.Content
		if len(t) > 60 {
			t = t[:60]
		}
		h.db.Model(chat).Update("title", t)
	}

	// Per-user single-stream guard.
	streamCtx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()
	h.streamMu.Lock()
	if prev, ok := h.activeStreams[user.ID]; ok {
		prev()
	}
	h.activeStreams[user.ID] = cancel
	h.streamMu.Unlock()
	defer func() {
		h.streamMu.Lock()
		if cur, ok := h.activeStreams[user.ID]; ok && &cur == &cancel {
			delete(h.activeStreams, user.ID)
		}
		h.streamMu.Unlock()
	}()

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache, no-transform")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	flusher, _ := c.Writer.(http.Flusher)
	writeEvent := func(event string, payload any) {
		b, _ := json.Marshal(payload)
		c.Writer.Write([]byte("event: " + event + "\ndata: "))
		c.Writer.Write(b)
		c.Writer.Write([]byte("\n\n"))
		if flusher != nil {
			flusher.Flush()
		}
	}

	// Heartbeat: SSE comment every 5 s while we're queued, loading the model,
	// or streaming. Ngrok-free closes idle tunnels at ~60 s, Nginx defaults
	// to 60 s proxy_read_timeout, Cloudflare to 100 s. 5 s keeps us well
	// under all of them, with negligible bandwidth cost (a few bytes / tick).
	hbCtx, stopHB := context.WithCancel(streamCtx)
	defer stopHB()
	go func() {
		t := time.NewTicker(5 * time.Second)
		defer t.Stop()
		for {
			select {
			case <-hbCtx.Done():
				return
			case <-t.C:
				_, err := c.Writer.Write([]byte(": ping\n\n"))
				if err != nil {
					return
				}
				if flusher != nil {
					flusher.Flush()
				}
			}
		}
	}()

	// Acquire a slot. Notify the client of its queue position.
	if h.sem != nil {
		_, inFlight, pending := h.sem.Stats()
		if inFlight >= int64(chatSemCap(h.sem)) || pending > 0 {
			writeEvent("queued", gin.H{"position": pending + 1})
		}
	}
	if err := h.sem.Acquire(streamCtx); err != nil {
		writeEvent("error", gin.H{"error": "request cancelled"})
		return
	}
	defer h.sem.Release()
	writeEvent("ready", gin.H{})

	var history []models.ChatMessage
	h.db.Where("chat_id = ?", chat.ID).Order("created_at ASC").Find(&history)
	ollamaMsgs := make([]ollama.ChatMessage, 0, len(history))
	for _, m := range history {
		ollamaMsgs = append(ollamaMsgs, ollama.ChatMessage{
			Role:    m.Role,
			Content: m.Content,
			Images:  m.GetImages(),
		})
	}

	var sb strings.Builder
	err := h.ollama.ChatStream(streamCtx,
		ollama.ChatRequest{Model: chat.ModelName, Messages: ollamaMsgs},
		func(chunk ollama.ChatChunk) bool {
			if chunk.Message.Content != "" {
				sb.WriteString(chunk.Message.Content)
				writeEvent("token", gin.H{"content": chunk.Message.Content})
			}
			return true
		})
	stopHB()

	// If the client dropped, persist what we have so the chat history isn't lost.
	if streamCtx.Err() != nil {
		if sb.Len() > 0 {
			h.db.Create(&models.ChatMessage{
				ChatID:    chat.ID,
				Role:      models.MessageRoleAssistant,
				Content:   sb.String(),
				ModelName: chat.ModelName,
			})
		}
		return
	}
	if err != nil {
		writeEvent("error", gin.H{"error": err.Error()})
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

	writeEvent("done", gin.H{"chat_id": chat.ID, "message_id": assistantMsg.ID})
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

// chatSemCap exists to access the unexported cap of the semaphore.
func chatSemCap(s *ollama.Semaphore) int {
	cap, _, _ := s.Stats()
	return cap
}
