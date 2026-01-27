package services

import (
	"archive/zip"
	"coding-platform/config"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// LanguageIDToJPlag maps Judge0 language IDs to JPlag language codes
var LanguageIDToJPlag = map[int]string{
	62: "java",       // Java
	71: "python3",    // Python 3
	48: "c",          // C
	52: "cpp",        // C++ (C++14)
	53: "cpp",        // C++ (C++17)
	54: "cpp",        // C++ (C++20)
	63: "javascript", // JavaScript (Node.js)
	60: "go",         // Go
}

// File extension mapping for each language
var languageExtensions = map[string]string{
	"java":       ".java",
	"python3":    ".py",
	"c":          ".c",
	"cpp":        ".cpp",
	"javascript": ".js",
	"go":         ".go",
}

// JPlagComparison represents a single comparison from JPlag results
type JPlagComparison struct {
	FirstSubmission  string  `json:"firstSubmission"`
	SecondSubmission string  `json:"secondSubmission"`
	Similarity       float64 `json:"similarity"`
}

// JPlagOverview represents the overview.json structure from JPlag 5.x
type JPlagOverview struct {
	Comparisons []JPlagComparison `json:"topComparisons"`
}

// SubmissionInfo contains info about a submission for plagiarism check
type SubmissionInfo struct {
	ID         uint
	UserID     uint
	SourceCode string
	LanguageID int
}

// PlagiarismCheckResult represents the result of a plagiarism check
type PlagiarismCheckResult struct {
	SubmissionID1    uint    `json:"submission_id_1"`
	SubmissionID2    uint    `json:"submission_id_2"`
	SimilarityPercent float64 `json:"similarity_percent"`
	Status           string  `json:"status"`
}

// CheckPlagiarism runs JPlag on the given submissions for a problem
func CheckPlagiarism(problemID uint, submissions []SubmissionInfo) ([]PlagiarismCheckResult, error) {
	if len(submissions) < 2 {
		return nil, fmt.Errorf("need at least 2 submissions to check plagiarism")
	}

	// Validate all submissions have the same language
	firstLang := submissions[0].LanguageID
	for _, sub := range submissions {
		if sub.LanguageID != firstLang {
			return nil, fmt.Errorf("all submissions must be in the same language")
		}
	}

	jplagLang, ok := LanguageIDToJPlag[firstLang]
	if !ok {
		return nil, fmt.Errorf("unsupported language ID: %d", firstLang)
	}

	// Create unique run directory
	runID := uuid.New().String()
	runDir := filepath.Join(config.AppConfig.JPlagSubmissionsDir, fmt.Sprintf("run_%s", runID))
	resultsDir := filepath.Join(config.AppConfig.JPlagResultsDir, fmt.Sprintf("run_%s", runID))

	// Cleanup on exit
	defer func() {
		os.RemoveAll(runDir)
		os.RemoveAll(resultsDir)
	}()

	// Create directories
	if err := os.MkdirAll(runDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create run directory: %v", err)
	}
	if err := os.MkdirAll(resultsDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create results directory: %v", err)
	}

	// Create submission ID to folder name mapping
	submissionMap := make(map[string]uint) // folder name -> submission ID

	log.Printf("[JPlag] Writing %d submissions to %s", len(submissions), runDir)

	// Write submission files
	ext := languageExtensions[jplagLang]
	for _, sub := range submissions {
		folderName := fmt.Sprintf("s%d", sub.ID)
		submissionMap[folderName] = sub.ID

		subDir := filepath.Join(runDir, folderName)
		if err := os.MkdirAll(subDir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create submission directory: %v", err)
		}

		filePath := filepath.Join(subDir, "solution"+ext)
		if err := os.WriteFile(filePath, []byte(sub.SourceCode), 0644); err != nil {
			return nil, fmt.Errorf("failed to write submission file: %v", err)
		}
		log.Printf("[JPlag] Written submission %d to %s (UserID: %d, %d bytes)", sub.ID, filePath, sub.UserID, len(sub.SourceCode))
	}

	// Run JPlag via Docker
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(config.AppConfig.JPlagTimeoutSeconds)*time.Second)
	defer cancel()

	// Docker command: mount /opt/jplag as /data
	dockerArgs := []string{"run", "--rm",
		"-v", fmt.Sprintf("%s:/data", config.AppConfig.JPlagBaseDir),
		config.AppConfig.JPlagDockerImage,
		"-l", jplagLang,
		fmt.Sprintf("/data/submissions/run_%s", runID),
		"-r", fmt.Sprintf("/data/results/run_%s", runID),
	}
	log.Printf("[JPlag] Running: docker %s", strings.Join(dockerArgs, " "))

	cmd := exec.CommandContext(ctx, "docker", dockerArgs...)

	output, err := cmd.CombinedOutput()
	log.Printf("[JPlag] Docker output: %s", string(output))
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("JPlag execution timed out after %d seconds", config.AppConfig.JPlagTimeoutSeconds)
		}
		// JPlag may still produce results even with exit code 1
		log.Printf("[JPlag] Command warning: %v", err)
	}

	// Check if results exist
	resultsZip := filepath.Join(resultsDir, "results.zip")
	if _, err := os.Stat(resultsZip); os.IsNotExist(err) {
		log.Printf("[JPlag] No results.zip found at %s", resultsZip)
	} else {
		log.Printf("[JPlag] Found results.zip at %s", resultsZip)
	}

	// Parse results
	results, err := parseJPlagResults(resultsDir, submissionMap)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JPlag results: %v", err)
	}

	log.Printf("[JPlag] Parsed %d comparison results", len(results))
	return results, nil
}

