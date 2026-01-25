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
            scrollbar: {
                vertical: 'auto',
                horizontal: 'auto'
            }
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

// Run Code
async function runCode() {
    const sourceCode = editor.getValue();
    const languageId = parseInt(document.getElementById('languageSelect').value);
    const customInput = document.getElementById('customInput').value;

    if (!sourceCode.trim()) {
        alert('Please write some code first!');
        return;
    }

    showResults('Running code...');

    try {
        const result = await API.runCode(sourceCode, languageId, customInput);
        displayRunResult(result);
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

    const sourceCode = editor.getValue();
    const languageId = parseInt(document.getElementById('languageSelect').value);

    if (!sourceCode.trim()) {
        alert('Please write some code first!');
        return;
    }

    showResults('Submitting code...');

    try {
        const result = await API.submitCode(currentProblemId, languageId, sourceCode);
        displaySubmitResult(result);
    } catch (error) {
        showResults(`Error: ${error.message}`, true);
    }
}

function showResults(message, isError = false) {
    const resultsPanel = document.getElementById('resultsPanel');
    const resultsContent = document.getElementById('resultsContent');

    resultsPanel.style.display = 'block';
    resultsContent.innerHTML = `<div class="${isError ? 'result-failed' : 'loading'}">${message}</div>`;
}

function displayRunResult(result) {
    const resultsContent = document.getElementById('resultsContent');

    let html = `
        <div class="result-summary ${result.passed ? 'result-passed' : 'result-failed'}">
            Status: ${result.status}
        </div>
        <div class="test-result">
            <h4>Output:</h4>
            <pre>${escapeHtml(result.stdout || 'No output')}</pre>
            ${result.stderr ? `<h4>Errors:</h4><pre>${escapeHtml(result.stderr)}</pre>` : ''}
            ${result.compile_output ? `<h4>Compilation:</h4><pre>${escapeHtml(result.compile_output)}</pre>` : ''}
            <p><strong>Time:</strong> ${result.time}s | <strong>Memory:</strong> ${result.memory} KB</p>
        </div>
    `;

    resultsContent.innerHTML = html;
}

function displaySubmitResult(result) {
    const resultsContent = document.getElementById('resultsContent');

    let html = `
        <div class="result-summary ${result.all_passed ? 'result-passed' : 'result-failed'}">
            ${result.all_passed ? '✓ All Tests Passed!' : '✗ Some Tests Failed'}
            <br>
            Passed: ${result.passed_tests} / ${result.total_tests}
        </div>
    `;

    result.test_results.forEach((test, index) => {
        html += `
            <div class="test-result">
                <h4>
                    Test Case ${index + 1}: 
                    <span style="color: ${test.passed ? 'var(--success)' : 'var(--danger)'}">
                        ${test.passed ? '✓ Passed' : '✗ Failed'}
                    </span>
                </h4>
                <p><strong>Status:</strong> ${test.status}</p>
                ${test.input ? `<h4>Input:</h4><pre>${escapeHtml(test.input)}</pre>` : ''}
                <h4>Expected Output:</h4>
                <pre>${escapeHtml(test.expected_output)}</pre>
                <h4>Your Output:</h4>
                <pre>${escapeHtml(test.stdout || 'No output')}</pre>
                ${test.stderr ? `<h4>Errors:</h4><pre>${escapeHtml(test.stderr)}</pre>` : ''}
                ${test.compile_output ? `<h4>Compilation:</h4><pre>${escapeHtml(test.compile_output)}</pre>` : ''}
                <p><strong>Time:</strong> ${test.time}s | <strong>Memory:</strong> ${test.memory} KB</p>
            </div>
        `;
    });

    resultsContent.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
