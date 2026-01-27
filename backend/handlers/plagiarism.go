package handlers

import (
	"coding-platform/database"
	"coding-platform/models"
	"coding-platform/services"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// CheckSubmissionPlagiarism checks a single submission against all other submissions for the same problem
func CheckSubmissionPlagiarism(c *gin.Context) {
	submissionIDStr := c.Param("id")
	submissionID, err := strconv.ParseUint(submissionIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid submission ID"})
		return
	}

	// Get the submission
	var submission models.Submission
	if err := database.DB.First(&submission, submissionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Check if language is supported
	if !services.IsLanguageSupported(submission.LanguageID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Language not supported for plagiarism detection"})
		return
	}

	// Get all other submissions for the same problem with the same language
	var otherSubmissions []models.Submission
	if err := database.DB.Where("problem_id = ? AND language_id = ? AND id != ? AND passed = ?",
		submission.ProblemID, submission.LanguageID, submissionID, true).
		Find(&otherSubmissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch submissions"})
		return
	}

	if len(otherSubmissions) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message":    "No other submissions to compare with",
			"results":    []interface{}{},
			"checked_at": time.Now(),
		})
		return
	}

	// Prepare submissions for check
	submissions := []services.SubmissionInfo{
		{
			ID:         submission.ID,
			UserID:     submission.UserID,
			SourceCode: submission.SourceCode,
			LanguageID: submission.LanguageID,
		},
	}
	for _, sub := range otherSubmissions {
		submissions = append(submissions, services.SubmissionInfo{
			ID:         sub.ID,
			UserID:     sub.UserID,
			SourceCode: sub.SourceCode,
			LanguageID: sub.LanguageID,
		})
	}

	// Run plagiarism check
	results, err := services.CheckPlagiarism(submission.ProblemID, submissions)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Plagiarism check failed",
			"details": err.Error(),
		})
		return
	}

	// Filter results to only include current submission
	var filteredResults []services.PlagiarismCheckResult
	for _, r := range results {
		if r.SubmissionID1 == uint(submissionID) || r.SubmissionID2 == uint(submissionID) {
			filteredResults = append(filteredResults, r)
		}
	}

	// Store results in database
	for _, r := range filteredResults {
		plagResult := models.PlagiarismResult{
			SubmissionID1:     r.SubmissionID1,
			SubmissionID2:     r.SubmissionID2,
			SimilarityPercent: r.SimilarityPercent,
			Status:            models.PlagiarismStatus(r.Status),
			CheckedAt:         time.Now(),
		}
		database.DB.Create(&plagResult)
	}

	// Filter out same-user comparisons for the response
	var differentUserResults []services.PlagiarismCheckResult
	userIDMap := make(map[uint]uint) // submission_id -> user_id
	userIDMap[submission.ID] = submission.UserID
	for _, sub := range otherSubmissions {
		userIDMap[sub.ID] = sub.UserID
	}
	
	for _, r := range filteredResults {
		userID1 := userIDMap[r.SubmissionID1]
		userID2 := userIDMap[r.SubmissionID2]
		if userID1 != userID2 {
			differentUserResults = append(differentUserResults, r)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"submission_id":      submissionID,
		"total_comparisons":  len(differentUserResults),
		"results":            differentUserResults,
		"checked_at":         time.Now(),
	})
}

