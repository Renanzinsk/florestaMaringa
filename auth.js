const API_URL = 'http://localhost:8080';

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
    } catch (e) {
        return null;
    }
}

async function login(email, password) {
    const resp = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Erro ao fazer login');
    }
    const data = await resp.json();
    const payload = parseJwt(data.token);
    localStorage.setItem('token', data.token);
    localStorage.setItem('userEmail', payload?.sub || email);
    return data;
}

async function register(name, email, password) {
    const resp = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Erro ao cadastrar');
    }
    const user = await resp.json();
    await login(email, password);
    localStorage.setItem('userName', user.name);
    return user;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    window.location.href = 'index.html';
}

function isAuthenticated() {
    return !!localStorage.getItem('token');
}

function getUserName() {
    return localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Visitante';
}

function getToken() {
    return localStorage.getItem('token');
}

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
}
