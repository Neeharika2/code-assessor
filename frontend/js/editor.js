let editor;
let currentProblemId = null;

// Initialize Monaco Editor
function initEditor() {
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

    require(['vs/editor/editor.main'], function () {
        editor = monaco.editor.create(document.getElementById('editor'), {
            value: getDefaultCode(),
            language: 'python',
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            roundedSelection: false,
            padding: { top: 10, bottom: 10 },
            scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8
            },
            // Disable copy-paste functionality
            domReadOnly: false, // Allow typing but restrict clipboard
            contextmenu: false // Disable right-click context menu
        });

        // Disable only paste action
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, function () {
            alert('⚠️ Paste is disabled in this editor');
        });

        // Language change handler
        document.getElementById('languageSelect').addEventListener('change', (e) => {
            const languageId = parseInt(e.target.value);
            const languageMap = {
                71: 'python',
                63: 'javascript',
                54: 'cpp',
                62: 'java',
                50: 'c',
                60: 'go'
            };

            monaco.editor.setModelLanguage(editor.getModel(), languageMap[languageId] || 'python');
            editor.setValue(getDefaultCode(languageId));
        });
    });
}

function getDefaultCode(languageId = 71) {
    const templates = {
        71: '# Python 3\ndef solution():\n    # Write your code here\n    pass\n\nif __name__ == "__main__":\n    solution()',
        63: '// JavaScript (Node.js)\nfunction solution() {\n    // Write your code here\n}\n\nsolution();',
        54: '// C++\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}',
        62: '// Java\npublic class Main {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}',
        50: '// C\n#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}',
        60: '// Go\npackage main\n\nimport "fmt"\n\nfunc main() {\n    // Write your code here\n}'
    };

    return templates[languageId] || templates[71];
}

// Run Code - validates against sample test cases
async function runCode() {
    if (!currentProblemId) {
        alert('No problem selected!');
        return;
    }

    const sourceCode = editor.getValue();
    const languageId = parseInt(document.getElementById('languageSelect').value);

    if (!sourceCode.trim()) {
        alert('Please write some code first!');
        return;
    }

    // Switch to result tab
    document.querySelector('.console-tab-btn[data-console-tab="result"]').click();

    showResults('Running code against sample test cases...');

    try {
        const result = await API.runCode(currentProblemId, languageId, sourceCode);
        displaySubmitResult(result);
    } catch (error) {
        showResults(`Error: ${error.message}`, true);
    }
}

// Submit Code
async function submitCode() {
    if (!currentProblemId) {
        alert('No problem selected!');
        return;
    }

    // Check if user is authenticated
    if (!currentUser) {
        alert('Please login to submit your code!');
        showAuthModal('login');
        return;
    }

    const sourceCode = editor.getValue();
    const languageId = parseInt(document.getElementById('languageSelect').value);

    if (!sourceCode.trim()) {
        alert('Please write some code first!');
        return;
    }

    // Switch to result tab
    document.querySelector('.console-tab-btn[data-console-tab="result"]').click();

    showResults('Submitting code...');

    try {
        const result = await API.submitCode(currentProblemId, languageId, sourceCode);
        displaySubmitResult(result);

        // If all tests passed, show success message and reload problems list
        if (result.all_passed) {
            setTimeout(() => {
                alert('Congratulations! You solved this problem!');
                // Reload problems list to update completion status
                if (typeof loadProblems === 'function') {
                    loadProblems();
                }
            }, 500);
        }
    } catch (error) {
        showResults(`Error: ${error.message}`, true);
    }
}

function showResults(message, isError = false) {
    const resultsContent = document.getElementById('resultsContent');
    resultsContent.innerHTML = `<div class="${isError ? 'result-failed' : 'text-muted'}" style="padding: 1rem;">${message}</div>`;
}

