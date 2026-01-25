package models

import (
	"time"

	"gorm.io/gorm"
)

type Submission struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	UserID        uint           `gorm:"index" json:"user_id"`
	ProblemID     uint           `gorm:"index" json:"problem_id"`
	LanguageID    int            `json:"language_id"`
	SourceCode    string         `gorm:"type:text" json:"source_code"`
	Status        string         `gorm:"size:50" json:"status"`
	Passed        bool           `gorm:"default:false" json:"passed"`
	TotalTests    int            `json:"total_tests"`
	PassedTests   int            `json:"passed_tests"`
	ExecutionTime float64        `json:"execution_time"`
	MemoryUsed    int            `json:"memory_used"`
	ErrorMessage  string         `gorm:"type:text" json:"error_message,omitempty"`
	SubmittedAt   time.Time      `json:"submitted_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	
	// Relationships
	User    User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Problem Problem `gorm:"foreignKey:ProblemID" json:"problem,omitempty"`
}
