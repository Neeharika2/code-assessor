package handlers

import (
	"coding-platform/database"
	"coding-platform/models"
	"coding-platform/services"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type SubmitCodeRequest struct {
	ProblemID  uint   `json:"problem_id" binding:"required"`
	LanguageID int    `json:"language_id" binding:"required"`
	SourceCode string `json:"source_code" binding:"required"`
}

type SubmissionResponse struct {
	SubmissionID uint                    `json:"submission_id"`
	AllPassed    bool                    `json:"all_passed"`
	TotalTests   int                     `json:"total_tests"`
	PassedTests  int                     `json:"passed_tests"`
	TestResults  []services.TestResult   `json:"test_results"`
}

func SubmitCode(c *gin.Context) {
	var req SubmitCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get problem details
	var problem models.Problem
	if err := database.DB.First(&problem, req.ProblemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Problem not found"})
		return
	}

	// Get all test cases for this problem
	var testCases []models.TestCase
	if err := database.DB.Where("problem_id = ?", req.ProblemID).Find(&testCases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch test cases"})
		return
	}

	if len(testCases) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No test cases found for this problem"})
		return
	}

	// Run code against all test cases
	var results []services.TestResult
	passedCount := 0
	var totalTime float64
	var maxMemory int

	for _, testCase := range testCases {
		result, err := services.SubmitCode(
			req.SourceCode,
			req.LanguageID,
			testCase.Input,
			strings.TrimSpace(testCase.ExpectedOutput),
			problem.TimeLimit,
			problem.MemoryLimit,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to execute code",
				"details": err.Error(),
			})
			return
		}

		results = append(results, *result)
		if result.Passed {
			passedCount++
		}
		totalTime += result.Time
		if result.Memory > maxMemory {
			maxMemory = result.Memory
		}
	}

	allPassed := passedCount == len(testCases)

	// Create submission record
	submission := models.Submission{
		ProblemID:     req.ProblemID,
		LanguageID:    req.LanguageID,
		SourceCode:    req.SourceCode,
		Status:        "completed",
		Passed:        allPassed,
		TotalTests:    len(testCases),
		PassedTests:   passedCount,
		ExecutionTime: totalTime,
		MemoryUsed:    maxMemory,
		SubmittedAt:   time.Now(),
	}

	// Get user ID if authenticated
	if userID, exists := c.Get("user_id"); exists {
		submission.UserID = userID.(uint)
	}

	// Save submission
	if err := database.DB.Create(&submission).Error; err != nil {
		// Log error but don't fail the request
		log.Printf("Failed to save submission: %v", err)
	}

	response := SubmissionResponse{
		SubmissionID: submission.ID,
		AllPassed:    allPassed,
		TotalTests:   len(testCases),
		PassedTests:  passedCount,
		TestResults:  results,
	}

	c.JSON(http.StatusOK, response)
}

// RunCode allows running code with custom input (without test cases)
func RunCode(c *gin.Context) {
	var req struct {
		SourceCode string `json:"source_code" binding:"required"`
		LanguageID int    `json:"language_id" binding:"required"`
		Input      string `json:"input"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := services.SubmitCode(
		req.SourceCode,
		req.LanguageID,
		req.Input,
		"", // No expected output for custom run
		5000,   // 5 second default time limit
		256000, // 256MB default memory limit
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to execute code",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}
