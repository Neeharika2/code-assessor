package models

import (
	"time"
)

type TestCase struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	ProblemID      uint      `gorm:"not null;index" json:"problem_id"`
	Problem        *Problem  `gorm:"constraint:OnDelete:CASCADE;foreignKey:ProblemID" json:"-"`
	Input          string    `gorm:"not null;type:text" json:"input"`
	ExpectedOutput string    `gorm:"not null;type:text" json:"expected_output"`
	IsSample       bool      `gorm:"default:false" json:"is_sample"`
	Points         int       `gorm:"default:10" json:"points"`
	CreatedAt      time.Time `json:"created_at"`
}
