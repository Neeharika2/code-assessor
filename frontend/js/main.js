// DOM Elements
const problemsView = document.getElementById('problemsView');
const problemView = document.getElementById('problemView');
const problemsList = document.getElementById('problemsList');
const problemDetail = document.getElementById('problemDetail');
const authModal = document.getElementById('authModal');
const createProblemModal = document.getElementById('createProblemModal');

let currentTestCases = [];
let selectedTestCaseIndex = 0;

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
        btn.addEventListener('click', () => switchTab(btn));
    });

    // Console tab switching
    document.querySelectorAll('.console-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchConsoleTab(btn));
    });

    // Modal close buttons
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', () => {
            authModal.style.display = 'none';
            createProblemModal.style.display = 'none';
        });
    });

    // Forms
    document.getElementById('authForm').addEventListener('submit', handleAuth);
    document.getElementById('createProblemForm').addEventListener('submit', handleCreateProblem);

    // Click outside modal to close
    window.addEventListener('click', (e) => {
        if (e.target === authModal) authModal.style.display = 'none';
        if (e.target === createProblemModal) createProblemModal.style.display = 'none';
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

    problemsList.innerHTML = problems.map(problem => `
        <tr onclick="loadProblem(${problem.id})">
            <td>
                <div class="problem-title">${escapeHtml(problem.title)}</div>
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
    `).join('');
}

async function loadProblem(id) {
    try {
        const data = await API.getProblem(id);
        const problem = data.problem;

        currentProblemId = id;
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
