package handlers

import (
	"coding-platform/database"
	"coding-platform/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetSubmissions returns all submissions for a user or problem
func GetSubmissions(c *gin.Context) {
	var submissions []models.Submission
	query := database.DB.Preload("User").Preload("Problem")

	// Filter by user_id if provided
	if userID := c.Query("user_id"); userID != "" {
		query = query.Where("user_id = ?", userID)
	}

	// Filter by problem_id if provided
	if problemID := c.Query("problem_id"); problemID != "" {
		query = query.Where("problem_id = ?", problemID)
	}

	// Order by most recent first
	query = query.Order("submitted_at DESC")

	// Limit results
	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	query = query.Limit(limit)

	if err := query.Find(&submissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch submissions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"submissions": submissions})
}

// GetSubmission returns a single submission by ID
func GetSubmission(c *gin.Context) {
	id := c.Param("id")
	var submission models.Submission

	if err := database.DB.Preload("User").Preload("Problem").First(&submission, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"submission": submission})
}

// GetUserSubmissions returns all submissions for the authenticated user
func GetUserSubmissions(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var submissions []models.Submission
	query := database.DB.Preload("Problem").Where("user_id = ?", userID)

	// Filter by problem_id if provided
	if problemID := c.Query("problem_id"); problemID != "" {
		query = query.Where("problem_id = ?", problemID)
	}

	// Order by most recent first
	query = query.Order("submitted_at DESC").Limit(50)

	if err := query.Find(&submissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch submissions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"submissions": submissions})
}

// GetProblemSubmissions returns all submissions for a specific problem
func GetProblemSubmissions(c *gin.Context) {
	problemID := c.Param("id")
	var submissions []models.Submission

	query := database.DB.Preload("User").Where("problem_id = ?", problemID)

	// Users can only see their own submissions, admins can see all
	role, _ := c.Get("role")
	userID, userExists := c.Get("user_id")
	
	if role != "admin" {
		if !userExists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		query = query.Where("user_id = ?", userID)
	}

	query = query.Order("submitted_at DESC").Limit(50)

	if err := query.Find(&submissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch submissions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"submissions": submissions})
}

// GetSubmissionStats returns statistics for a user or problem
func GetSubmissionStats(c *gin.Context) {
	type Stats struct {
		TotalSubmissions  int64   `json:"total_submissions"`
		PassedSubmissions int64   `json:"passed_submissions"`
		FailedSubmissions int64   `json:"failed_submissions"`
		SuccessRate       float64 `json:"success_rate"`
	}

	var stats Stats
	query := database.DB.Model(&models.Submission{})

	// Filter by user_id if provided
	if userID := c.Query("user_id"); userID != "" {
		query = query.Where("user_id = ?", userID)
	}

	// Filter by problem_id if provided
	if problemID := c.Query("problem_id"); problemID != "" {
		query = query.Where("problem_id = ?", problemID)
	}

	// Get total count
	query.Count(&stats.TotalSubmissions)

	// Get passed count
	database.DB.Model(&models.Submission{}).Where("passed = ?", true).Count(&stats.PassedSubmissions)

	stats.FailedSubmissions = stats.TotalSubmissions - stats.PassedSubmissions
	
	if stats.TotalSubmissions > 0 {
		stats.SuccessRate = float64(stats.PassedSubmissions) / float64(stats.TotalSubmissions) * 100
	}

	c.JSON(http.StatusOK, stats)
}

// GetUserCompletedProblems returns all problem IDs that the authenticated user has completed
func GetUserCompletedProblems(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var completions []models.UserProblemCompletion
	if err := database.DB.Where("user_id = ?", userID).Find(&completions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch completed problems"})
		return
	}

	// Extract problem IDs
	problemIDs := make([]uint, len(completions))
	for i, completion := range completions {
		problemIDs[i] = completion.ProblemID
	}

	c.JSON(http.StatusOK, gin.H{
		"completed_problem_ids": problemIDs,
		"total_completed": len(problemIDs),
	})
}