// CheckProblemPlagiarism checks all passing submissions for a problem
func CheckProblemPlagiarism(c *gin.Context) {
	problemIDStr := c.Param("id")
	problemID, err := strconv.ParseUint(problemIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid problem ID"})
		return
	}

	// Get optional language filter
	languageIDStr := c.Query("language_id")
	var languageFilter *int
	if languageIDStr != "" {
		langID, err := strconv.Atoi(languageIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid language_id"})
			return
		}
		if !services.IsLanguageSupported(langID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Language not supported for plagiarism detection"})
			return
		}
		languageFilter = &langID
	}

	// Get all passing submissions for this problem
	query := database.DB.Where("problem_id = ? AND passed = ?", problemID, true)
	if languageFilter != nil {
		query = query.Where("language_id = ?", *languageFilter)
	}

	var submissions []models.Submission
	if err := query.Order("submitted_at ASC").Find(&submissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch submissions"})
		return
	}

	if len(submissions) < 2 {
		log.Printf("[Plagiarism] Problem %d: Only %d passing submissions found (need at least 2)", problemID, len(submissions))
		c.JSON(http.StatusOK, gin.H{
			"problem_id":        problemID,
			"message":           "Not enough submissions for plagiarism detection",
			"total_submissions": len(submissions),
			"results":           []interface{}{},
		})
		return
	}

	log.Printf("[Plagiarism] Problem %d: Found %d passing submissions", problemID, len(submissions))
	for _, sub := range submissions {
		log.Printf("[Plagiarism]   - Submission %d: UserID=%d, LanguageID=%d, CodeLen=%d", 
			sub.ID, sub.UserID, sub.LanguageID, len(sub.SourceCode))
	}

	// Group submissions by language
	submissionsByLang := make(map[int][]services.SubmissionInfo)
	for _, sub := range submissions {
		if services.IsLanguageSupported(sub.LanguageID) {
			submissionsByLang[sub.LanguageID] = append(submissionsByLang[sub.LanguageID], services.SubmissionInfo{
				ID:         sub.ID,
				UserID:     sub.UserID,
				SourceCode: sub.SourceCode,
				LanguageID: sub.LanguageID,
			})
		}
	}

	// Run plagiarism check for each language group
	log.Printf("[Plagiarism] Problem %d: %d language groups to check", problemID, len(submissionsByLang))
	var allResults []services.PlagiarismCheckResult
	for langID, subs := range submissionsByLang {
		log.Printf("[Plagiarism] Language %d: %d submissions", langID, len(subs))
		if len(subs) < 2 {
			log.Printf("[Plagiarism] Skipping language %d (need at least 2 submissions)", langID)
			continue
		}

		results, err := services.CheckPlagiarism(uint(problemID), subs)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":       "Plagiarism check failed",
				"language_id": langID,
				"details":     err.Error(),
			})
			return
		}
		allResults = append(allResults, results...)
	}

	// Store results in database
	for _, r := range allResults {
		plagResult := models.PlagiarismResult{
			SubmissionID1:     r.SubmissionID1,
			SubmissionID2:     r.SubmissionID2,
			SimilarityPercent: r.SimilarityPercent,
			Status:            models.PlagiarismStatus(r.Status),
			CheckedAt:         time.Now(),
		}
		database.DB.Create(&plagResult)
	}

	// Build user ID map for filtering same-user comparisons
	userIDMap := make(map[uint]uint) // submission_id -> user_id
	for _, sub := range submissions {
		userIDMap[sub.ID] = sub.UserID
	}

	// Filter out same-user comparisons
	var differentUserResults []services.PlagiarismCheckResult
	for _, r := range allResults {
		userID1 := userIDMap[r.SubmissionID1]
		userID2 := userIDMap[r.SubmissionID2]
		if userID1 != userID2 {
			differentUserResults = append(differentUserResults, r)
		}
	}

	// Count flagged submissions
	flaggedCount := 0
	for _, r := range differentUserResults {
		if r.Status == "SUSPICIOUS" || r.Status == "PLAGIARIZED" {
			flaggedCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"problem_id":         problemID,
		"total_submissions":  len(submissions),
		"total_comparisons":  len(differentUserResults),
		"flagged_count":      flaggedCount,
		"results":            differentUserResults,
		"checked_at":         time.Now(),
	})
}

// GetPlagiarismResults returns stored plagiarism results for a problem
func GetPlagiarismResults(c *gin.Context) {
	problemIDStr := c.Param("problem_id")
	problemID, err := strconv.ParseUint(problemIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid problem ID"})
		return
	}

	// Get all submissions for this problem
	var submissions []models.Submission
	if err := database.DB.Where("problem_id = ?", problemID).Select("id").Find(&submissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch submissions"})
		return
	}

	if len(submissions) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"problem_id": problemID,
			"results":    []interface{}{},
		})
		return
	}

	// Get submission IDs
	var submissionIDs []uint
	for _, sub := range submissions {
		submissionIDs = append(submissionIDs, sub.ID)
	}

	// Get plagiarism results
	var results []models.PlagiarismResult
	if err := database.DB.Where("submission_id_1 IN ? OR submission_id_2 IN ?", submissionIDs, submissionIDs).
		Preload("Submission1.User").
		Preload("Submission2.User").
		Order("similarity_percent DESC").
		Find(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch plagiarism results"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"problem_id": problemID,
		"results":    results,
	})
}
