package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	GinMode     string
	DBHost      string
	DBPort      string
	DBUser      string
	DBPassword  string
	DBName      string
	JWTSecret   string
	Judge0URL   string
	// JPlag configuration
	JPlagBaseDir        string
	JPlagSubmissionsDir string
	JPlagResultsDir     string
	JPlagDockerImage    string
	JPlagTimeoutSeconds int
}

var AppConfig *Config

func LoadConfig() error {
	// Load .env file if it exists
	godotenv.Load()

	AppConfig = &Config{
		Port:       getEnv("PORT", "8080"),
		GinMode:    getEnv("GIN_MODE", "debug"),
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "coding_user"),
		DBPassword: getEnv("DB_PASSWORD", ""),
		DBName:     getEnv("DB_NAME", "coding_platform"),
		JWTSecret:  getEnv("JWT_SECRET", ""),
		Judge0URL:  getEnv("JUDGE0_URL", "http://localhost:2358"),
		// JPlag configuration
		JPlagBaseDir:        getEnv("JPLAG_BASE_DIR", "/opt/jplag"),
		JPlagSubmissionsDir: getEnv("JPLAG_SUBMISSIONS_DIR", "/opt/jplag/submissions"),
		JPlagResultsDir:     getEnv("JPLAG_RESULTS_DIR", "/opt/jplag/results"),
		JPlagDockerImage:    getEnv("JPLAG_DOCKER_IMAGE", "jplag"),
		JPlagTimeoutSeconds: getEnvInt("JPLAG_TIMEOUT_SECONDS", 60),
	}

	// Validate required fields
	if AppConfig.DBPassword == "" {
		return fmt.Errorf("DB_PASSWORD is required")
	}
	if AppConfig.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}

	return nil
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	intValue, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}
	return intValue
}

func (c *Config) GetDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName,
	)
}
