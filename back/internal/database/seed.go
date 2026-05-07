package database

import (
	"errors"

	"github.com/ivan/aimanager/internal/models"
	"gorm.io/gorm"
)

var defaultCategories = []models.ModelCategory{
	{Name: "Redacción", Description: "Modelos pensados para escritura y redacción.", IsSystem: true},
	{Name: "Código", Description: "Modelos especializados en código y programación.", IsSystem: true},
	{Name: "Análisis", Description: "Modelos para análisis y comprensión de información.", IsSystem: true},
	{Name: "Resumen", Description: "Modelos óptimos para resumir contenido.", IsSystem: true},
	{Name: "Traducción", Description: "Modelos pensados para traducción entre idiomas.", IsSystem: true},
	{Name: "Creatividad", Description: "Modelos para tareas creativas y narrativa.", IsSystem: true},
	{Name: "Razonamiento", Description: "Modelos con foco en razonamiento estructurado.", IsSystem: true},
	{Name: "General", Description: "Modelos generalistas.", IsSystem: true},
}

func SeedDefaults(db *gorm.DB) error {
	for _, c := range defaultCategories {
		var existing models.ModelCategory
		err := db.Where("name = ?", c.Name).First(&existing).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		row := c
		if err := db.Create(&row).Error; err != nil {
			return err
		}
	}
	return nil
}