function displaySubmitResult(result) {
    const resultsContent = document.getElementById('resultsContent');

    // Check if this is from Run Code (no submission_id) or Submit Code
    const isRunCode = !result.submission_id || result.submission_id === 0;
    const testType = isRunCode ? 'Sample Test Cases' : 'All Test Cases';

    let html = `
        <div class="result-summary ${result.all_passed ? 'result-passed' : 'result-failed'}">
            ${result.all_passed ? '✓ All Tests Passed!' : '✗ Some Tests Failed'}
            <br>
            <span style="font-size: 13px; font-weight: 400;">${testType}: ${result.passed_tests} / ${result.total_tests} passed</span>
        </div>
    `;

    // Filter to only show sample test cases (those with input/output data) or all if running code
    const visibleTests = result.test_results.filter((test) => {
        // For Run Code, show all tests (they're all sample tests)
        if (isRunCode) return true;
        // For Submit Code, only show tests that have input/output (sample tests)
        return test.input || test.expected_output;
    });

    // Only display test case details if there are visible tests
    if (visibleTests.length > 0) {
        html += '<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-primary);"><h3 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 1rem;">Sample Test Cases:</h3>';

        visibleTests.forEach((test, index) => {
            html += `
                <div class="test-result">
                    <h4>
                        Test Case ${index + 1}: 
                        <span style="color: ${test.passed ? 'var(--accent-green)' : 'var(--accent-red)'}">
                            ${test.passed ? '✓ Passed' : '✗ Failed'}
                        </span>
                    </h4>
                    <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 0.5rem;">
                        <strong>Status:</strong> ${test.status}
                    </p>
                    ${test.input ? `
                        <div style="margin-bottom: 0.5rem;">
                            <label style="display: block; color: var(--text-secondary); font-size: 12px; margin-bottom: 0.25rem;">Input:</label>
                            <pre style="background: var(--bg-tertiary); padding: 0.5rem; border-radius: 4px; font-size: 12px; margin: 0; border: 1px solid var(--border-primary);">${escapeHtml(test.input)}</pre>
                        </div>
                    ` : ''}
                    <div style="margin-bottom: 0.5rem;">
                        <label style="display: block; color: var(--text-secondary); font-size: 12px; margin-bottom: 0.25rem;">Expected Output:</label>
                        <pre style="background: var(--bg-tertiary); padding: 0.5rem; border-radius: 4px; font-size: 12px; margin: 0; border: 1px solid var(--border-primary);">${escapeHtml(test.expected_output)}</pre>
                    </div>
                    <div style="margin-bottom: 0.5rem;">
                        <label style="display: block; color: var(--text-secondary); font-size: 12px; margin-bottom: 0.25rem;">Your Output:</label>
                        <pre style="background: var(--bg-tertiary); padding: 0.5rem; border-radius: 4px; font-size: 12px; margin: 0; border: 1px solid var(--border-primary);">${escapeHtml(test.stdout || 'No output')}</pre>
                    </div>
                    ${test.stderr ? `
                        <div style="margin-bottom: 0.5rem;">
                            <label style="display: block; color: var(--accent-red); font-size: 12px; margin-bottom: 0.25rem;">Errors:</label>
                            <pre style="background: var(--bg-tertiary); padding: 0.5rem; border-radius: 4px; font-size: 12px; margin: 0; border: 1px solid var(--accent-red); color: var(--accent-red);">${escapeHtml(test.stderr)}</pre>
                        </div>
                    ` : ''}
                    ${test.compile_output ? `
                        <div style="margin-bottom: 0.5rem;">
                            <label style="display: block; color: var(--accent-yellow); font-size: 12px; margin-bottom: 0.25rem;">Compilation:</label>
                            <pre style="background: var(--bg-tertiary); padding: 0.5rem; border-radius: 4px; font-size: 12px; margin: 0; border: 1px solid var(--accent-yellow); color: var(--accent-yellow);">${escapeHtml(test.compile_output)}</pre>
                        </div>
                    ` : ''}
                    <p style="color: var(--text-muted); font-size: 12px; margin-top: 0.5rem;">
                        <strong>Time:</strong> ${test.time}s | <strong>Memory:</strong> ${test.memory} KB
                    </p>
                </div>
            `;
        });

        html += '</div>';
    }

    resultsContent.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
