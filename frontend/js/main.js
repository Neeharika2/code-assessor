// DOM Elements
const problemsView = document.getElementById('problemsView');
const problemView = document.getElementById('problemView');
const problemsList = document.getElementById('problemsList');
const problemDetail = document.getElementById('problemDetail');
const authModal = document.getElementById('authModal');
const createProblemModal = document.getElementById('createProblemModal');
const editProblemModal = document.getElementById('editProblemModal');

let currentTestCases = [];
let selectedTestCaseIndex = 0;
let completedProblemIds = new Set(); // Track which problems the user has completed

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initEditor();
    loadProblems();
    updateAuthUI();
    setupEventListeners();
});

function setupEventListeners() {
    // Auth buttons
    document.getElementById('loginBtn').addEventListener('click', () => showAuthModal('login'));
    document.getElementById('registerBtn').addEventListener('click', () => showAuthModal('register'));
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Navigation
    document.getElementById('problemsListBtn').addEventListener('click', () => {
        problemsView.style.display = 'block';
        problemView.style.display = 'none';
        currentProblemId = null;
    });

    // Code execution
    document.getElementById('runBtn').addEventListener('click', runCode);
    document.getElementById('submitBtn').addEventListener('click', submitCode);

    // Create problem
    document.getElementById('createProblemBtn').addEventListener('click', () => {
        createProblemModal.style.display = 'block';
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn);
            // Load submissions when switching to submissions tab
            if (btn.dataset.tab === 'submissions' && currentProblemId) {
                loadSubmissions(currentProblemId);
            }
        });
    });

    // Console tab switching
    document.querySelectorAll('.console-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchConsoleTab(btn));
    });

    // Edit and Delete problem buttons
    document.getElementById('editProblemBtn').addEventListener('click', openEditProblemModal);
    document.getElementById('deleteProblemBtn').addEventListener('click', deleteProblem);

    // Modal close buttons
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', () => {
            authModal.style.display = 'none';
            createProblemModal.style.display = 'none';
            editProblemModal.style.display = 'none';
        });
    });

    // Forms
    document.getElementById('authForm').addEventListener('submit', handleAuth);
    document.getElementById('createProblemForm').addEventListener('submit', handleCreateProblem);
    document.getElementById('editProblemForm').addEventListener('submit', handleEditProblem);

    // Click outside modal to close
    window.addEventListener('click', (e) => {
        if (e.target === authModal) authModal.style.display = 'none';
        if (e.target === createProblemModal) createProblemModal.style.display = 'none';
        if (e.target === editProblemModal) editProblemModal.style.display = 'none';
    });
}

