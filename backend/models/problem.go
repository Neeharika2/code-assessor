package models

import (
	"time"

	"gorm.io/gorm"
)

type Problem struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Title       string         `gorm:"not null;size:200" json:"title"`
	Description string         `gorm:"not null;type:text" json:"description"`
	Difficulty  string         `gorm:"default:easy;size:20" json:"difficulty"`
	TimeLimit   int            `gorm:"default:2000" json:"time_limit"`   // in milliseconds
	MemoryLimit int            `gorm:"default:256000" json:"memory_limit"` // in KB
	CreatedBy   uint           `json:"created_by"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	TestCases   []TestCase     `gorm:"foreignKey:ProblemID" json:"test_cases,omitempty"`
}
