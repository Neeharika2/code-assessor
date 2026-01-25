package models

import (
	"time"

	"gorm.io/gorm"
)

// UserProblemCompletion tracks which problems each user has completed
type UserProblemCompletion struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	UserID            uint           `gorm:"index:idx_user_problem,unique" json:"user_id"`
	ProblemID         uint           `gorm:"index:idx_user_problem,unique" json:"problem_id"`
	CompletedAt       time.Time      `json:"completed_at"`
	FirstSubmissionID uint           `json:"first_submission_id"` // Reference to the first passing submission
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	User       User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Problem    Problem    `gorm:"foreignKey:ProblemID" json:"problem,omitempty"`
	Submission Submission `gorm:"foreignKey:FirstSubmissionID" json:"submission,omitempty"`
}
