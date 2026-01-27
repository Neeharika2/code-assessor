package models

import (
	"time"
)

// PlagiarismStatus represents the plagiarism classification
type PlagiarismStatus string

const (
	PlagiarismSafe       PlagiarismStatus = "SAFE"
	PlagiarismSuspicious PlagiarismStatus = "SUSPICIOUS"
	PlagiarismPlagiarized PlagiarismStatus = "PLAGIARIZED"
)

// PlagiarismResult stores the comparison result between two submissions
type PlagiarismResult struct {
	ID               uint             `gorm:"primaryKey" json:"id"`
	SubmissionID1    uint             `gorm:"index" json:"submission_id_1"`
	SubmissionID2    uint             `gorm:"index" json:"submission_id_2"`
	SimilarityPercent float64         `json:"similarity_percent"`
	Status           PlagiarismStatus `gorm:"size:20" json:"status"`
	CheckedAt        time.Time        `json:"checked_at"`
	
	// Relationships
	Submission1 Submission `gorm:"foreignKey:SubmissionID1" json:"submission_1,omitempty"`
	Submission2 Submission `gorm:"foreignKey:SubmissionID2" json:"submission_2,omitempty"`
}

// PlagiarismMatch stores detailed line-by-line match information
type PlagiarismMatch struct {
	ID                  uint `gorm:"primaryKey" json:"id"`
	PlagiarismResultID  uint `gorm:"index" json:"plagiarism_result_id"`
	File1               string `json:"file1"`
	File2               string `json:"file2"`
	StartLine1          int    `json:"start_line_1"`
	EndLine1            int    `json:"end_line_1"`
	StartLine2          int    `json:"start_line_2"`
	EndLine2            int    `json:"end_line_2"`
	
	// Relationship
	PlagiarismResult PlagiarismResult `gorm:"foreignKey:PlagiarismResultID" json:"-"`
}

// ClassifySimilarity returns the plagiarism status based on similarity percentage
func ClassifySimilarity(similarity float64) PlagiarismStatus {
	switch {
	case similarity > 60:
		return PlagiarismPlagiarized
	case similarity >= 30:
		return PlagiarismSuspicious
	default:
		return PlagiarismSafe
	}
}
