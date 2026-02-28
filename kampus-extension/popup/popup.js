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
const connectViaWebBtn = document.getElementById('connectViaWebBtn');
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

// ---------------------------------------------------------------------------
// Auth — Connect via Website / Disconnect
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

// Open the Kampus website for login — the website will send the token back
connectViaWebBtn.addEventListener('click', async () => {
    const apiBase = await getApiBase();
    // Open the login page with a flag telling it to send the token to the extension
    chrome.tabs.create({ url: `${apiBase}/login?ext=connect` });
    window.close();
});

disconnectBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove([TOKEN_KEY, USER_KEY]);
    chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: '' });
    await checkAuthState();
    setStatus('idle', 'Disconnected');
});

// Listen for token from the web app (via external message or storage change)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[TOKEN_KEY]) {
        checkAuthState();
        if (changes[TOKEN_KEY].newValue) {
            setStatus('synced', 'Account connected!');
        }
    }
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
