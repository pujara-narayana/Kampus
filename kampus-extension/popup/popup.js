// ---------------------------------------------------------------------------
// Popup Script — Reads sync status and provides controls
// ---------------------------------------------------------------------------

const WEB_APP_URL = 'http://localhost:3000';

// DOM references
const statusBanner = document.getElementById('statusBanner');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const canvasTime = document.getElementById('canvasTime');
const myredTime = document.getElementById('myredTime');
const nvolveuTime = document.getElementById('nvolveuTime');
const gradesTime = document.getElementById('gradesTime');
const syncBtn = document.getElementById('syncBtn');
const openAppBtn = document.getElementById('openApp');

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Status loading
// ---------------------------------------------------------------------------

async function loadStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATUS' });
        if (response && response.success) {
            const status = response.status || {};

            canvasTime.textContent = timeAgo(status.canvas);
            myredTime.textContent = timeAgo(status.myred);
            nvolveuTime.textContent = timeAgo(status.nvolveu);
            gradesTime.textContent = timeAgo(status.grades);

            // Determine overall status
            const hasAnySync = status.canvas || status.myred || status.nvolveu || status.grades;
            if (hasAnySync) {
                setStatus('synced', 'All systems connected');
            } else {
                setStatus('idle', 'No data synced yet — visit Canvas to start');
            }
        } else {
            setStatus('idle', 'Extension ready');
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
        // Reload status after sync
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

loadStatus();