// parseJPlagResults reads and parses the JPlag output
func parseJPlagResults(resultsDir string, submissionMap map[string]uint) ([]PlagiarismCheckResult, error) {
	var results []PlagiarismCheckResult

	// JPlag 5.x produces a results.zip file
	zipPath := filepath.Join(resultsDir, "results.zip")
	if _, err := os.Stat(zipPath); os.IsNotExist(err) {
		// Try looking for overview.json directly
		overviewPath := filepath.Join(resultsDir, "overview.json")
		if _, err := os.Stat(overviewPath); os.IsNotExist(err) {
			return results, nil // No results
		}
		return parseOverviewJSON(overviewPath, submissionMap)
	}

	// Extract and parse results.zip
	return parseResultsZip(zipPath, submissionMap)
}

// parseResultsZip extracts and parses the JPlag results.zip
func parseResultsZip(zipPath string, submissionMap map[string]uint) ([]PlagiarismCheckResult, error) {
	var results []PlagiarismCheckResult

	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open results.zip: %v", err)
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name == "overview.json" {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			defer rc.Close()

			data, err := io.ReadAll(rc)
			if err != nil {
				return nil, err
			}

			var overview JPlagOverview
			if err := json.Unmarshal(data, &overview); err != nil {
				return nil, fmt.Errorf("failed to parse overview.json: %v", err)
			}

			for _, comp := range overview.Comparisons {
				subID1, ok1 := submissionMap[comp.FirstSubmission]
				subID2, ok2 := submissionMap[comp.SecondSubmission]
				if !ok1 || !ok2 {
					continue
				}

				similarityPercent := comp.Similarity * 100
				status := classifyStatus(similarityPercent)

				results = append(results, PlagiarismCheckResult{
					SubmissionID1:    subID1,
					SubmissionID2:    subID2,
					SimilarityPercent: similarityPercent,
					Status:           status,
				})
			}
			break
		}
	}

	return results, nil
}

// parseOverviewJSON parses the overview.json file directly
func parseOverviewJSON(path string, submissionMap map[string]uint) ([]PlagiarismCheckResult, error) {
	var results []PlagiarismCheckResult

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var overview JPlagOverview
	if err := json.Unmarshal(data, &overview); err != nil {
		return nil, fmt.Errorf("failed to parse overview.json: %v", err)
	}

	for _, comp := range overview.Comparisons {
		subID1, ok1 := submissionMap[comp.FirstSubmission]
		subID2, ok2 := submissionMap[comp.SecondSubmission]
		if !ok1 || !ok2 {
			continue
		}

		similarityPercent := comp.Similarity * 100
		status := classifyStatus(similarityPercent)

		results = append(results, PlagiarismCheckResult{
			SubmissionID1:    subID1,
			SubmissionID2:    subID2,
			SimilarityPercent: similarityPercent,
			Status:           status,
		})
	}

	return results, nil
}

// classifyStatus returns the plagiarism status based on similarity percentage
func classifyStatus(similarity float64) string {
	switch {
	case similarity > 60:
		return "PLAGIARIZED"
	case similarity >= 30:
		return "SUSPICIOUS"
	default:
		return "SAFE"
	}
}

// GetJPlagLanguage returns the JPlag language code for a Judge0 language ID
func GetJPlagLanguage(languageID int) (string, bool) {
	lang, ok := LanguageIDToJPlag[languageID]
	return lang, ok
}

// IsLanguageSupported checks if a language is supported by JPlag
func IsLanguageSupported(languageID int) bool {
	_, ok := LanguageIDToJPlag[languageID]
	return ok
}

// ParseSubmissionID extracts submission ID from a folder name like "s123"
func ParseSubmissionID(folderName string) (uint, error) {
	if !strings.HasPrefix(folderName, "s") {
		return 0, fmt.Errorf("invalid folder name format")
	}
	id, err := strconv.ParseUint(folderName[1:], 10, 32)
	if err != nil {
		return 0, err
	}
	return uint(id), nil
}
