package services

import (
	"bytes"
	"coding-platform/config"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Judge0Submission struct {
	SourceCode       string `json:"source_code"`
	LanguageID       int    `json:"language_id"`
	Stdin            string `json:"stdin,omitempty"`
	ExpectedOutput   string `json:"expected_output,omitempty"`
	CPUTimeLimit     string `json:"cpu_time_limit,omitempty"`
	MemoryLimit      int    `json:"memory_limit,omitempty"`
	WallTimeLimit    string `json:"wall_time_limit,omitempty"`
}

type Judge0Response struct {
	Token  string `json:"token"`
	Status struct {
		ID          int    `json:"id"`
		Description string `json:"description"`
	} `json:"status"`
	Stdout         *string  `json:"stdout"`
	Stderr         *string  `json:"stderr"`
	CompileOutput  *string  `json:"compile_output"`
	Message        *string  `json:"message"`
	Time           *string  `json:"time"`
	Memory         *int     `json:"memory"`
}

type TestResult struct {
	Passed         bool    `json:"passed"`
	Status         string  `json:"status"`
	Time           float64 `json:"time"`
	Memory         int     `json:"memory"`
	Stdout         string  `json:"stdout"`
	Stderr         string  `json:"stderr"`
	CompileOutput  string  `json:"compile_output"`
	ExpectedOutput string  `json:"expected_output"`
	Input          string  `json:"input"`
}

func SubmitCode(sourceCode string, languageID int, stdin, expectedOutput string, timeLimitMs, memoryLimitKB int) (*TestResult, error) {
	// Convert time limit from ms to seconds (Judge0 expects seconds as string)
	timeLimitSec := fmt.Sprintf("%.1f", float64(timeLimitMs)/1000.0)

	// CRITICAL FIX: Ensure stdin is never empty to prevent EOFError
	// This is a platform responsibility, not user code responsibility
	if stdin == "" {
		stdin = "\n"
	}

	submission := Judge0Submission{
		SourceCode:     base64.StdEncoding.EncodeToString([]byte(sourceCode)),
		LanguageID:     languageID,
		Stdin:          base64.StdEncoding.EncodeToString([]byte(stdin)),
		ExpectedOutput: base64.StdEncoding.EncodeToString([]byte(expectedOutput)),
		CPUTimeLimit:   timeLimitSec,
		MemoryLimit:    memoryLimitKB,
		WallTimeLimit:  timeLimitSec,
	}

	jsonData, err := json.Marshal(submission)
	if err != nil {
		return nil, err
	}

	// Submit to Judge0
	url := fmt.Sprintf("%s/submissions?base64_encoded=true&wait=true", config.AppConfig.Judge0URL)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var judge0Resp Judge0Response
	if err := json.Unmarshal(body, &judge0Resp); err != nil {
		return nil, err
	}

	// Parse result
	result := &TestResult{
		Status:         judge0Resp.Status.Description,
		Input:          stdin,
		ExpectedOutput: expectedOutput,
	}

	// Decode base64 outputs
	if judge0Resp.Stdout != nil {
		decoded, _ := base64.StdEncoding.DecodeString(*judge0Resp.Stdout)
		result.Stdout = string(decoded)
	}
	if judge0Resp.Stderr != nil {
		decoded, _ := base64.StdEncoding.DecodeString(*judge0Resp.Stderr)
		result.Stderr = string(decoded)
	}
	if judge0Resp.CompileOutput != nil {
		decoded, _ := base64.StdEncoding.DecodeString(*judge0Resp.CompileOutput)
		result.CompileOutput = string(decoded)
	}

	// Parse time and memory
	if judge0Resp.Time != nil {
		fmt.Sscanf(*judge0Resp.Time, "%f", &result.Time)
	}
	if judge0Resp.Memory != nil {
		result.Memory = *judge0Resp.Memory
	}

	// Status ID 3 = Accepted
	result.Passed = judge0Resp.Status.ID == 3

	return result, nil
}

func GetSubmission(token string) (*Judge0Response, error) {
	url := fmt.Sprintf("%s/submissions/%s?base64_encoded=true", config.AppConfig.Judge0URL, token)
	
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var judge0Resp Judge0Response
	if err := json.Unmarshal(body, &judge0Resp); err != nil {
		return nil, err
	}

	return &judge0Resp, nil
}

// Helper function to wait for submission completion (if not using wait=true)
func WaitForSubmission(token string, maxWaitSeconds int) (*Judge0Response, error) {
	for i := 0; i < maxWaitSeconds*2; i++ {
		resp, err := GetSubmission(token)
		if err != nil {
			return nil, err
		}

		// Status ID 1 = In Queue, 2 = Processing
		if resp.Status.ID != 1 && resp.Status.ID != 2 {
			return resp, nil
		}

		time.Sleep(500 * time.Millisecond)
	}

	return nil, fmt.Errorf("submission timed out")
}
