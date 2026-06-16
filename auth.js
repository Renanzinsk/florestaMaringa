let currentUser = null;

function setAuthToken(token) {
    if (token) {
        sessionStorage.setItem('authToken', token);
    } else {
        sessionStorage.removeItem('authToken');
    }
}

function getAuthToken() {
    return sessionStorage.getItem('authToken');
}

function setUserData(data) {
    if (data) {
        sessionStorage.setItem('userData', JSON.stringify(data));
    } else {
        sessionStorage.removeItem('userData');
    }
}

function getUserData() {
    const raw = sessionStorage.getItem('userData');
    return raw ? JSON.parse(raw) : null;
}

function authFetch(url, options = {}) {
    const token = getAuthToken();
    const headers = { ...options.headers };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    console.log('authFetch', url, token ? 'token:' + token.substring(0, 15) + '...' : 'NO TOKEN');
    return fetch(url, {
        ...options,
        credentials: 'include',
        headers
    });
}

async function checkAuth() {
    try {
        const resp = await authFetch(`${API_BASE}/auth/me`);
        const debug = { status: resp.status, ok: resp.ok };
        try { debug.body = await resp.clone().text(); } catch (e) { debug.body = '<erro lendo body>'; }
        debug.token = getAuthToken() ? getAuthToken().substring(0, 30) + '...' : 'null';
        sessionStorage.setItem('authDebug', JSON.stringify(debug));
        console.log('checkAuth', debug);
        if (resp.ok) {
            currentUser = await resp.json();
            setUserData(currentUser);
        } else {
            currentUser = null;
            setAuthToken(null);
            setUserData(null);
        }
    } catch (e) {
        const debug = { error: e.message, token: getAuthToken() ? getAuthToken().substring(0, 30) + '...' : 'null' };
        sessionStorage.setItem('authDebug', JSON.stringify(debug));
        console.log('checkAuth error', debug);
        currentUser = null;
        setAuthToken(null);
        setUserData(null);
    }
}

async function login(email, password) {
    const resp = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Erro ao fazer login');
    }
    const data = await resp.json();
    if (data.token) {
        setAuthToken(data.token);
    }
    setUserData(data);
    currentUser = data;
    sessionStorage.setItem('authDebug', JSON.stringify({
        loginOk: true,
        hasId: !!data.id,
        hasToken: !!data.token,
        tokenPrefix: data.token ? data.token.substring(0, 30) + '...' : 'NONE',
        time: Date.now()
    }));
}

async function register(name, displayName, email, password) {
    const body = { name, email, password };
    if (displayName) body.displayName = displayName;
    const resp = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Erro ao cadastrar');
    }
    await login(email, password);
}

async function logout() {
    try {
        await authFetch(`${API_BASE}/auth/logout`, {
            method: 'POST'
        });
    } catch {
        // Ignora erro se já estiver sem sessão
    }
    currentUser = null;
    setAuthToken(null);
    setUserData(null);
    window.location.href = 'index.html';
}

async function revokeConsent() {
    if (!currentUser) return;
    if (!confirm('Tem certeza? Suas avaliações serão anonimizadas e você não poderá criar novas avaliações.')) return;

    const resp = await authFetch(`${API_BASE}/users/me/revoke-consent`, {
        method: 'POST'
    });
    if (!resp.ok) {
        let msg = 'Erro ao revogar consentimento';
        try {
            const err = await resp.json();
            msg = err.error || msg;
        } catch {
            // resposta sem corpo JSON
        }
        throw new Error(msg);
    }
    currentUser = null;
    setAuthToken(null);
    setUserData(null);
    window.location.href = 'index.html';
}

async function deleteAccount() {
    if (!currentUser) return;
    if (!confirm('Tem certeza? Esta ação é irreversível. Suas avaliações serão anonimizadas.')) return;

    const resp = await authFetch(`${API_BASE}/users/me`, {
        method: 'DELETE'
    });
    if (!resp.ok) {
        let msg = 'Erro ao excluir conta';
        try {
            const err = await resp.json();
            msg = err.error || msg;
        } catch {
            // resposta sem corpo JSON
        }
        throw new Error(msg);
    }
    currentUser = null;
    setAuthToken(null);
    setUserData(null);
    window.location.href = 'index.html';
}

function isAuthenticated() {
    return currentUser !== null;
}

function getUserName() {
    return currentUser?.displayName || currentUser?.name || currentUser?.email || 'Visitante';
}
