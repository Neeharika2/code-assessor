const API_BASE_URL = '/api';

// Auth state
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

// API Client
class API {
    static async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (authToken && !options.skipAuth) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    }

    // Auth
    static async register(username, email, password, role = 'student') {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password, role }),
            skipAuth: true
        });
    }

    static async login(username, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
            skipAuth: true
        });

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        return data;
    }

    static logout() {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
    }

    // Problems
    static async getProblems() {
        return this.request('/problems', { skipAuth: true });
    }

    static async getProblem(id) {
        return this.request(`/problems/${id}`, { skipAuth: true });
    }

    static async createProblem(problemData) {
        return this.request('/problems', {
            method: 'POST',
            body: JSON.stringify(problemData)
        });
    }

    static async createTestCase(problemId, testCaseData) {
        return this.request(`/problems/${problemId}/testcases`, {
            method: 'POST',
            body: JSON.stringify(testCaseData)
        });
    }

    // Code Execution
    static async submitCode(problemId, languageId, sourceCode) {
        return this.request('/submit', {
            method: 'POST',
            body: JSON.stringify({
                problem_id: problemId,
                language_id: languageId,
                source_code: sourceCode
            }),
            skipAuth: true
        });
    }

    static async runCode(problemId, languageId, sourceCode) {
        return this.request('/run', {
            method: 'POST',
            body: JSON.stringify({
                problem_id: problemId,
                language_id: languageId,
                source_code: sourceCode
            }),
            skipAuth: true
        });
    }
}
