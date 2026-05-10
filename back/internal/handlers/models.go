package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/middleware"
	"github.com/ivan/aimanager/internal/models"
	"github.com/ivan/aimanager/internal/services/ollama"
	"github.com/ivan/aimanager/internal/utils"
	"gorm.io/gorm"
)

type ModelsHandler struct {
	db       *gorm.DB
	ollama   *ollama.Client
	installs *ollama.InstallTracker
}

func NewModelsHandler(db *gorm.DB, oll *ollama.Client, installs *ollama.InstallTracker) *ModelsHandler {
	return &ModelsHandler{db: db, ollama: oll, installs: installs}
}

// PublicList returns models that the regular user can pick (installed + enabled).
func (h *ModelsHandler) PublicList(c *gin.Context) {
	var rows []models.AIModel
	if err := h.db.Preload("Category").Preload("Categories").
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
	if err := h.db.Preload("Category").Preload("Categories").Order("ollama_name ASC").Find(&rows).Error; err != nil {
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

// Install streams pull progress as SSE. Also publishes progress to the
// shared InstallTracker so other admins polling /admin/models/installs see
// the same state, and so we can refuse a duplicate pull on the same model.
func (h *ModelsHandler) Install(c *gin.Context) {
	var req installReq
	if !utils.BindJSON(c, &req) {
		return
	}

	// Refuse if another admin is already pulling the same model. Avoids two
	// fetches stomping on each other's progress and Ollama spawning duplicate
	// downloads.
	user := middleware.CurrentUser(c)
	var startedByID uint
	if user != nil {
		startedByID = user.ID
	}
	if h.installs != nil {
		if _, ok := h.installs.Start(req.Name, startedByID); !ok {
			utils.Error(c, http.StatusConflict, "install_in_progress",
				"This model is already being installed by another admin. Watch progress in the bar at the top.")
			return
		}
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	flusher, _ := c.Writer.(http.Flusher)

	err := h.ollama.Pull(c.Request.Context(), req.Name, func(ev ollama.PullProgress) bool {
		if h.installs != nil {
			h.installs.Update(req.Name, ev.Status, ev.Total, ev.Completed)
		}
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
		if h.installs != nil {
			h.installs.Error(req.Name, err.Error())
		}
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
	if h.installs != nil {
		h.installs.Done(req.Name)
	}
	c.Writer.Write([]byte("event: done\ndata: {}\n\n"))
	if flusher != nil {
		flusher.Flush()
	}
}

// Installs returns a snapshot of every Ollama pull currently in flight on the
// server. Any admin can poll this — that's how a second admin sees that the
// first is already downloading something.
func (h *ModelsHandler) Installs(c *gin.Context) {
	if h.installs == nil {
		c.JSON(http.StatusOK, gin.H{"installs": []ollama.InstallEntry{}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"installs": h.installs.List()})
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

// Forget removes a model row from our DB. Only allowed for already-uninstalled
// models so admins can clean up the list without re-syncing. Does NOT touch
// Ollama — that's what Uninstall is for.
func (h *ModelsHandler) Forget(c *gin.Context) {
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
	if m.IsInstalled {
		utils.Error(c, http.StatusBadRequest, "still_installed", "Uninstall the model first before removing it from the list")
		return
	}
	if err := h.db.Delete(&m).Error; err != nil {
		code, msg := utils.HumanizeDBError(err)
		utils.Error(c, http.StatusInternalServerError, code, msg)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type updateModelReq struct {
	DisplayName *string `json:"display_name"`
	Description *string `json:"description"`
	CategoryID  *uint   `json:"category_id"`
	// CategoryIDs replaces the model's whole category set when present.
	// Use this for the multi-select admin UI; CategoryID stays as the
	// "primary" category for legacy callers.
	CategoryIDs *[]uint `json:"category_ids"`
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
	if !utils.BindJSON(c, &req) {
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

	// Replace the many-to-many association if category_ids was sent.
	if req.CategoryIDs != nil {
		ids := *req.CategoryIDs
		newCats := make([]models.ModelCategory, 0, len(ids))
		for _, cid := range ids {
			newCats = append(newCats, models.ModelCategory{ID: cid})
		}
		if err := h.db.Model(&m).Association("Categories").Replace(newCats); err != nil {
			code, msg := utils.HumanizeDBError(err)
			utils.Error(c, http.StatusBadRequest, code, msg)
			return
		}
		// Keep legacy CategoryID in sync with the first selected category so
		// older readers still work.
		var firstID *uint
		if len(ids) > 0 {
			firstID = &ids[0]
		}
		h.db.Model(&m).Update("category_id", firstID)
	}

	h.db.Preload("Category").Preload("Categories").First(&m, m.ID)
	c.JSON(http.StatusOK, gin.H{"model": m})
}
