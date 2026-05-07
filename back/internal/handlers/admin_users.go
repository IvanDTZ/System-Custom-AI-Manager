package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ivan/aimanager/internal/middleware"
	"github.com/ivan/aimanager/internal/models"
	"github.com/ivan/aimanager/internal/utils"
	"gorm.io/gorm"
)

type AdminUsersHandler struct {
	db *gorm.DB
}

func NewAdminUsersHandler(db *gorm.DB) *AdminUsersHandler {
	return &AdminUsersHandler{db: db}
}

func (h *AdminUsersHandler) List(c *gin.Context) {
	q := h.db.Model(&models.User{}).Order("created_at DESC")
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		like := "%" + search + "%"
		q = q.Where("name LIKE ? OR email LIKE ? OR username LIKE ?", like, like, like)
	}
	var users []models.User
	if err := q.Find(&users).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}

type createUserReq struct {
	Name     string `json:"name" binding:"required"`
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Role     string `json:"role"`
}

func (h *AdminUsersHandler) Create(c *gin.Context) {
	var req createUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	role := strings.ToUpper(strings.TrimSpace(req.Role))
	if role == "" {
		role = models.RoleUser
	}
	if role != models.RoleUser && role != models.RoleAdmin && role != models.RoleSuperAdmin {
		utils.Error(c, http.StatusBadRequest, "invalid_role", "Unknown role")
		return
	}
	// Only SUPER_ADMIN can create another SUPER_ADMIN.
	current := middleware.CurrentUser(c)
	if role == models.RoleSuperAdmin && current.Role != models.RoleSuperAdmin {
		utils.Error(c, http.StatusForbidden, "forbidden", "Only SUPER_ADMIN can create another SUPER_ADMIN")
		return
	}

	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		utils.Error(c, http.StatusInternalServerError, "hash_failed", err.Error())
		return
	}
	u := models.User{
		Name:         req.Name,
		Username:     req.Username,
		Email:        strings.ToLower(req.Email),
		PasswordHash: hash,
		Provider:     models.ProviderLocal,
		Role:         role,
		Status:       models.StatusActive,
	}
	if err := h.db.Create(&u).Error; err != nil {
		utils.Error(c, http.StatusBadRequest, "create_failed", err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{"user": u})
}

type updateUserReq struct {
	Name     *string `json:"name"`
	Username *string `json:"username"`
	Role     *string `json:"role"`
}

func (h *AdminUsersHandler) Update(c *gin.Context) {
	target, ok := h.findUser(c)
	if !ok {
		return
	}
	var req updateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	current := middleware.CurrentUser(c)
	updates := map[string]any{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Username != nil {
		updates["username"] = *req.Username
	}
	if req.Role != nil {
		role := strings.ToUpper(*req.Role)
		if role != models.RoleUser && role != models.RoleAdmin && role != models.RoleSuperAdmin {
			utils.Error(c, http.StatusBadRequest, "invalid_role", "Unknown role")
			return
		}
		if (role == models.RoleSuperAdmin || target.Role == models.RoleSuperAdmin) && current.Role != models.RoleSuperAdmin {
			utils.Error(c, http.StatusForbidden, "forbidden", "Only SUPER_ADMIN can change a SUPER_ADMIN role")
			return
		}
		updates["role"] = role
	}
	if len(updates) == 0 {
		c.JSON(http.StatusOK, gin.H{"user": target})
		return
	}
	if err := h.db.Model(target).Updates(updates).Error; err != nil {
		utils.Error(c, http.StatusBadRequest, "update_failed", err.Error())
		return
	}
	h.db.First(target, target.ID)
	c.JSON(http.StatusOK, gin.H{"user": target})
}

func (h *AdminUsersHandler) Approve(c *gin.Context) {
	h.changeStatus(c, models.StatusActive)
}

func (h *AdminUsersHandler) Disable(c *gin.Context) {
	target, ok := h.findUser(c)
	if !ok {
		return
	}
	current := middleware.CurrentUser(c)
	if target.ID == current.ID {
		utils.Error(c, http.StatusBadRequest, "cannot_self_disable", "You cannot disable yourself")
		return
	}
	if target.Role == models.RoleSuperAdmin && current.Role != models.RoleSuperAdmin {
		utils.Error(c, http.StatusForbidden, "forbidden", "Only SUPER_ADMIN can disable a SUPER_ADMIN")
		return
	}
	h.db.Model(target).Update("status", models.StatusDisabled)
	target.Status = models.StatusDisabled
	c.JSON(http.StatusOK, gin.H{"user": target})
}

func (h *AdminUsersHandler) Enable(c *gin.Context) {
	h.changeStatus(c, models.StatusActive)
}

func (h *AdminUsersHandler) changeStatus(c *gin.Context, status string) {
	target, ok := h.findUser(c)
	if !ok {
		return
	}
	h.db.Model(target).Update("status", status)
	target.Status = status
	c.JSON(http.StatusOK, gin.H{"user": target})
}

type resetPasswordReq struct {
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

func (h *AdminUsersHandler) ResetPassword(c *gin.Context) {
	target, ok := h.findUser(c)
	if !ok {
		return
	}
	current := middleware.CurrentUser(c)
	if target.Role == models.RoleSuperAdmin && current.Role != models.RoleSuperAdmin {
		utils.Error(c, http.StatusForbidden, "forbidden", "Only SUPER_ADMIN can reset a SUPER_ADMIN password")
		return
	}
	var req resetPasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	hash, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		utils.Error(c, http.StatusInternalServerError, "hash_failed", err.Error())
		return
	}
	h.db.Model(target).Update("password_hash", hash)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *AdminUsersHandler) findUser(c *gin.Context) (*models.User, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		utils.Error(c, http.StatusBadRequest, "bad_id", "Invalid user id")
		return nil, false
	}
	var u models.User
	if err := h.db.First(&u, id).Error; err != nil {
		utils.Error(c, http.StatusNotFound, "not_found", "User not found")
		return nil, false
	}
	return &u, true
}
