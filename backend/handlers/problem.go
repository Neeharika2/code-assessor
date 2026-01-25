package handlers

import (
	"coding-platform/database"
	"coding-platform/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type CreateProblemRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description" binding:"required"`
	Difficulty  string `json:"difficulty"`
	TimeLimit   int    `json:"time_limit"`
	MemoryLimit int    `json:"memory_limit"`
}

type CreateTestCaseRequest struct {
	Input          string `json:"input" binding:"required"`
	ExpectedOutput string `json:"expected_output" binding:"required"`
	IsSample       bool   `json:"is_sample"`
	Points         int    `json:"points"`
}

func GetProblems(c *gin.Context) {
	var problems []models.Problem
	if err := database.DB.Find(&problems).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch problems"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"problems": problems})
}

func GetProblem(c *gin.Context) {
	id := c.Param("id")
	var problem models.Problem

	// Get problem with sample test cases only
	if err := database.DB.Preload("TestCases", "is_sample = ?", true).First(&problem, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Problem not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"problem": problem})
}

func CreateProblem(c *gin.Context) {
	var req CreateProblemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")

	problem := models.Problem{
		Title:       req.Title,
		Description: req.Description,
		Difficulty:  req.Difficulty,
		TimeLimit:   req.TimeLimit,
		MemoryLimit: req.MemoryLimit,
		CreatedBy:   userID.(uint),
	}

	// Set defaults
	if problem.Difficulty == "" {
		problem.Difficulty = "easy"
	}
	if problem.TimeLimit == 0 {
		problem.TimeLimit = 2000
	}
	if problem.MemoryLimit == 0 {
		problem.MemoryLimit = 256000
	}

	if err := database.DB.Create(&problem).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create problem"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"problem": problem})
}

func UpdateProblem(c *gin.Context) {
	id := c.Param("id")
	var problem models.Problem

	if err := database.DB.First(&problem, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Problem not found"})
		return
	}

	var req CreateProblemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	problem.Title = req.Title
	problem.Description = req.Description
	problem.Difficulty = req.Difficulty
	problem.TimeLimit = req.TimeLimit
	problem.MemoryLimit = req.MemoryLimit

	if err := database.DB.Save(&problem).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update problem"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"problem": problem})
}

func DeleteProblem(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.Problem{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete problem"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Problem deleted successfully"})
}

func CreateTestCase(c *gin.Context) {
	problemID := c.Param("id")
	var req CreateTestCaseRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify problem exists
	var problem models.Problem
	if err := database.DB.First(&problem, problemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Problem not found"})
		return
	}

	pid, _ := strconv.Atoi(problemID)
	testCase := models.TestCase{
		ProblemID:      uint(pid),
		Input:          req.Input,
		ExpectedOutput: req.ExpectedOutput,
		IsSample:       req.IsSample,
		Points:         req.Points,
	}

	if testCase.Points == 0 {
		testCase.Points = 10
	}

	if err := database.DB.Create(&testCase).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create test case"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"test_case": testCase})
}

func GetTestCases(c *gin.Context) {
	problemID := c.Param("id")
	role, _ := c.Get("role")

	var testCases []models.TestCase
	query := database.DB.Where("problem_id = ?", problemID)

	// Students can only see sample test cases
	if role != "admin" {
		query = query.Where("is_sample = ?", true)
	}

	if err := query.Find(&testCases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch test cases"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"test_cases": testCases})
}
