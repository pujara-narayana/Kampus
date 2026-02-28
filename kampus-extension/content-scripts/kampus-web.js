// ---------------------------------------------------------------------------
// Kampus Web Bridge — runs on the Kampus web app (localhost)
// Listens for token messages from the website and saves to extension storage
// ---------------------------------------------------------------------------

(function () {
  const TOKEN_KEY = 'kampusToken';
  const USER_KEY = 'kampusUser';

  // Listen for messages from the page (posted by auth-context.tsx)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'KAMPUS_TOKEN_BRIDGE') {
      const { token, user } = event.data;
      if (token) {
        chrome.storage.local.set({
          [TOKEN_KEY]: token,
          [USER_KEY]: user || '',
        });
        // Notify background script
        try {
          chrome.runtime.sendMessage({ type: 'SET_TOKEN', token });
        } catch (e) {
          // Background may not be ready
        }
        console.log('[Kampus Extension] Token synced from website.');
      }
    }
  });
})();