// Tab Switching
function switchTab(clickedBtn) {
    const tabName = clickedBtn.dataset.tab;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    clickedBtn.classList.add('active');

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

function switchConsoleTab(clickedBtn) {
    const tabName = clickedBtn.dataset.consoleTab;

    // Update tab buttons
    document.querySelectorAll('.console-tab-btn').forEach(btn => btn.classList.remove('active'));
    clickedBtn.classList.add('active');

    // Update tab panes
    document.querySelectorAll('.console-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// Auth
function showAuthModal(mode) {
    const title = document.getElementById('authTitle');
    const emailGroup = document.getElementById('emailGroup');
    const switchText = document.getElementById('authSwitch');

    authModal.style.display = 'block';

    if (mode === 'login') {
        title.textContent = 'Login';
        emailGroup.style.display = 'none';
        switchText.innerHTML = 'Don\'t have an account? <a onclick="showAuthModal(\'register\')">Register</a>';
    } else {
        title.textContent = 'Register';
        emailGroup.style.display = 'block';
        switchText.innerHTML = 'Already have an account? <a onclick="showAuthModal(\'login\')">Login</a>';
    }

    document.getElementById('authForm').dataset.mode = mode;
}

async function handleAuth(e) {
    e.preventDefault();

    const mode = e.target.dataset.mode;
    const username = document.getElementById('authUsername').value;
    const password = document.getElementById('authPassword').value;
    const email = document.getElementById('authEmail').value;

    try {
        if (mode === 'login') {
            await API.login(username, password);
        } else {
            await API.register(username, email, password);
            await API.login(username, password);
        }

        authModal.style.display = 'none';
        updateAuthUI();
        loadProblems();
        alert(`${mode === 'login' ? 'Logged in' : 'Registered'} successfully!`);
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

function logout() {
    API.logout();
    updateAuthUI();
    loadProblems();
}

function updateAuthUI() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const userMenu = document.getElementById('userMenu');
    const createProblemBtn = document.getElementById('createProblemBtn');
    const usernameEl = document.getElementById('username');

    if (currentUser) {
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        userMenu.style.display = 'flex';
        usernameEl.textContent = currentUser.username;

        if (currentUser.role === 'admin') {
            createProblemBtn.style.display = 'block';
        }
    } else {
        loginBtn.style.display = 'block';
        registerBtn.style.display = 'block';
        userMenu.style.display = 'none';
        createProblemBtn.style.display = 'none';
    }
}

// Problems
async function loadProblems() {
    try {
        const data = await API.getProblems();

        // Load completed problems if user is authenticated
        if (currentUser) {
            try {
                const completedData = await API.getCompletedProblems();
                completedProblemIds = new Set(completedData.completed_problem_ids || []);
            } catch (error) {
                console.log('Could not load completed problems:', error);
                completedProblemIds = new Set();
            }
        } else {
            completedProblemIds = new Set();
        }

        displayProblems(data.problems || []);
    } catch (error) {
        problemsList.innerHTML = `<tr><td colspan="3" class="loading">Error loading problems: ${error.message}</td></tr>`;
    }
}

function displayProblems(problems) {
    if (problems.length === 0) {
        problemsList.innerHTML = '<tr><td colspan="3" class="loading">No problems available yet.</td></tr>';
        return;
    }

    problemsList.innerHTML = problems.map(problem => {
        const isCompleted = completedProblemIds.has(problem.id);
        const completionBadge = isCompleted ? '<span style="color: var(--accent-green); margin-left: 8px; font-size: 16px;" title="Completed">✓</span>' : '';

        return `
            <tr onclick="loadProblem(${problem.id})">
                <td>
                    <div class="problem-title">${escapeHtml(problem.title)}${completionBadge}</div>
                </td>
                <td>
                    <span class="difficulty-badge difficulty-${problem.difficulty}">
                        ${problem.difficulty}
                    </span>
                </td>
                <td>
                    <div class="problem-description">${escapeHtml(problem.description.substring(0, 100))}...</div>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadProblem(id) {
    try {
        const data = await API.getProblem(id);
        const problem = data.problem;

        currentProblemId = id;
        currentProblem = problem; // Store for editing
        currentTestCases = problem.test_cases || [];

        problemDetail.innerHTML = `
            <h2>${escapeHtml(problem.title)}</h2>
            <div class="problem-meta">
                <span class="difficulty-badge difficulty-${problem.difficulty}">
                    ${problem.difficulty}
                </span>
                <span class="text-muted">Time Limit: ${problem.time_limit}ms</span>
                <span class="text-muted">Memory Limit: ${problem.memory_limit}KB</span>
            </div>
            <p>${escapeHtml(problem.description)}</p>
            ${currentTestCases.length > 0 ? `
                <h3>Examples</h3>
                ${currentTestCases.map((tc, i) => `
                    <div class="test-result">
                        <h4>Example ${i + 1}</h4>
                        <p><strong>Input:</strong></p>
                        <pre>${escapeHtml(tc.input)}</pre>
                        <p><strong>Output:</strong></p>
                        <pre>${escapeHtml(tc.expected_output)}</pre>
                    </div>
                `).join('')}
            ` : ''}
        `;

        // Setup testcase selector
        setupTestCaseSelector();

        // Show admin actions if user is admin
        const adminActions = document.getElementById('adminActions');
        if (currentUser && currentUser.role === 'admin') {
            adminActions.style.display = 'flex';
        } else {
            adminActions.style.display = 'none';
        }

        problemsView.style.display = 'none';
        problemView.style.display = 'block';

        // Reset editor and results
        editor.setValue(getDefaultCode());
        document.getElementById('resultsContent').innerHTML = '<p class="text-muted">Run your code to see results here...</p>';

        // Switch to description tab and testcase tab
        document.querySelector('.tab-btn[data-tab="description"]').click();
        document.querySelector('.console-tab-btn[data-console-tab="testcase"]').click();
    } catch (error) {
        alert(`Error loading problem: ${error.message}`);
    }
}

function setupTestCaseSelector() {
    const selector = document.getElementById('testcaseSelector');

    if (currentTestCases.length === 0) {
        selector.innerHTML = '<p class="text-muted">No test cases available</p>';
        return;
    }

    selector.innerHTML = currentTestCases.map((tc, i) => `
        <button class="testcase-btn ${i === 0 ? 'active' : ''}" onclick="selectTestCase(${i})">
            Case ${i + 1}
        </button>
    `).join('');

    // Display first test case
    selectTestCase(0);
}

function selectTestCase(index) {
    selectedTestCaseIndex = index;
    const tc = currentTestCases[index];

    // Update active button
    document.querySelectorAll('.testcase-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });

    // Display testcase
    document.getElementById('testcaseInput').textContent = tc.input;
    document.getElementById('testcaseOutput').textContent = tc.expected_output;
}

let createdProblemId = null;
let testCaseCount = 0;

async function handleCreateProblem(e) {
    e.preventDefault();

    const problemData = {
        title: document.getElementById('problemTitle').value,
        description: document.getElementById('problemDescription').value,
        difficulty: document.getElementById('problemDifficulty').value,
        time_limit: parseInt(document.getElementById('timeLimit').value),
        memory_limit: parseInt(document.getElementById('memoryLimit').value)
    };

    try {
        const result = await API.createProblem(problemData);
        createdProblemId = result.problem.id;

        // Move to test case step
        document.getElementById('problemStep').style.display = 'none';
        document.getElementById('testCaseStep').style.display = 'block';

        // Add initial test case
        testCaseCount = 0;
        document.getElementById('testCasesContainer').innerHTML = '';
        addTestCase();
    } catch (error) {
        alert(`Error creating problem: ${error.message}`);
    }
}

function addTestCase() {
    testCaseCount++;
    const container = document.getElementById('testCasesContainer');

    const testCaseCard = document.createElement('div');
    testCaseCard.className = 'test-case-card';
    testCaseCard.dataset.index = testCaseCount;

    testCaseCard.innerHTML = `
        <div class="test-case-header">
            <h4>Test Case ${testCaseCount}</h4>
            <button type="button" class="remove-test-case" onclick="removeTestCase(${testCaseCount})">×</button>
        </div>
        <div class="test-case-fields">
            <div class="form-group">
                <label>Input</label>
                <textarea class="tc-input" rows="3" placeholder="Enter input for this test case"></textarea>
            </div>
            <div class="form-group">
                <label>Expected Output</label>
                <textarea class="tc-output" rows="3" placeholder="Enter expected output"></textarea>
            </div>
            <div class="checkbox-group">
                <input type="checkbox" class="tc-sample" id="sample-${testCaseCount}">
                <label for="sample-${testCaseCount}">Mark as sample (visible to users)</label>
            </div>
        </div>
    `;

    container.appendChild(testCaseCard);
}

function removeTestCase(index) {
    const card = document.querySelector(`.test-case-card[data-index="${index}"]`);
    if (card) {
        card.remove();
    }
}

async function finishProblemCreation() {
    const testCaseCards = document.querySelectorAll('.test-case-card');

    if (testCaseCards.length === 0) {
        alert('Please add at least one test case');
        return;
    }

    const testCases = [];
    let hasError = false;

    testCaseCards.forEach((card, index) => {
        const input = card.querySelector('.tc-input').value.trim();
        const output = card.querySelector('.tc-output').value.trim();
        const isSample = card.querySelector('.tc-sample').checked;

        if (!input || !output) {
            alert(`Test Case ${index + 1}: Both input and output are required`);
            hasError = true;
            return;
        }

        testCases.push({
            input,
            expected_output: output,
            is_sample: isSample,
            points: 10
        });
    });

    if (hasError) return;

    try {
        // Create all test cases
        for (const testCase of testCases) {
            await API.createTestCase(createdProblemId, testCase);
        }

        // Close modal and refresh
        createProblemModal.style.display = 'none';
        resetCreateProblemModal();
        loadProblems();
        alert('Problem and test cases created successfully!');
    } catch (error) {
        alert(`Error creating test cases: ${error.message}`);
    }
}

function resetCreateProblemModal() {
    document.getElementById('problemStep').style.display = 'block';
    document.getElementById('testCaseStep').style.display = 'none';
    document.getElementById('createProblemForm').reset();
    document.getElementById('testCasesContainer').innerHTML = '';
    createdProblemId = null;
    testCaseCount = 0;
}

function backToProblemStep() {
    if (confirm('Going back will discard the problem. Are you sure?')) {
        resetCreateProblemModal();
    }
}

// Setup event listeners for test case creation
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...

    document.getElementById('addTestCaseBtn').addEventListener('click', addTestCase);
    document.getElementById('finishBtn').addEventListener('click', finishProblemCreation);
    document.getElementById('backToProblemBtn').addEventListener('click', backToProblemStep);
});

let currentProblem = null;
let editTestCaseCount = 0;
let existingTestCases = [];
let testCasesToDelete = [];

function openEditProblemModal() {
    if (!currentProblemId) {
        alert('No problem selected');
        return;
    }

    // Pre-fill the form with current problem data
    document.getElementById('editProblemTitle').value = currentProblem.title;
    document.getElementById('editProblemDescription').value = currentProblem.description;
    document.getElementById('editProblemDifficulty').value = currentProblem.difficulty;
    document.getElementById('editTimeLimit').value = currentProblem.time_limit;
    document.getElementById('editMemoryLimit').value = currentProblem.memory_limit;

    // Reset to first step
    document.getElementById('editProblemStep').style.display = 'block';
    document.getElementById('editTestCaseStep').style.display = 'none';

    editProblemModal.style.display = 'block';
}

async function handleEditProblem(e) {
    e.preventDefault();

    // Move to test case management step
    document.getElementById('editProblemStep').style.display = 'none';
    document.getElementById('editTestCaseStep').style.display = 'block';

    // Load existing test cases
    await loadExistingTestCases();
}

async function loadExistingTestCases() {
    try {
        const data = await API.getTestCases(currentProblemId);
        existingTestCases = data.test_cases || [];
        testCasesToDelete = [];
        editTestCaseCount = 0;

        const container = document.getElementById('editTestCasesContainer');
        container.innerHTML = '';

        // Display existing test cases
        existingTestCases.forEach((tc, index) => {
            addEditTestCase(tc, index);
        });
    } catch (error) {
        console.error('Error loading test cases:', error);
        document.getElementById('editTestCasesContainer').innerHTML = '';
    }
}

function addEditTestCase(existingData = null, existingIndex = null) {
    editTestCaseCount++;
    const container = document.getElementById('editTestCasesContainer');

    const testCaseCard = document.createElement('div');
    testCaseCard.className = 'test-case-card';
    testCaseCard.dataset.index = editTestCaseCount;

    if (existingData) {
        testCaseCard.dataset.testcaseId = existingData.id;
    }

    const isExisting = existingData !== null;
    const title = isExisting ? `Test Case ${existingIndex + 1} (ID: ${existingData.id})` : `New Test Case`;

    testCaseCard.innerHTML = `
        <div class="test-case-header">
            <h4>${title}</h4>
            <button type="button" class="remove-test-case" onclick="removeEditTestCase(${editTestCaseCount}, ${existingData ? existingData.id : 'null'})">×</button>
        </div>
        <div class="test-case-fields">
            <div class="form-group">
                <label>Input</label>
                <textarea class="tc-input" rows="3" placeholder="Enter input for this test case">${existingData ? existingData.input : ''}</textarea>
            </div>
            <div class="form-group">
                <label>Expected Output</label>
                <textarea class="tc-output" rows="3" placeholder="Enter expected output">${existingData ? existingData.expected_output : ''}</textarea>
            </div>
            <div class="checkbox-group">
                <input type="checkbox" class="tc-sample" id="edit-sample-${editTestCaseCount}" ${existingData && existingData.is_sample ? 'checked' : ''}>
                <label for="edit-sample-${editTestCaseCount}">Mark as sample (visible to users)</label>
            </div>
        </div>
    `;

    container.appendChild(testCaseCard);
}

function removeEditTestCase(index, testCaseId) {
    const card = document.querySelector(`.test-case-card[data-index="${index}"]`);
    if (card) {
        // If it's an existing test case, mark for deletion
        if (testCaseId) {
            testCasesToDelete.push(testCaseId);
        }
        card.remove();
    }
}

async function saveAllEditChanges() {
    try {
        // Step 1: Update problem details
        const problemData = {
            title: document.getElementById('editProblemTitle').value,
            description: document.getElementById('editProblemDescription').value,
            difficulty: document.getElementById('editProblemDifficulty').value,
            time_limit: parseInt(document.getElementById('editTimeLimit').value),
            memory_limit: parseInt(document.getElementById('editMemoryLimit').value)
        };

        await API.updateProblem(currentProblemId, problemData);

        // Step 2: Delete marked test cases
        for (const testCaseId of testCasesToDelete) {
            await API.deleteTestCase(currentProblemId, testCaseId);
        }

        // Step 3: Create/Update test cases
        const testCaseCards = document.querySelectorAll('#editTestCasesContainer .test-case-card');

        for (const card of testCaseCards) {
            const input = card.querySelector('.tc-input').value.trim();
            const output = card.querySelector('.tc-output').value.trim();
            const isSample = card.querySelector('.tc-sample').checked;
            const testCaseId = card.dataset.testcaseId;

            if (!input || !output) {
                alert('All test cases must have both input and output');
                return;
            }

            const testCaseData = {
                input,
                expected_output: output,
                is_sample: isSample,
                points: 10
            };

            // If it's a new test case (no ID), create it
            if (!testCaseId) {
                await API.createTestCase(currentProblemId, testCaseData);
            }
            // Note: We don't have an update endpoint, so existing test cases
            // would need to be deleted and recreated if modified
        }

        // Close modal and refresh
        editProblemModal.style.display = 'none';
        resetEditModal();
        loadProblem(currentProblemId);

        alert('Problem and test cases updated successfully!');
    } catch (error) {
        alert(`Error saving changes: ${error.message}`);
    }
}

function resetEditModal() {
    document.getElementById('editProblemStep').style.display = 'block';
    document.getElementById('editTestCaseStep').style.display = 'none';
    document.getElementById('editTestCasesContainer').innerHTML = '';
    existingTestCases = [];
    testCasesToDelete = [];
    editTestCaseCount = 0;
}

function backToEditProblemStep() {
    document.getElementById('editProblemStep').style.display = 'block';
    document.getElementById('editTestCaseStep').style.display = 'none';
}

// Setup event listeners for edit test cases
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...

    document.getElementById('addEditTestCaseBtn').addEventListener('click', () => addEditTestCase());
    document.getElementById('saveEditBtn').addEventListener('click', saveAllEditChanges);
    document.getElementById('backToEditProblemBtn').addEventListener('click', backToEditProblemStep);
});

async function deleteProblem() {

    if (!currentProblemId) {
        alert('No problem selected');
        return;
    }

    const confirmed = confirm(
        'Are you sure you want to delete this problem?\n\n' +
        'This will permanently delete:\n' +
        '- The problem\n' +
        '- All test cases (sample and hidden)\n' +
        '- All submissions for this problem\n\n' +
        'This action cannot be undone!'
    );

    if (!confirmed) return;

    try {
        await API.deleteProblem(currentProblemId);

        // Go back to problems list
        problemsView.style.display = 'block';
        problemView.style.display = 'none';
        currentProblemId = null;

        // Reload problems list
        loadProblems();

        alert('Problem deleted successfully!');
    } catch (error) {
        alert(`Error deleting problem: ${error.message}`);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load and display submissions for a problem
async function loadSubmissions(problemId) {
    const submissionsContent = document.querySelector('#submissionsTab .submissions-content');

    if (!currentUser) {
        submissionsContent.innerHTML = '<p class="text-muted">Please login to view your submissions.</p>';
        return;
    }

    submissionsContent.innerHTML = '<p class="text-muted">Loading submissions...</p>';

    try {
        const data = await API.getProblemSubmissions(problemId);
        displaySubmissions(data.submissions || []);
    } catch (error) {
        submissionsContent.innerHTML = `<p class="text-muted" style="color: var(--accent-red);">Error loading submissions: ${error.message}</p>`;
    }
}

function displaySubmissions(submissions) {
    const submissionsContent = document.querySelector('#submissionsTab .submissions-content');

    if (submissions.length === 0) {
        submissionsContent.innerHTML = '<p class="text-muted">No submissions yet. Submit your code to see your history here!</p>';
        return;
    }

    const html = `
        <div style="overflow-x: auto;">
            <table class="problems-table" style="margin-top: 0;">
                <thead>
                    <tr>
                        <th width="15%">Status</th>
                        <th width="20%">Language</th>
                        <th width="15%">Tests Passed</th>
                        <th width="20%">Time</th>
                        <th width="30%">Submitted</th>
                    </tr>
                </thead>
                <tbody>
                    ${submissions.map(sub => {
        const statusColor = sub.passed ? 'var(--accent-green)' : 'var(--accent-red)';
        const statusText = sub.passed ? '✓ Accepted' : '✗ Failed';
        const languageNames = {
            71: 'Python 3',
            63: 'JavaScript',
            54: 'C++',
            62: 'Java',
            50: 'C',
            60: 'Go'
        };
        const date = new Date(sub.submitted_at);
        const formattedDate = date.toLocaleString();

        return `
                            <tr style="cursor: default;">
                                <td>
                                    <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>
                                </td>
                                <td>${languageNames[sub.language_id] || 'Unknown'}</td>
                                <td>${sub.passed_tests} / ${sub.total_tests}</td>
                                <td>${sub.execution_time.toFixed(2)}s</td>
                                <td style="font-size: 13px;">${formattedDate}</td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    submissionsContent.innerHTML = html;
}

// ==========================================
// Plagiarism Detection (Admin Only)
// ==========================================

const plagiarismView = document.getElementById('plagiarismView');
const plagiarismBtn = document.getElementById('plagiarismBtn');

// Show plagiarism button for admins
function updatePlagiarismUI() {
    if (currentUser && currentUser.role === 'admin') {
        plagiarismBtn.style.display = 'inline-block';
    } else {
        plagiarismBtn.style.display = 'none';
    }
}

// Load problems into plagiarism selector
async function loadPlagiarismProblems() {
    try {
        const data = await API.getProblems();
        const select = document.getElementById('plagiarismProblemSelect');

        select.innerHTML = '<option value="">Select a problem...</option>' +
            (data.problems || []).map(p =>
                `<option value="${p.id}">${escapeHtml(p.title)}</option>`
            ).join('');
    } catch (error) {
        console.error('Error loading problems for plagiarism:', error);
    }
}

// Show plagiarism view
function showPlagiarismView() {
    problemsView.style.display = 'none';
    problemView.style.display = 'none';
    plagiarismView.style.display = 'block';
    loadPlagiarismProblems();
}

// Check plagiarism for selected problem
async function checkPlagiarism() {
    const problemId = document.getElementById('plagiarismProblemSelect').value;
    const languageId = document.getElementById('plagiarismLanguageSelect').value;
    const statusEl = document.getElementById('plagiarismStatus');
    const resultsEl = document.getElementById('plagiarismResults');

    if (!problemId) {
        alert('Please select a problem');
        return;
    }

    statusEl.innerHTML = '<span style="color: var(--text-secondary);">Checking for plagiarism... This may take a moment.</span>';
    resultsEl.innerHTML = '';

    try {
        const data = await API.checkProblemPlagiarism(problemId, languageId || null);
        displayPlagiarismResults(data);
    } catch (error) {
        statusEl.innerHTML = `<span style="color: var(--accent-red);">Error: ${error.message}</span>`;
        resultsEl.innerHTML = '<p class="text-muted">Failed to check plagiarism. Make sure JPlag is properly configured on the server.</p>';
    }
}

// Display plagiarism results
function displayPlagiarismResults(data) {
    const statusEl = document.getElementById('plagiarismStatus');
    const resultsEl = document.getElementById('plagiarismResults');

    if (data.message) {
        statusEl.innerHTML = `<span style="color: var(--text-secondary);">${data.message}</span>`;
        resultsEl.innerHTML = '';
        return;
    }

    const flaggedCount = data.flagged_count || 0;
    const statusColor = flaggedCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)';

    statusEl.innerHTML = `
        <strong>Results:</strong> 
        ${data.total_submissions} submissions analyzed, 
        ${data.total_comparisons} comparisons made, 
        <span style="color: ${statusColor}; font-weight: 600;">${flaggedCount} flagged</span>
    `;

    if (!data.results || data.results.length === 0) {
        resultsEl.innerHTML = '<p class="text-muted">No plagiarism detected between different users.</p>';
        return;
    }

    const languageNames = {
        71: 'Python 3',
        63: 'JavaScript',
        54: 'C++',
        62: 'Java',
        48: 'C',
        60: 'Go'
    };

    resultsEl.innerHTML = `
        <table class="problems-table">
            <thead>
                <tr>
                    <th width="20%">User 1</th>
                    <th width="20%">User 2</th>
                    <th width="25%">Similarity</th>
                    <th width="15%">Status</th>
                </tr>
            </thead>
            <tbody>
                ${data.results.map(r => {
        const statusClass = r.status === 'PLAGIARIZED' ? 'difficulty-hard' :
            r.status === 'SUSPICIOUS' ? 'difficulty-medium' : 'difficulty-easy';
        return `
                        <tr>
                            <td>
                                <div><strong>${escapeHtml(r.username_1 || 'Unknown')}</strong></div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary);">Submission #${r.submission_id_1}</div>
                            </td>
                            <td>
                                <div><strong>${escapeHtml(r.username_2 || 'Unknown')}</strong></div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary);">Submission #${r.submission_id_2}</div>
                            </td>
                            <td>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <div style="flex: 1; height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                                        <div style="width: ${r.similarity_percent}%; height: 100%; background: ${r.status === 'PLAGIARIZED' ? 'var(--accent-red)' :
                r.status === 'SUSPICIOUS' ? 'var(--accent-yellow)' : 'var(--accent-green)'
            };"></div>
                                    </div>
                                    <span style="font-weight: 600;">${r.similarity_percent.toFixed(1)}%</span>
                                </div>
                            </td>
                            <td>
                                <span class="difficulty-badge ${statusClass}">${r.status}</span>
                            </td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

// Setup plagiarism event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Update plagiarism UI on auth changes
    updatePlagiarismUI();

    // Plagiarism nav button
    if (plagiarismBtn) {
        plagiarismBtn.addEventListener('click', showPlagiarismView);
    }

    // Check plagiarism button
    const checkBtn = document.getElementById('checkPlagiarismBtn');
    if (checkBtn) {
        checkBtn.addEventListener('click', checkPlagiarism);
    }

    // Problems list button should hide plagiarism view
    document.getElementById('problemsListBtn').addEventListener('click', () => {
        if (plagiarismView) {
            plagiarismView.style.display = 'none';
        }
    });
});

// Override updateAuthUI to also update plagiarism
const originalUpdateAuthUI = updateAuthUI;
updateAuthUI = function () {
    originalUpdateAuthUI();
    updatePlagiarismUI();
};

