package main

import (
	"coding-platform/config"
	"coding-platform/database"
	"coding-platform/handlers"
	"coding-platform/middleware"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	if err := config.LoadConfig(); err != nil {
		log.Fatal("Failed to load config:", err)
	}

	// Connect to database
	if err := database.Connect(); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Run migrations
	if err := database.Migrate(); err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// Set Gin mode
	gin.SetMode(config.AppConfig.GinMode)

	// Create router
	router := gin.Default()

	// CORS middleware
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// API routes
	api := router.Group("/api")
	{
		// Public routes
		auth := api.Group("/auth")
		{
			auth.POST("/register", handlers.Register)
			auth.POST("/login", handlers.Login)
		}

		// Public problem routes (read-only)
		api.GET("/problems", handlers.GetProblems)
		api.GET("/problems/:id", handlers.GetProblem)

		// Code execution - run is public, submit requires auth
		api.POST("/run", handlers.RunCode)

		// Public submission queries
		api.GET("/submissions", handlers.GetSubmissions)
		api.GET("/submissions/:id", handlers.GetSubmission)
		api.GET("/submissions/stats", handlers.GetSubmissionStats)

		// Protected routes
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware())
		{
			// User's own submissions and completed problems
			protected.GET("/my/submissions", handlers.GetUserSubmissions)
			protected.GET("/my/completed-problems", handlers.GetUserCompletedProblems)
			protected.POST("/submit", handlers.SubmitCode)
			protected.GET("/problems/:id/submissions", handlers.GetProblemSubmissions)
			
			// Admin-only routes
			admin := protected.Group("")
			admin.Use(middleware.AdminOnly())
			{
				admin.POST("/problems", handlers.CreateProblem)
				admin.PUT("/problems/:id", handlers.UpdateProblem)
				admin.DELETE("/problems/:id", handlers.DeleteProblem)
				admin.POST("/problems/:id/testcases", handlers.CreateTestCase)
				admin.GET("/problems/:id/testcases", handlers.GetTestCases)
				admin.DELETE("/problems/:id/testcases/:testcase_id", handlers.DeleteTestCase)
				
				// Plagiarism detection routes
				admin.GET("/plagiarism/submissions/:id", handlers.CheckSubmissionPlagiarism)
				admin.GET("/plagiarism/problems/:id", handlers.CheckProblemPlagiarism)
				admin.GET("/plagiarism/results/:problem_id", handlers.GetPlagiarismResults)
			}

			// Authenticated user routes
			// protected.GET("/problems/:id/testcases", handlers.GetTestCases) // This route is now in the admin group
		}
	}

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Start server
	log.Printf("Server starting on port %s", config.AppConfig.Port)
	if err := router.Run(":" + config.AppConfig.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
