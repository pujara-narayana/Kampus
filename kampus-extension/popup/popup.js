// ---------------------------------------------------------------------------
// Popup Script — Auth, sync status, and controls
// ---------------------------------------------------------------------------

const WEB_APP_URL = 'http://localhost:3000';
const API_BASE_KEY = 'kampusApiBase';
const TOKEN_KEY = 'kampusToken';
const USER_KEY = 'kampusUser';

// DOM references — status
const statusBanner = document.getElementById('statusBanner');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const canvasTime = document.getElementById('canvasTime');
const myredTime = document.getElementById('myredTime');
const nvolveuTime = document.getElementById('nvolveuTime');
const gradesTime = document.getElementById('gradesTime');
const syncBtn = document.getElementById('syncBtn');
const openAppBtn = document.getElementById('openApp');

// DOM references — auth
const loginSection = document.getElementById('loginSection');
const accountSection = document.getElementById('accountSection');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');
const accountEmail = document.getElementById('accountEmail');
const disconnectBtn = document.getElementById('disconnectBtn');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getApiBase() {
    const result = await chrome.storage.local.get(API_BASE_KEY);
    return result[API_BASE_KEY] || WEB_APP_URL;
}

function timeAgo(timestamp) {
    if (!timestamp) return '—';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
}

function clearLoginError() {
    loginError.textContent = '';
    loginError.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Auth — Login / Disconnect
// ---------------------------------------------------------------------------

async function checkAuthState() {
    const data = await chrome.storage.local.get([TOKEN_KEY, USER_KEY]);
    if (data[TOKEN_KEY]) {
        // Connected
        loginSection.classList.add('hidden');
        accountSection.classList.remove('hidden');
        syncBtn.disabled = false;

        if (data[USER_KEY]) {
            try {
                const user = JSON.parse(data[USER_KEY]);
                accountEmail.textContent = user.email || user.displayName || 'Connected';
            } catch {
                accountEmail.textContent = 'Connected';
            }
        } else {
            accountEmail.textContent = 'Connected';
        }
    } else {
        // Not connected
        loginSection.classList.remove('hidden');
        accountSection.classList.add('hidden');
        syncBtn.disabled = true;
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearLoginError();

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
        showLoginError('Please enter email and password.');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '⏳ Connecting...';

    try {
        const apiBase = await getApiBase();
        const response = await fetch(`${apiBase}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const result = await response.json();

        if (!response.ok) {
            showLoginError(result.error || 'Login failed');
            return;
        }

        // Store token and user info
        await chrome.storage.local.set({
            [TOKEN_KEY]: result.token,
            [USER_KEY]: JSON.stringify(result.user),
        });

        // Notify background worker
        chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: result.token });

        // Update UI
        await checkAuthState();
        setStatus('synced', 'Account connected!');
    } catch (err) {
        showLoginError('Could not reach Kampus server. Is it running?');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = '🔗 Connect';
    }
});

disconnectBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove([TOKEN_KEY, USER_KEY]);
    chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: '' });
    await checkAuthState();
    setStatus('idle', 'Disconnected');
});

// ---------------------------------------------------------------------------
// Status loading
// ---------------------------------------------------------------------------

async function loadStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATUS' });
        if (response) {
            const lastSync = response.lastSync || {};

            canvasTime.textContent = timeAgo(lastSync.canvas);
            myredTime.textContent = timeAgo(lastSync.myred);
            nvolveuTime.textContent = timeAgo(lastSync.nvolveu);
            gradesTime.textContent = timeAgo(lastSync.grades);

            const hasAnySync = lastSync.canvas || lastSync.myred || lastSync.nvolveu || lastSync.grades;
            if (response.isAuthenticated && hasAnySync) {
                setStatus('synced', 'All systems connected');
            } else if (response.isAuthenticated) {
                setStatus('idle', 'Connected — visit Canvas to start syncing');
            } else {
                setStatus('idle', 'Connect your account to start');
            }
        }
    } catch {
        setStatus('error', 'Could not reach background worker');
    }
}

function setStatus(state, text) {
    statusBanner.className = `status-banner ${state}`;
    statusDot.className = `status-dot ${state}`;
    statusText.textContent = text;
}

// ---------------------------------------------------------------------------
// Sync action
// ---------------------------------------------------------------------------

syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = '⏳ Syncing...';
    setStatus('syncing', 'Syncing data...');

    try {
        const response = await chrome.runtime.sendMessage({ type: 'MANUAL_SYNC' });
        if (response && response.success) {
            setStatus('synced', 'Sync complete!');
        } else {
            setStatus('error', response?.error || 'Sync failed');
        }
        await loadStatus();
    } catch {
        setStatus('error', 'Sync request failed');
    } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sync Now';
    }
});

// ---------------------------------------------------------------------------
// Open web app
// ---------------------------------------------------------------------------

openAppBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: WEB_APP_URL });
    window.close();
});

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

checkAuthState();
loadStatus();
