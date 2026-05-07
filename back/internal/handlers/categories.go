package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/models"
	"github.com/ivan/aimanager/internal/utils"
	"gorm.io/gorm"
)

type CategoriesHandler struct {
	db *gorm.DB
}

func NewCategoriesHandler(db *gorm.DB) *CategoriesHandler {
	return &CategoriesHandler{db: db}
}

func (h *CategoriesHandler) List(c *gin.Context) {
	var rows []models.ModelCategory
	if err := h.db.Order("name ASC").Find(&rows).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"categories": rows})
}

type categoryReq struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

func (h *CategoriesHandler) Create(c *gin.Context) {
	var req categoryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	cat := models.ModelCategory{Name: req.Name, Description: req.Description}
	if err := h.db.Create(&cat).Error; err != nil {
		utils.Error(c, http.StatusBadRequest, "create_failed", err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{"category": cat})
}

func (h *CategoriesHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_id", "Invalid id")
		return
	}
	var cat models.ModelCategory
	if err := h.db.First(&cat, id).Error; err != nil {
		utils.Error(c, http.StatusNotFound, "not_found", "Category not found")
		return
	}
	var req categoryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if err := h.db.Model(&cat).Updates(map[string]any{
		"name":        req.Name,
		"description": req.Description,
	}).Error; err != nil {
		utils.Error(c, http.StatusBadRequest, "update_failed", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"category": cat})
}
