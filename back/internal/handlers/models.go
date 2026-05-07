package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/models"
	"github.com/ivan/aimanager/internal/services/ollama"
	"github.com/ivan/aimanager/internal/utils"
	"gorm.io/gorm"
)

type ModelsHandler struct {
	db     *gorm.DB
	ollama *ollama.Client
}

func NewModelsHandler(db *gorm.DB, oll *ollama.Client) *ModelsHandler {
	return &ModelsHandler{db: db, ollama: oll}
}

// PublicList returns models that the regular user can pick (installed + enabled).
func (h *ModelsHandler) PublicList(c *gin.Context) {
	var rows []models.AIModel
	if err := h.db.Preload("Category").
		Where("is_installed = ? AND is_enabled = ?", true, true).
		Order("display_name ASC").
		Find(&rows).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"models": rows})
}

// AdminList returns every model in the DB.
func (h *ModelsHandler) AdminList(c *gin.Context) {
	var rows []models.AIModel
	if err := h.db.Preload("Category").Order("ollama_name ASC").Find(&rows).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"models": rows})
}

// Sync pulls the current /api/tags from Ollama and updates the DB.
func (h *ModelsHandler) Sync(c *gin.Context) {
	tags, err := h.ollama.ListModels(c.Request.Context())
	if err != nil {
		utils.Error(c, http.StatusBadGateway, "ollama_unreachable", err.Error())
		return
	}
	seen := map[string]bool{}
	for _, t := range tags {
		seen[t.Name] = true
		var m models.AIModel
		err := h.db.Where("ollama_name = ?", t.Name).First(&m).Error
		if err == gorm.ErrRecordNotFound {
			m = models.AIModel{
				OllamaName:    t.Name,
				DisplayName:   t.Name,
				IsInstalled:   true,
				IsEnabled:     false,
				Size:          t.Size,
				Family:        t.Details.Family,
				ParameterSize: t.Details.ParameterSize,
				Quantization:  t.Details.QuantizationLevel,
			}
			if err := h.db.Create(&m).Error; err != nil {
				utils.Error(c, http.StatusInternalServerError, "db_error", err.Error())
				return
			}
			continue
		}
		if err != nil {
			utils.Error(c, http.StatusInternalServerError, "db_error", err.Error())
			return
		}
		h.db.Model(&m).Updates(map[string]any{
			"is_installed":   true,
			"size":           t.Size,
			"family":         t.Details.Family,
			"parameter_size": t.Details.ParameterSize,
			"quantization":   t.Details.QuantizationLevel,
		})
	}
	// Mark previously-installed models as not installed if Ollama no longer reports them.
	var dbRows []models.AIModel
	h.db.Where("is_installed = ?", true).Find(&dbRows)
	for _, m := range dbRows {
		if !seen[m.OllamaName] {
			h.db.Model(&m).Update("is_installed", false)
		}
	}
	h.AdminList(c)
}

type installReq struct {
	Name string `json:"name" binding:"required"`
}

// Install streams pull progress as SSE.
func (h *ModelsHandler) Install(c *gin.Context) {
	var req installReq
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	flusher, _ := c.Writer.(http.Flusher)

	err := h.ollama.Pull(c.Request.Context(), req.Name, func(ev ollama.PullProgress) bool {
		b, _ := json.Marshal(ev)
		c.Writer.Write([]byte("event: progress\ndata: "))
		c.Writer.Write(b)
		c.Writer.Write([]byte("\n\n"))
		if flusher != nil {
			flusher.Flush()
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

	// Refresh DB row.
	tags, _ := h.ollama.ListModels(c.Request.Context())
	for _, t := range tags {
		if t.Name == req.Name {
			var m models.AIModel
			if err := h.db.Where("ollama_name = ?", t.Name).First(&m).Error; err == nil {
				h.db.Model(&m).Updates(map[string]any{
					"is_installed":   true,
					"size":           t.Size,
					"family":         t.Details.Family,
					"parameter_size": t.Details.ParameterSize,
					"quantization":   t.Details.QuantizationLevel,
				})
			} else if err == gorm.ErrRecordNotFound {
				h.db.Create(&models.AIModel{
					OllamaName:    t.Name,
					DisplayName:   t.Name,
					IsInstalled:   true,
					IsEnabled:     false,
					Size:          t.Size,
					Family:        t.Details.Family,
					ParameterSize: t.Details.ParameterSize,
					Quantization:  t.Details.QuantizationLevel,
				})
			}
		}
	}
	c.Writer.Write([]byte("event: done\ndata: {}\n\n"))
	if flusher != nil {
		flusher.Flush()
	}
}

func (h *ModelsHandler) Uninstall(c *gin.Context) {
	name := c.Param("name")
	if err := h.ollama.Delete(c.Request.Context(), name); err != nil {
		utils.Error(c, http.StatusBadGateway, "ollama_error", err.Error())
		return
	}
	h.db.Model(&models.AIModel{}).Where("ollama_name = ?", name).Update("is_installed", false)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type updateModelReq struct {
	DisplayName *string `json:"display_name"`
	Description *string `json:"description"`
	CategoryID  *uint   `json:"category_id"`
	IsEnabled   *bool   `json:"is_enabled"`
}

func (h *ModelsHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_id", "Invalid id")
		return
	}
	var m models.AIModel
	if err := h.db.First(&m, id).Error; err != nil {
		utils.Error(c, http.StatusNotFound, "not_found", "Model not found")
		return
	}
	var req updateModelReq
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	updates := map[string]any{}
	if req.DisplayName != nil {
		updates["display_name"] = *req.DisplayName
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.CategoryID != nil {
		updates["category_id"] = *req.CategoryID
	}
	if req.IsEnabled != nil {
		updates["is_enabled"] = *req.IsEnabled
	}
	if len(updates) > 0 {
		h.db.Model(&m).Updates(updates)
	}
	h.db.Preload("Category").First(&m, m.ID)
	c.JSON(http.StatusOK, gin.H{"model": m})
}
