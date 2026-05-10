package utils

import (
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
)

var initOnce sync.Once

func initValidator() {
	initOnce.Do(func() {
		if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
			v.RegisterTagNameFunc(func(fld reflect.StructField) string {
				name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
				if name == "-" {
					return ""
				}
				return name
			})
		}
	})
}

// BindJSON binds the request body into dst. On failure, it writes a 400 with a
// human-readable error message and returns false. On success returns true.
func BindJSON(c *gin.Context, dst any) bool {
	initValidator()
	if err := c.ShouldBindJSON(dst); err != nil {
		Error(c, http.StatusBadRequest, "validation_failed", HumanizeBindError(err))
		return false
	}
	return true
}

// HumanizeBindError turns a Gin binding / validator error into one readable
// sentence — never the raw "Key: 'X.Y' Error:Field validation for 'Z' on tag 'min'"
// dump.
func HumanizeBindError(err error) string {
	var ve validator.ValidationErrors
	if errors.As(err, &ve) {
		msgs := make([]string, 0, len(ve))
		for _, e := range ve {
			msgs = append(msgs, fieldRule(e))
		}
		return strings.Join(msgs, ". ")
	}
	msg := err.Error()
	switch {
	case strings.Contains(msg, "EOF"):
		return "The request body is empty"
	case strings.Contains(msg, "cannot unmarshal"), strings.Contains(msg, "invalid character"):
		return "The request body is not valid JSON"
	}
	return "Invalid request"
}

func fieldRule(e validator.FieldError) string {
	field := prettyField(e.Field())
	switch e.Tag() {
	case "required":
		return field + " is required"
	case "min":
		if e.Kind() == reflect.String {
			return fmt.Sprintf("%s must be at least %s characters", field, e.Param())
		}
		return fmt.Sprintf("%s must be at least %s", field, e.Param())
	case "max":
		if e.Kind() == reflect.String {
			return fmt.Sprintf("%s must be at most %s characters", field, e.Param())
		}
		return fmt.Sprintf("%s must be at most %s", field, e.Param())
	case "len":
		return fmt.Sprintf("%s must be exactly %s characters", field, e.Param())
	case "email":
		return field + " must be a valid email address"
	case "url":
		return field + " must be a valid URL"
	case "oneof":
		return field + " must be one of: " + strings.ReplaceAll(e.Param(), " ", ", ")
	case "eqfield":
		return field + " must match " + prettyField(e.Param())
	default:
		return field + " is invalid"
	}
}

// HumanizeDBError translates raw DB driver messages into user-friendly text
// plus a stable error code. Returns ("", "") for nil errors.
//
// Recognised cases:
//   - SQLite UNIQUE constraint failed
//   - MariaDB / MySQL Error 1062 (Duplicate entry)
//   - Foreign-key violations
func HumanizeDBError(err error) (code string, message string) {
	if err == nil {
		return "", ""
	}
	low := strings.ToLower(err.Error())

	if strings.Contains(low, "unique constraint") || strings.Contains(low, "duplicate entry") || strings.Contains(low, "1062") {
		switch {
		case strings.Contains(low, "email"):
			return "duplicate_email", "That email address is already registered"
		case strings.Contains(low, "username"):
			return "duplicate_username", "That username is already taken"
		case strings.Contains(low, "ollama_name"):
			return "duplicate_model", "That Ollama model is already in the list"
		case strings.Contains(low, "google_id"):
			return "duplicate_google_id", "That Google account is already linked to a user"
		case strings.Contains(low, "name"):
			return "duplicate_name", "That name is already used"
		}
		return "duplicate", "Another record with that value already exists"
	}

	if strings.Contains(low, "foreign key") || strings.Contains(low, "1452") {
		return "fk_violation", "A linked record does not exist"
	}
	if strings.Contains(low, "not null") || strings.Contains(low, "1048") {
		return "null_violation", "A required field is missing"
	}

	return "db_error", "Could not save changes — please try again"
}

// prettyField turns "new_password" → "New password" and "email" → "Email".
func prettyField(name string) string {
	if name == "" {
		return "Field"
	}
	parts := strings.Split(name, "_")
	for i, p := range parts {
		if i == 0 && len(p) > 0 {
			parts[i] = strings.ToUpper(p[:1]) + p[1:]
		} else {
			parts[i] = strings.ToLower(p)
		}
	}
	return strings.Join(parts, " ")
}
