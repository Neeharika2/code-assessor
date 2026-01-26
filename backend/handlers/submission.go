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

	// Require authentication for submissions
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required to submit code"})
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

		// Hide input/output details for hidden (non-sample) test cases
		if !testCase.IsSample {
			result.Input = ""
			result.ExpectedOutput = ""
			result.Stdout = ""
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
		UserID:        userID.(uint),
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

	// Save submission
	if err := database.DB.Create(&submission).Error; err != nil {
		log.Printf("Failed to save submission: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save submission"})
		return
	}

	// If all tests passed, mark problem as completed (if not already completed)
	if allPassed {
		var completion models.UserProblemCompletion
		result := database.DB.Where("user_id = ? AND problem_id = ?", userID, req.ProblemID).First(&completion)
		
		// Only create completion record if it doesn't exist
		if result.Error != nil {
			completion = models.UserProblemCompletion{
				UserID:            userID.(uint),
				ProblemID:         req.ProblemID,
				CompletedAt:       time.Now(),
				FirstSubmissionID: submission.ID,
			}
			if err := database.DB.Create(&completion).Error; err != nil {
				log.Printf("Failed to create completion record: %v", err)
				// Don't fail the request, just log the error
			}
		}
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

// RunCode validates code against sample test cases only
func RunCode(c *gin.Context) {
	var req struct {
		ProblemID  uint   `json:"problem_id" binding:"required"`
		SourceCode string `json:"source_code" binding:"required"`
		LanguageID int    `json:"language_id" binding:"required"`
	}

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

	// Get ONLY sample test cases for this problem
	var testCases []models.TestCase
	if err := database.DB.Where("problem_id = ? AND is_sample = ?", req.ProblemID, true).Find(&testCases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch test cases"})
		return
	}

	if len(testCases) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No sample test cases found for this problem"})
		return
	}

	// Run code against sample test cases
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

	response := SubmissionResponse{
		SubmissionID: 0, // No submission record for run code
		AllPassed:    allPassed,
		TotalTests:   len(testCases),
		PassedTests:  passedCount,
		TestResults:  results,
	}

	c.JSON(http.StatusOK, response)
}
